import { describe, it, expect, beforeEach } from 'vitest'
import { enqueue, discard, flushOutbox, getOutbox, clearError, resetOutboxCache, type OutboxItem, type SendResult } from './farmOutbox'

const entry = (label: string) => ({ kind: 'record' as const, payload: { recordType: 'milk', label }, label })

beforeEach(() => { localStorage.clear(); resetOutboxCache() })

describe('farm outbox', () => {
  it('keeps what was saved with no signal, with its own id and time', () => {
    const a = enqueue('u1', entry('Lakshmi - Milk'))
    expect(a.id).toBeTruthy()
    expect(getOutbox('u1').map(i => i.label)).toEqual(['Lakshmi - Milk'])
    resetOutboxCache() // a page reload: it comes back from the phone's storage
    expect(getOutbox('u1')).toHaveLength(1)
  })

  it('is kept per person - a shared phone never shows or sends someone else\'s entries', () => {
    enqueue('u1', entry('mine'))
    expect(getOutbox('u2')).toEqual([])
    expect(JSON.parse(localStorage.getItem('farmOutbox:v1:u2') || '[]')).toEqual([])
  })

  it('sends oldest first and removes each one once it is sent', async () => {
    enqueue('u1', entry('first')); enqueue('u1', entry('second'))
    const order: string[] = []
    const r = await flushOutbox('u1', async (i: OutboxItem): Promise<SendResult> => { order.push(i.label); return { ok: true } })
    expect(order).toEqual(['first', 'second'])
    expect(r).toEqual({ sent: 2, offline: false })
    expect(getOutbox('u1')).toEqual([])
  })

  it('stops at the first entry that cannot reach the server and keeps everything from there on', async () => {
    enqueue('u1', entry('a')); enqueue('u1', entry('b')); enqueue('u1', entry('c'))
    let n = 0
    const r = await flushOutbox('u1', async (): Promise<SendResult> => (++n === 2 ? { ok: false, reached: false, reason: 'offline' } : { ok: true }))
    expect(r).toEqual({ sent: 1, offline: true })
    expect(getOutbox('u1').map(i => i.label)).toEqual(['b', 'c'])
  })

  it('an entry the server refused stays, with the reason, is not retried by itself, and does not block the rest', async () => {
    enqueue('u1', entry('refused')); enqueue('u1', entry('fine'))
    const calls: string[] = []
    await flushOutbox('u1', async (i): Promise<SendResult> => { calls.push(i.label); return i.label === 'refused' ? { ok: false, reached: true, reason: 'This animal is already marked as sold.' } : { ok: true } })
    expect(getOutbox('u1')).toHaveLength(1)
    expect(getOutbox('u1')[0]).toMatchObject({ label: 'refused', error: 'This animal is already marked as sold.' })
    calls.length = 0
    await flushOutbox('u1', async (i): Promise<SendResult> => { calls.push(i.label); return { ok: true } })
    expect(calls).toEqual([]) // waits for the farmer
    clearError('u1', getOutbox('u1')[0].id)
    await flushOutbox('u1', async (i): Promise<SendResult> => { calls.push(i.label); return { ok: true } })
    expect(calls).toEqual(['refused'])
    expect(getOutbox('u1')).toEqual([])
  })

  it('the farmer can discard an entry', () => {
    const a = enqueue('u1', entry('x'))
    discard('u1', a.id)
    expect(getOutbox('u1')).toEqual([])
  })

  it('survives a damaged store', () => {
    localStorage.setItem('farmOutbox:v1:u1', '{not json')
    expect(getOutbox('u1')).toEqual([])
  })

  it('two flushes at once do not send an entry twice', async () => {
    enqueue('u1', entry('once'))
    let sends = 0
    const slow = async (): Promise<SendResult> => { sends++; await new Promise(r => setTimeout(r, 20)); return { ok: true } }
    await Promise.all([flushOutbox('u1', slow), flushOutbox('u1', slow)])
    expect(sends).toBe(1)
  })
})

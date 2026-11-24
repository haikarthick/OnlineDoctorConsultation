import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { userMessage } from '../utils/userMessage'
import {
  retryConfirmed, discard, enqueue, flushOutbox, getOutbox, subscribeOutbox,
  type OutboxItem, type SendResult,
} from '../utils/farmOutbox'

const EMPTY: OutboxItem[] = []

/** Sends one waiting entry. "Reached" means the server answered at all (even to refuse it). */
async function sendItem(item: OutboxItem): Promise<SendResult> {
  try {
    if (item.kind === 'event') await apiService.saveGroupEvent(item.payload as any, item.id) // id = the Idempotency-Key
    else if (item.kind === 'treatment') {
      const { farmId, ...body } = item.payload as { farmId: string } & Record<string, unknown>
      await apiService.addSelfTreatment(farmId, { ...(body as any), id: item.id }) // id = the row id, so a replay makes no second row
    } else if (item.kind === 'correction') {
      const c = item.payload as { source: 'prescription' | 'self'; sourceId: string; lastDoseOn: string | null }
      if (c.source === 'prescription') await apiService.correctTreatmentCourse(c.sourceId, c.lastDoseOn)
      else await apiService.correctSelfTreatmentCourse(c.sourceId, c.lastDoseOn)
    } else await apiService.saveFarmRecord(item.payload as any)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, reached: !!err?.response, reason: userMessage(err) }
  }
}

/**
 * The farm outbox for the signed-in person: the entries waiting to be sent, and what to do with them. It
 * tries to send when the screen opens, when the phone comes back online, and every 30 seconds while
 * anything is waiting. `onSent` runs after something was sent, so the screen can reload.
 */
export function useFarmOutbox(onSent?: () => void) {
  const { user } = useAuth()
  const userId = user?.id || ''
  const items = useSyncExternalStore(subscribeOutbox, () => (userId ? getOutbox(userId) : EMPTY), () => EMPTY)
  const onSentRef = useRef(onSent)
  onSentRef.current = onSent

  const flush = useCallback(async () => {
    if (!userId || getOutbox(userId).length === 0) return { sent: 0, offline: false }
    const r = await flushOutbox(userId, sendItem)
    if (r.sent > 0) onSentRef.current?.()
    return r
  }, [userId])

  useEffect(() => {
    void flush()
    const onOnline = () => { void flush() }
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => { if (getOutbox(userId).some(i => !i.error)) void flush() }, 30000)
    return () => { window.removeEventListener('online', onOnline); window.clearInterval(timer) }
  }, [flush, userId])

  return {
    items,
    waiting: items.filter(i => !i.error).length,
    refused: items.filter(i => !!i.error).length,
    flush,
    add: (entry: Omit<OutboxItem, 'id' | 'createdAt'>) => (userId ? enqueue(userId, entry) : null),
    discard: (id: string) => { if (userId) discard(userId, id) },
    retry: (id: string) => { if (userId) { retryConfirmed(userId, id); void flush() } },
  }
}

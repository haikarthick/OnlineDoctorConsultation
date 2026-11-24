import { describe, it, expect, vi, afterEach } from 'vitest'
import { isFoodSegment, isWithdrawalConfirm, sendWithWithdrawalConfirm } from './withdrawal'

vi.mock('./userMessage', async () => {
  const actual = await vi.importActual<typeof import('./userMessage')>('./userMessage')
  return { ...actual, userMessage: (e: any) => e?.response?.data?.message || 'x' }
})

const warning = { response: { status: 409, data: { message: 'Lakshmi is under a milk withdrawal.', error: { code: 'WITHDRAWAL_CONFIRM' } } } }
const t = ((k: string) => k) as any

afterEach(() => { vi.restoreAllMocks() })

describe('withdrawal helpers', () => {
  it('pets and horses need no label days; every livestock segment does', () => {
    expect(isFoodSegment('pet')).toBe(false)
    expect(isFoodSegment('equine')).toBe(false)
    expect(isFoodSegment(null)).toBe(false)
    for (const s of ['dairy', 'poultry', 'pig', 'small_ruminant', 'aquaculture', 'other_livestock']) expect(isFoodSegment(s)).toBe(true)
  })

  it('recognises the server\'s "please confirm" answer, and nothing else', () => {
    expect(isWithdrawalConfirm(warning)).toBe(true)
    expect(isWithdrawalConfirm({ response: { data: { error: { code: 'VALIDATION_ERROR' } } } })).toBe(false)
  })

  it('saves straight away when nothing is held back', async () => {
    const send = vi.fn().mockResolvedValue('ok')
    expect(await sendWithWithdrawalConfirm(send, t)).toBe('ok')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(false)
  })

  it('shows the server\'s warning in words and sends again as confirmed when the person agrees', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const send = vi.fn().mockRejectedValueOnce(warning).mockResolvedValueOnce('saved')
    expect(await sendWithWithdrawalConfirm(send, t)).toBe('saved')
    expect(ask.mock.calls[0][0]).toContain('Lakshmi is under a milk withdrawal.')
    expect(send.mock.calls.map(c => c[0])).toEqual([false, true])
  })

  it('saves nothing when the person says no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const send = vi.fn().mockRejectedValue(warning)
    await expect(sendWithWithdrawalConfirm(send, t)).rejects.toThrow('withdrawal.notSaved')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('any other failure goes on as it is', async () => {
    const boom = { response: { status: 500, data: { error: { code: 'INTERNAL_ERROR' } } } }
    await expect(sendWithWithdrawalConfirm(vi.fn().mockRejectedValue(boom), t)).rejects.toBe(boom)
  })
})

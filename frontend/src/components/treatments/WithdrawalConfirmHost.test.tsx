import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import WithdrawalConfirmHost from './WithdrawalConfirmHost'
import { sendWithWithdrawalConfirm } from '../../utils/withdrawal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'en' } }),
}))

const warning = { response: { status: 409, data: { message: 'server words', error: { code: 'WITHDRAWAL_CONFIRM', params: { what: 'meat', name: null, group: true, until: '2026-12-12', medicine: 'Product A' } } } } }
const t = ((k: string) => k) as any

afterEach(cleanup)

describe('WithdrawalConfirmHost (the one go-ahead-anyway sheet)', () => {
  it('shows the translated warning, and "Go ahead anyway" sends it again as confirmed', async () => {
    render(<WithdrawalConfirmHost />)
    const send = vi.fn().mockRejectedValueOnce(warning).mockResolvedValueOnce('saved')
    const done = sendWithWithdrawalConfirm(send, t)
    await screen.findByText(/withdrawal.holdMeat/)
    expect(screen.getByText(/withdrawal.warnWho/).textContent).toContain('withdrawal.nameGroup')
    expect(screen.getByText(/withdrawal.warnWhyMeat/)).toBeTruthy()
    fireEvent.click(screen.getByText('withdrawal.goAhead'))
    expect(await done).toBe('saved')
    expect(send.mock.calls.map(c => c[0])).toEqual([false, true])
    await waitFor(() => expect(screen.queryByText('withdrawal.goAhead')).toBeNull())
  })

  it('"Go back" saves nothing', async () => {
    render(<WithdrawalConfirmHost />)
    const send = vi.fn().mockRejectedValue(warning)
    const done = sendWithWithdrawalConfirm(send, t)
    fireEvent.click(await screen.findByText('withdrawal.goBack'))
    await expect(done).rejects.toThrow('withdrawal.notSaved')
    expect(send).toHaveBeenCalledTimes(1)
  })
})

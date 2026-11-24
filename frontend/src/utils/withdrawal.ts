import type { TFunction } from 'i18next'
import { serverErrorCode, userMessage, UserFacingError } from './userMessage'

/**
 * Withdrawal helpers shared by every screen (ledger WDR-*). The server is the authority; these only decide what to SHOW.
 */

/** A species whose farm segment is pet or equine needs no label days on a prescription; every livestock segment does. */
export function isFoodSegment(segment: string | null | undefined): boolean {
  return !!segment && segment !== 'pet' && segment !== 'equine'
}

export interface PrescriptionLine {
  name: string
  dosage: string
  frequency: string
  duration?: string
  instructions?: string
  kind?: 'medicine' | 'medicated_feed' | 'diet' | 'supplement'
  treatmentDays?: number
  withdrawalMilkDays?: number
  withdrawalMeatDays?: number
  withdrawalNone?: boolean
}

export interface WithdrawalStatus {
  milkUntil: string | null
  meatUntil: string | null
  milkActive: boolean
  meatActive: boolean
  active: boolean
  items: Array<{ source: 'prescription' | 'self'; sourceId: string; medicine: string; startedOn: string; lastDose: string; milkUntil: string | null; meatUntil: string | null }>
}

/** True when the server answered "please confirm" (a withdrawal warning), not a real failure. */
export function isWithdrawalConfirm(err: unknown): boolean {
  return serverErrorCode(err) === 'WITHDRAWAL_CONFIRM'
}

/**
 * Warn-and-confirm (never a silent block): when the server says milk / eggs or meat is under a withdrawal, the person reads
 * the warning in their own words and chooses. "Save anyway" sends the same request again with confirmWithdrawal; "no" saves nothing.
 */
export async function sendWithWithdrawalConfirm<T>(send: (confirmWithdrawal: boolean) => Promise<T>, t: TFunction): Promise<T> {
  try {
    return await send(false)
  } catch (err) {
    if (!isWithdrawalConfirm(err)) throw err
    const yes = typeof window !== 'undefined' && window.confirm(`${userMessage(err)}\n\n${t('withdrawal.confirmQuestion')}`)
    if (!yes) throw new UserFacingError(t('withdrawal.notSaved'))
    return send(true)
  }
}

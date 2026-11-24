import type { TFunction } from 'i18next'
import { serverErrorCode, serverErrorParams, userMessage, UserFacingError } from './userMessage'

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

/** What the server says is held back (values only; the words come from the person's own language). */
export interface WithdrawalWarning {
  what: 'milk' | 'meat'
  name: string | null
  group: boolean
  until: string
  medicine: string | null
  /** The server's own sentence: shown only when the values are missing. */
  fallback: string
}

type Asker = (warning: WithdrawalWarning) => Promise<boolean>
let asker: Asker | null = null

/** The one sheet that asks "go ahead anyway?" registers itself here (WithdrawalConfirmHost, mounted once in App). */
export function setWithdrawalAsker(fn: Asker | null): void { asker = fn }

export function warningOf(err: unknown): WithdrawalWarning {
  const p = serverErrorParams(err)
  return {
    what: p?.what === 'meat' ? 'meat' : 'milk',
    name: typeof p?.name === 'string' ? p.name : null,
    group: p?.group === true,
    until: typeof p?.until === 'string' ? p.until : '',
    medicine: typeof p?.medicine === 'string' ? p.medicine : null,
    fallback: userMessage(err),
  }
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
    const yes = asker ? await asker(warningOf(err)) : false
    if (!yes) throw new UserFacingError(t('withdrawal.notSaved'))
    return send(true)
  }
}

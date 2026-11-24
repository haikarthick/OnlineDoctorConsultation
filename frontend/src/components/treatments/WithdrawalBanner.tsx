import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import type { WithdrawalStatus } from '../../utils/withdrawal'

/** Short date in the person's language: "12 Dec". */
export function shortDate(iso: string, lang: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang, { day: 'numeric', month: 'short' })
}

/**
 * "Hold back milk and eggs through 12 Dec" - shown on an animal or a herd while a treatment holds something back.
 * One answer (the withdrawal service) for every screen; renders nothing when nothing is held back or it cannot be read.
 */
export const WithdrawalBanner: React.FC<{ animalId?: string; groupId?: string }> = ({ animalId, groupId }) => {
  const { t, i18n } = useTranslation()
  const [s, setS] = useState<WithdrawalStatus | null>(null)

  useEffect(() => {
    let active = true
    if (!animalId && !groupId) { setS(null); return }
    const call = animalId ? apiService.animalWithdrawal(animalId) : apiService.getGroupWithdrawal(groupId as string)
    call.then((res: any) => { if (active) setS(res?.data || null) }).catch(() => { if (active) setS(null) })
    return () => { active = false }
  }, [animalId, groupId])

  if (!s || !s.active) return null
  const lead = (s.items || []).find(i => i.milkUntil === s.milkUntil || i.meatUntil === s.meatUntil)
  return (
    <div className="alert alert-error wd-banner" role="status">
      <strong>⚠️ {t('withdrawal.bannerTitle')}</strong>
      {s.milkUntil && <p>{t('withdrawal.holdMilk', { date: shortDate(s.milkUntil, i18n.language) })}</p>}
      {s.meatUntil && <p>{t('withdrawal.holdMeat', { date: shortDate(s.meatUntil, i18n.language) })}</p>}
      {lead?.medicine && <p className="wd-hint">{t('withdrawal.because', { medicine: lead.medicine })}</p>}
    </div>
  )
}

export default WithdrawalBanner

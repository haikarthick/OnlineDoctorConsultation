import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../mobile/BottomSheet'
import { setWithdrawalAsker, type WithdrawalWarning } from '../../utils/withdrawal'
import { shortDate } from './WithdrawalBanner'

/**
 * The one "go ahead anyway?" sheet for every withdrawal warning (milk / eggs entry, animal or herd sale, marketplace listing),
 * in the person's own language and in the app's own look. Mounted once in App; screens only call sendWithWithdrawalConfirm.
 */
export const WithdrawalConfirmHost: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [warning, setWarning] = useState<WithdrawalWarning | null>(null)
  const answer = useRef<((yes: boolean) => void) | null>(null)

  useEffect(() => {
    setWithdrawalAsker(w => new Promise<boolean>(resolve => {
      // A second warning while one is open: the first is answered "no" so nothing is ever left hanging.
      answer.current?.(false)
      answer.current = resolve
      setWarning(w)
    }))
    return () => setWithdrawalAsker(null)
  }, [])

  const finish = useCallback((yes: boolean) => {
    answer.current?.(yes)
    answer.current = null
    setWarning(null)
  }, [])

  const w = warning
  const name = w ? (w.name || t(w.group ? 'withdrawal.nameGroup' : 'withdrawal.nameAnimal')) : ''
  const known = !!w && !!w.until

  return (
    <BottomSheet open={!!w} title={t('withdrawal.confirmTitle')} onClose={() => finish(false)}>
      {w && (
        <div className="wd-confirm">
          {known ? (
            <>
              <p>{t('withdrawal.warnWho', { name })}</p>
              <p><strong>{t(w.what === 'milk' ? 'withdrawal.holdMilk' : 'withdrawal.holdMeat', { date: shortDate(w.until, i18n.language) })}</strong></p>
              {w.medicine && <p className="wd-hint">{t('withdrawal.because', { medicine: w.medicine })}</p>}
              <p>{t(w.what === 'milk' ? 'withdrawal.warnWhyMilk' : 'withdrawal.warnWhyMeat')}</p>
            </>
          ) : <p>{w.fallback}</p>}
          <p className="wd-hint">{t('withdrawal.confirmQuestion')}</p>
          <button type="button" className="btn btn-primary nutri-wide-btn" onClick={() => finish(false)}>{t('withdrawal.goBack')}</button>
          <button type="button" className="btn btn-outline nutri-wide-btn" onClick={() => finish(true)}>{t('withdrawal.goAhead')}</button>
        </div>
      )}
    </BottomSheet>
  )
}

export default WithdrawalConfirmHost

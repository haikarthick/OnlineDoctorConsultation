import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface InviteResult {
  who?: string
  link: string
  sms: { status: 'sent' | 'logged' | 'skipped' | 'failed'; reason?: string } | null
  emailStatus: string | null
}

/**
 * What happened to an invitation that was just created or sent again: was the text message sent, was the
 * email sent - and the link, with a Copy button, so it can always be shared by hand (WhatsApp, any app)
 * when a text message could not be sent.
 */
export const InviteResultNotice: React.FC<{ result: InviteResult }> = ({ result }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.link)
      setCopied(true)
    } catch {
      // Clipboard not available (older phone browser): the link is shown below to copy by hand.
      setCopied(false)
    }
  }

  const sms = result.sms
  return (
    <div className="team-invite-result" role="status">
      <p className="team-invite-result-title">✓ {t('farmTeam.created', { who: result.who || '' })}</p>
      {sms && (sms.status === 'sent' || sms.status === 'logged') && <p>{t('farmTeam.smsSent')}</p>}
      {sms && sms.status === 'skipped' && <p>{t('farmTeam.smsSkipped', { reason: sms.reason || '' })}</p>}
      {sms && sms.status === 'failed' && <p>{t('farmTeam.smsFailed', { reason: sms.reason || '' })}</p>}
      {result.emailStatus === 'sent' && <p>{t('farmTeam.emailSent')}</p>}
      <p className="team-invite-result-label">{t('farmTeam.shareLink')}</p>
      <input className="module-input team-invite-link" readOnly value={result.link} onFocus={e => e.currentTarget.select()} aria-label={t('farmTeam.shareLink')} />
      <button type="button" className="btn btn-secondary" onClick={copy}>{t('farmTeam.copyLink')}</button>
      {copied && <p className="team-invite-copied" role="status">{t('farmTeam.linkCopied')}</p>}
    </div>
  )
}

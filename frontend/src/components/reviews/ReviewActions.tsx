import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { codedMessage } from '../../utils/codedMessage'
import '../mobile/ownerTools.css'

export interface ReviewActionState {
  id: string
  helpfulCount?: number
  markedHelpful?: boolean
  reportedByMe?: boolean
  responseFromVet?: string
}

type Reason = 'inappropriate' | 'fake' | 'spam' | 'other'
const REASONS: Reason[] = ['inappropriate', 'fake', 'spam', 'other']

interface Props {
  review: ReviewActionState
  /** The signed-in person wrote this review: they cannot mark or report it. */
  isOwnReview: boolean
  /** The signed-in person is the vet this review is about: they may reply. */
  canReply: boolean
  /** Signed out readers see the counts but no buttons. */
  signedIn: boolean
  onChange: (patch: Partial<ReviewActionState>) => void
}

/**
 * The three things anyone can do with a review, in ONE place for every screen that lists reviews (a vet's public profile, the vet's own
 * "My reviews"): mark it helpful (a toggle), report it with a reason (an admin then moderates it), and - only the vet it is about -
 * reply to it (one reply that the vet may edit again).
 */
export function ReviewActions({ review, isOwnReview, canReply, signedIn, onChange }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<Reason | ''>('')
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')

  const helpful = async () => {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      const res = await apiService.markReviewHelpful(review.id)
      onChange({ helpfulCount: res?.data?.helpfulCount ?? review.helpfulCount, markedHelpful: !!res?.data?.marked })
    } catch (err) { setMessage({ text: codedMessage(err, 'reviewActions', 'reviewActions.failed'), ok: false }) }
    finally { setBusy(false) }
  }

  const sendReport = async () => {
    if (busy || !reason) return
    setBusy(true); setMessage(null)
    try {
      await apiService.reportReview(review.id, reason)
      onChange({ reportedByMe: true })
      setReporting(false)
      setMessage({ text: t('reviewActions.reportedThanks'), ok: true })
    } catch (err) { setMessage({ text: codedMessage(err, 'reviewActions', 'reviewActions.failed'), ok: false }) }
    finally { setBusy(false) }
  }

  const sendReply = async () => {
    const text = replyText.trim()
    if (busy || !text) return
    setBusy(true); setMessage(null)
    try {
      await apiService.addVetResponse(review.id, text)
      onChange({ responseFromVet: text })
      setReplying(false)
      setMessage({ text: t('reviewActions.replySaved'), ok: true })
    } catch (err) { setMessage({ text: codedMessage(err, 'reviewActions', 'reviewActions.failed'), ok: false }) }
    finally { setBusy(false) }
  }

  const count = review.helpfulCount || 0
  const reasons = REASONS.map(value => ({ value, label: t(`reviewActions.reasons.${value}`) }))

  return (
    <div className="ot-sheet">
      {message && <div className={message.ok ? 'ot-ok' : 'ot-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}
      <div className="ot-actions">
        {signedIn && !isOwnReview && (
          <button type="button" className={`module-btn${review.markedHelpful ? ' ot-toggle-on' : ''}`} aria-pressed={!!review.markedHelpful} disabled={busy} onClick={helpful}>
            {t('reviewActions.helpful', { count })}
          </button>
        )}
        {(!signedIn || isOwnReview) && count > 0 && <span className="ot-muted">{t('reviewActions.helpfulCount', { count })}</span>}
        {signedIn && !isOwnReview && (
          review.reportedByMe
            ? <span className="ot-muted">{t('reviewActions.reportedAlready')}</span>
            : <button type="button" className="module-btn" disabled={busy} onClick={() => { setReason(''); setReporting(true) }}>{t('reviewActions.report')}</button>
        )}
        {canReply && (
          <button type="button" className="module-btn" disabled={busy} onClick={() => { setReplyText(review.responseFromVet || ''); setReplying(true) }}>
            {review.responseFromVet ? t('reviewActions.editReply') : t('reviewActions.reply')}
          </button>
        )}
      </div>

      <BottomSheet open={reporting} title={t('reviewActions.reportTitle')} onClose={() => setReporting(false)}>
        <div className="ot-form">
          <p className="ot-muted">{t('reviewActions.reportHint')}</p>
          <ChipSelect<Reason> label={t('reviewActions.reportWhy')} options={reasons} value={reason} onChange={setReason} />
          <div className="ot-actions">
            <button type="button" className="module-btn" onClick={() => setReporting(false)}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy || !reason} onClick={sendReport}>{t('reviewActions.reportSend')}</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={replying} title={t('reviewActions.replyTitle')} onClose={() => setReplying(false)}>
        <div className="ot-form">
          <p className="ot-muted">{t('reviewActions.replyHint')}</p>
          <label>{t('reviewActions.replyLabel')}
            <textarea value={replyText} maxLength={1000} onChange={e => setReplyText(e.target.value)} />
          </label>
          <div className="ot-actions">
            <button type="button" className="module-btn" onClick={() => setReplying(false)}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy || !replyText.trim()} onClick={sendReply}>{t('reviewActions.replySend')}</button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

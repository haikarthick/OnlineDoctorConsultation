import React from 'react'
import { useTranslation } from 'react-i18next'

export interface EmailTemplate {
  subject: string
  body: string
}

const TEMPLATE_KEYS = ['booking_confirmation', 'booking_cancellation', 'booking_reminder', 'password_reset', 'staff_invite'] as const

interface Props {
  emailTemplates: Record<string, EmailTemplate>
  templateSaved: boolean
  onEditTemplate: (key: string, tmpl: EmailTemplate | undefined) => void
}

const EmailTemplatesCard: React.FC<Props> = ({ emailTemplates, templateSaved, onEditTemplate }) => {
  const { t } = useTranslation()
  const labelMap: Record<string, string> = {
    booking_confirmation: t('emailTemplates.bookingConfirmation'),
    booking_cancellation: t('emailTemplates.bookingCancellation'),
    booking_reminder: t('emailTemplates.bookingReminder'),
    password_reset: t('emailTemplates.passwordReset'),
    staff_invite: t('emailTemplates.staffInvite'),
  }
  return (
    <div className="module-card si-af65fe13">
      <div className="card-header si-9803f8d1">
        <h2>📧 {t('emailTemplates.title')}</h2>
      </div>
      <div className="card-body">
        {templateSaved && <div className="module-alert success">{t('emailTemplates.saved')}</div>}
        <div className="si-42a2dabd">
          {TEMPLATE_KEYS.map(key => {
            const tmpl = emailTemplates[key]
            return (
              <div key={key} className="module-card si-44087c4b">
                <div className="card-header">
                  <strong>{labelMap[key]}</strong>
                </div>
                <div className="card-body si-0a803082">
                  {tmpl ? (
                    <p className="si-649dc167">{t('emailTemplates.subject')}: {tmpl.subject}</p>
                  ) : null}
                  <button
                    className="module-btn primary small"
                    onClick={() => onEditTemplate(key, tmpl)}
                  >
                    ✏️ {t('emailTemplates.edit')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default EmailTemplatesCard

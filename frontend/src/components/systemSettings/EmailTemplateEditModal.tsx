import React from 'react'
import { useTranslation } from 'react-i18next'
import { EmailTemplate } from './EmailTemplatesCard'

interface Props {
  editingTemplate: string | null
  templateDraft: EmailTemplate
  setTemplateDraft: React.Dispatch<React.SetStateAction<EmailTemplate>>
  savingTemplate: boolean
  onClose: () => void
  onSave: () => void
}

const EmailTemplateEditModal: React.FC<Props> = ({ editingTemplate, templateDraft, setTemplateDraft, savingTemplate, onClose, onSave }) => {
  const { t } = useTranslation()
  if (!editingTemplate) return null
  return (
    <div className="si-5044997e">
      <div className="module-card si-a118ca47">
        <div className="card-header si-9803f8d1">
          <h3>✏️ {t('emailTemplates.edit')}</h3>
          <button className="module-btn" onClick={onClose}>✕</button>
        </div>
        <div className="card-body">
          <div className="module-form-group">
            <label className="module-label">{t('emailTemplates.subject')} *</label>
            <input
              className="module-input"
              value={templateDraft.subject}
              onChange={e => setTemplateDraft(prev => ({ ...prev, subject: e.target.value }))}
            />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('emailTemplates.body')} *</label>
            <textarea
              className="module-input si-3f7753b6"
              rows={6}
              value={templateDraft.body}
              onChange={e => setTemplateDraft(prev => ({ ...prev, body: e.target.value }))}
            />
          </div>
          <div className="si-8d13495b">
            <button className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button
              className="module-btn primary"
              disabled={savingTemplate || !templateDraft.subject || !templateDraft.body}
              onClick={onSave}
            >
              {savingTemplate ? '⏳' : t('emailTemplates.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailTemplateEditModal

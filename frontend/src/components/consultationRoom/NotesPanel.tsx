import React from 'react'
import { useTranslation } from 'react-i18next'

interface NotesPanelProps {
  diagnosis: string
  onChangeDiagnosis: (v: string) => void
  notes: string
  onChangeNotes: (v: string) => void
  savingNotes: boolean
  notesSaved: boolean
  onSave: () => void
}

const NotesPanel: React.FC<NotesPanelProps> = ({
  diagnosis, onChangeDiagnosis, notes, onChangeNotes, savingNotes, notesSaved, onSave
}) => {
  const { t } = useTranslation()

  return (
    <div className="si-daad42f2">
      <div className="form-group">
        <label className="form-label">{t('consultationRoom.diagnosis')}</label>
        <textarea className="form-input" rows={3} placeholder={t('consultationRoom.enterDiagnosis')}
          value={diagnosis} onChange={e => onChangeDiagnosis(e.target.value)} />
      </div>
      <div className="form-group si-6acd75e8">
        <label className="form-label">{t('consultationRoom.consultationNotesLabel')}</label>
        <textarea className="form-input si-3f7753b6" rows={8}
          placeholder={t('consultationRoom.notesDocumentPlaceholder')}
          value={notes} onChange={e => onChangeNotes(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={onSave} disabled={savingNotes}>
        {savingNotes ? `⏳ ${t('consultationRoom.saving')}` : notesSaved ? `✅ ${t('consultationRoom.saved')}` : `💾 ${t('consultationRoom.saveNotes')}`}
      </button>
    </div>
  )
}

export default NotesPanel

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChatMessage } from '../../types'
import { formatDuration } from './consultationRoomShared'

interface EndedSessionViewProps {
  isCompleted: boolean
  duration: number
  recordingUrl: string | null
  conId: string
  diagnosis: string
  onChangeDiagnosis: (v: string) => void
  notes: string
  onChangeNotes: (v: string) => void
  savingNotes: boolean
  notesSaved: boolean
  onSaveNotes: () => void
  onCompleteConsultation: () => void
  messages: ChatMessage[]
  formatTime: (ts: any) => string
  onNavigate: (path: string) => void
}

const EndedSessionView: React.FC<EndedSessionViewProps> = ({
  isCompleted, duration, recordingUrl, conId, diagnosis, onChangeDiagnosis, notes, onChangeNotes,
  savingNotes, notesSaved, onSaveNotes, onCompleteConsultation, messages, formatTime, onNavigate
}) => {
  const { t } = useTranslation()

  return (
    <div className="module-page">
      <div className="si-9ae995d6">
        <div className="si-7615cf7c">{isCompleted ? '✅' : '📹'}</div>
        <h1 className="si-dab75309">{isCompleted ? t('consultationRoom.consultationCompleted') : t('consultationRoom.sessionEnded')}</h1>
        <p className="si-712f4327">
          {t('consultationRoom.duration')}: {formatDuration(duration)}
        </p>
        {isCompleted && (
          <p className="si-739c4b9c">
            {t('consultationRoom.markedAsCompleted')}
          </p>
        )}

        {/* Recording playback */}
        {recordingUrl && (
          <div className="si-ef14b2c1">
            <p className="si-c338391d">🎬 {t('consultationRoom.recordingAvailable')}</p>
            <video src={recordingUrl} controls className="si-a7540650" />
            <br />
            <a href={recordingUrl} download={`consultation-${conId}-${new Date().toISOString().slice(0, 10)}.webm`}
              className="btn btn-outline si-315b6ed5">
              ⬇️ {t('consultationRoom.downloadRecording')}
            </a>
          </div>
        )}

        {/* Notes section */}
        <div className="si-4734e5a8">
          <h3>📝 {t('consultationRoom.consultationNotes')}</h3>
          <div className="si-bab8e8bc">
            <label className="si-e334d170">{t('consultationRoom.diagnosis')}</label>
            <textarea className="form-input si-7d984748" rows={2} placeholder={t('consultationRoom.enterDiagnosis')}
              value={diagnosis} onChange={e => onChangeDiagnosis(e.target.value)}
              readOnly={isCompleted} />
          </div>
          <div className="si-bab8e8bc">
            <label className="si-e334d170">{t('consultationRoom.notes')}</label>
            <textarea className="form-input si-7d984748" rows={4} placeholder={t('consultationRoom.notesPlaceholder')}
              value={notes} onChange={e => onChangeNotes(e.target.value)}
              readOnly={isCompleted} />
          </div>
          <div className="si-d223efb3">
            {!isCompleted && (
              <>
                <button className="btn btn-outline" onClick={onSaveNotes} disabled={savingNotes}>
                  {savingNotes ? `⏳ ${t('consultationRoom.saving')}` : notesSaved ? `✅ ${t('consultationRoom.saved')}` : `💾 ${t('consultationRoom.saveNotes')}`}
                </button>
                <button className="btn btn-primary" onClick={onCompleteConsultation}>
                  ✅ {t('consultationRoom.completeConsultation')}
                </button>
                <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                  💊 {t('consultationRoom.writePrescription')}
                </button>
              </>
            )}
            {isCompleted && (
              <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                💊 {t('consultationRoom.writePrescription')}
              </button>
            )}
          </div>
        </div>

        {/* Chat transcript */}
        {messages.length > 0 && (
          <div className="si-4734e5a8">
            <h3>💬 {t('consultationRoom.chatTranscript', { count: messages.length })}</h3>
            <div className="si-cfed40cb">
              {messages.map(msg => (
                <div key={msg.id} className="si-4815af7f">
                  <strong>{msg.senderName}</strong>: {msg.message}
                  <span className="si-a69da2c2">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="si-cf8b12ae">
          <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
            {t('consultationRoom.returnToDashboard')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EndedSessionView

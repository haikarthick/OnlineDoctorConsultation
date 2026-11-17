import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { VideoSession, ChatMessage } from '../../types'
import { formatDuration } from './videoConsultationShared'

interface EndedSessionViewProps {
  session: VideoSession
  recordingUrl: string | null
  callDuration: number
  conId: string
  messages: ChatMessage[]
  prescriptions: any[]
  onNavigate: (path: string) => void
}

const EndedSessionView: React.FC<EndedSessionViewProps> = ({
  session, recordingUrl, callDuration, conId, messages, prescriptions, onNavigate
}) => {
  const { t } = useTranslation()
  const { formatTime, formatDate } = useSettings()

  return (
    <div className="module-page">
      <div className="si-bd60beb2">
        <div className="si-7615cf7c">📹</div>
        <h1 className="si-dab75309">{t('videoConsultation.ended')}</h1>
        <p className="si-712f4327">
          {t('videoConsultation.duration')}: {formatDuration(session.duration || callDuration)}
        </p>
        {(session.recordingUrl || recordingUrl) && (
          <div className="si-ef14b2c1">
            <p className="si-c338391d">
              🎬 {t('videoConsultation.recordingAvailable')}
            </p>
            {recordingUrl && (
              <>
                <video
                  src={recordingUrl}
                  controls
                  className="si-a7540650"
                />
                <br />
                <a
                  href={recordingUrl}
                  download={`consultation-${conId}-${new Date().toISOString().slice(0,10)}.webm`}
                  className="btn btn-outline si-315b6ed5"

                >
                  ⬇️ {t('videoConsultation.downloadRecording')}
                </a>
              </>
            )}
            {!recordingUrl && session.recordingUrl && (
              <p className="si-c3b93ebb">{t('videoConsultation.recordingSaved')}</p>
            )}
          </div>
        )}
        <div className="si-cf8b12ae">
          <button className="btn btn-primary" onClick={() => onNavigate('/consultations')}>
            {t('videoConsultation.viewConsultations')}
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
            {t('videoConsultation.dashboard')}
          </button>
        </div>
        {/* Chat transcript */}
        {messages.length > 0 && (
          <div className="si-969bb5a5">
            <h3 className="si-bab8e8bc">💬 {t('videoConsultation.chatTranscript')} ({messages.length} {t('videoConsultation.messages')})</h3>
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
        {/* Prescriptions */}
        {prescriptions.length > 0 && (
          <div className="si-8b56bd22">
            <h3 className="si-bab8e8bc">💊 {t('videoConsultation.prescriptions')} ({prescriptions.length})</h3>
            {prescriptions.map((rx: any) => (
              <div key={rx.id} className="si-7731684c">
                {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                  <div key={mi} className="rx-medication-item">
                    <div className="si-d1107ba4">💊 {med.name || t('videoConsultation.medication')}</div>
                    {med.dosage && <p className="si-b04aa309"><strong>{t('videoConsultation.dosage')}:</strong> {med.dosage}</p>}
                    {med.frequency && <p className="si-b04aa309"><strong>{t('videoConsultation.frequency')}:</strong> {med.frequency}</p>}
                    {med.duration && <p className="si-b04aa309"><strong>{t('videoConsultation.durationLabel')}:</strong> {med.duration}</p>}
                  </div>
                ))}
                {rx.instructions && <p className="si-4bdc4082"><strong>{t('videoConsultation.instructions')}:</strong> {rx.instructions}</p>}
                <p className="si-3341a4cc">{t('videoConsultation.validUntil')}: {rx.validUntil ? formatDate(rx.validUntil) : 'N/A'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EndedSessionView

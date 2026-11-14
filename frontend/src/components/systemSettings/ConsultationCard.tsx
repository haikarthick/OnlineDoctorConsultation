import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  show: boolean
  joinWindow: number
  setJoinWindow: (v: number) => void
  onJoinWindowChange: (minutes: number) => void
  savingJoinWindow: boolean
  joinWindowSaved: boolean
  maxDurationMinutes: number
  setMaxDurationMinutes: (v: number) => void
  savingInline: string | null
  savedInline: string | null
  onSaveInline: (key: string, value: string) => void
}

const ConsultationCard: React.FC<Props> = ({
  show, joinWindow, setJoinWindow, onJoinWindowChange, savingJoinWindow, joinWindowSaved,
  maxDurationMinutes, setMaxDurationMinutes, savingInline, savedInline, onSaveInline,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-consultation" className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">🩺 {t('systemSettings.consultationSettings')}</h2></div>
      <div className="card-body">
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.joinWindow')}</h3>
            <p className="si-faa1c026">
              {t('systemSettings.joinWindowDesc')}
            </p>
          </div>
          <div className="si-ef8e09e5">
            {[5, 10, 15, 30].map(mins => (
              <button key={mins} className={`btn btn-sm ${joinWindow === mins ? 'btn-primary' : 'btn-outline'}`}
                disabled={savingJoinWindow} onClick={() => onJoinWindowChange(mins)}>{mins} min</button>
            ))}
            <input type="number" className="form-input ss-field ss-num-input"
              value={joinWindow} min={0} max={120} disabled={savingJoinWindow}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 120) setJoinWindow(v) }}
              onBlur={() => onJoinWindowChange(joinWindow)}
              onKeyDown={e => { if (e.key === 'Enter') onJoinWindowChange(joinWindow) }} />
            {savingJoinWindow && <span className="si-48a0b045">{t('systemSettings.saving')}</span>}
            {joinWindowSaved && <span className="si-ab4fa2e9">✅ Saved!</span>}
          </div>
        </div>
        <div className="si-06d61960">
          <p className="si-baf5210b">
            <strong>Current:</strong> Join/Start available <strong>{joinWindow} minutes</strong> before appointment.
            {joinWindow === 0 && ' (0 = always available)'}
          </p>
        </div>

        {/* Max Duration */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.maxDuration')}</h3>
              <p className="si-faa1c026">{t('systemSettings.maxDurationDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[30, 45, 60, 90].map(mins => (
                <button key={mins} className={`btn btn-sm ${maxDurationMinutes === mins ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingInline === 'consultation.maxDurationMinutes'}
                  onClick={() => { setMaxDurationMinutes(mins); onSaveInline('consultation.maxDurationMinutes', String(mins)) }}>
                  {mins} min
                </button>
              ))}
              <input type="number" className="form-input ss-field ss-num-input"
                value={maxDurationMinutes} min={10} max={240}
                disabled={savingInline === 'consultation.maxDurationMinutes'}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 10 && v <= 240) setMaxDurationMinutes(v) }}
                onBlur={() => onSaveInline('consultation.maxDurationMinutes', String(maxDurationMinutes))}
                onKeyDown={e => { if (e.key === 'Enter') onSaveInline('consultation.maxDurationMinutes', String(maxDurationMinutes)) }} />
              {savingInline === 'consultation.maxDurationMinutes' && <span className="si-48a0b045">Saving...</span>}
              {savedInline === 'consultation.maxDurationMinutes' && <span className="si-ab4fa2e9">✅ Saved!</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsultationCard

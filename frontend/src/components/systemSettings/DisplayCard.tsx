import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  show: boolean
  timeFormat: '12h' | '24h'
  onTimeFormatChange: (fmt: '12h' | '24h') => void
  savingTimeFormat: boolean
  timeFormatSaved: boolean
  dateFormat: string
  setDateFormat: (v: string) => void
  savingInline: string | null
  savedInline: string | null
  onSaveInline: (key: string, value: string) => void
}

const DATE_FORMATS = ['MMM d, yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']

const DisplayCard: React.FC<Props> = ({
  show, timeFormat, onTimeFormatChange, savingTimeFormat, timeFormatSaved,
  dateFormat, setDateFormat, savingInline, savedInline, onSaveInline,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-display" className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">🕐 {t('systemSettings.displaySettings')}</h2></div>
      <div className="card-body">
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.timeFormat')}</h3>
            <p className="si-faa1c026">
              {t('systemSettings.timeFormatDesc')}
            </p>
          </div>
          <div className="si-ef8e09e5">
            <button className={`btn btn-sm ${timeFormat === '12h' ? 'btn-primary' : 'btn-outline'}`}
              disabled={savingTimeFormat} onClick={() => onTimeFormatChange('12h')}>12h (AM/PM)</button>
            <button className={`btn btn-sm ${timeFormat === '24h' ? 'btn-primary' : 'btn-outline'}`}
              disabled={savingTimeFormat} onClick={() => onTimeFormatChange('24h')}>24 Hour</button>
            {savingTimeFormat && <span className="si-48a0b045">{t('systemSettings.saving')}</span>}
            {timeFormatSaved && <span className="si-ab4fa2e9">✅ Saved!</span>}
          </div>
        </div>
        <div className="si-06d61960">
          <p className="si-baf5210b">
            <strong>Preview:</strong>{' '}
            {timeFormat === '12h'
              ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
              : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </p>
        </div>

        {/* Date Format */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.dateFormat')}</h3>
              <p className="si-faa1c026">{t('systemSettings.dateFormatDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {DATE_FORMATS.map(fmt => (
                <button key={fmt} className={`btn btn-sm ${dateFormat === fmt ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingInline === 'display.dateFormat'}
                  onClick={() => { setDateFormat(fmt); onSaveInline('display.dateFormat', fmt) }}>
                  {fmt}
                </button>
              ))}
              {savingInline === 'display.dateFormat' && <span className="si-48a0b045">Saving...</span>}
              {savedInline === 'display.dateFormat' && <span className="si-ab4fa2e9">✅ Saved!</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisplayCard

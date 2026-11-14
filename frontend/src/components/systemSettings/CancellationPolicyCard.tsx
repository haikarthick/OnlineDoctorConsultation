import React from 'react'
import { useTranslation } from 'react-i18next'

interface CancellationPolicy {
  autoRefundOnDoctorCancel: boolean
  patientFreeWindowHours: number
  partialRefundPercent: number
  partialRefundWindowHours: number
  goodwillBonusPercent: number
  doctorMaxCancellationsPerMonth: number
}

interface Props {
  show: boolean
  cancellationPolicy: CancellationPolicy
  setCancellationPolicy: (p: CancellationPolicy) => void
  savingCancellation: boolean
  cancellationSaved: boolean
  onSave: () => void
  formatCurrency: (amount: number) => string
}

const CancellationPolicyCard: React.FC<Props> = ({
  show, cancellationPolicy, setCancellationPolicy, savingCancellation, cancellationSaved, onSave, formatCurrency,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-cancellation" className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">🔄 {t('systemSettings.cancellationPolicy')}</h2></div>
      <div className="card-body">
        {/* Auto-refund on doctor cancel */}
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.autoRefund')}</h3>
            <p className="si-faa1c026">
              {t('systemSettings.autoRefundDesc')}
            </p>
          </div>
          <div className="si-bab2d193">
            <button className={`btn btn-sm ${cancellationPolicy.autoRefundOnDoctorCancel ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setCancellationPolicy({ ...cancellationPolicy, autoRefundOnDoctorCancel: true })}>✅ Enabled</button>
            <button className={`btn btn-sm ${!cancellationPolicy.autoRefundOnDoctorCancel ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setCancellationPolicy({ ...cancellationPolicy, autoRefundOnDoctorCancel: false })}>❌ Disabled</button>
          </div>
        </div>

        {/* Goodwill bonus */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.goodwillBonus')}</h3>
              <p className="si-faa1c026">{t('systemSettings.goodwillBonusDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[0, 5, 10, 15, 20].map(n => (
                <button key={n} className={`btn btn-sm ${cancellationPolicy.goodwillBonusPercent === n ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, goodwillBonusPercent: n })}>{n}%</button>
              ))}
            </div>
          </div>
        </div>

        {/* Patient free cancellation window */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.freeCancellationHours')}</h3>
              <p className="si-faa1c026">{t('systemSettings.freeCancellationHoursDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[12, 24, 48, 72].map(h => (
                <button key={h} className={`btn btn-sm ${cancellationPolicy.patientFreeWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, patientFreeWindowHours: h })}>{h}h</button>
              ))}
              <input type="number" className="form-input ss-field ss-num-input"
                value={cancellationPolicy.patientFreeWindowHours} min={1} max={168}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 168) setCancellationPolicy({ ...cancellationPolicy, patientFreeWindowHours: v }) }} />
            </div>
          </div>
        </div>

        {/* Partial refund window */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.partialRefundWindow')}</h3>
              <p className="si-faa1c026">{t('systemSettings.partialRefundWindowDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[1, 2, 4, 6].map(h => (
                <button key={h} className={`btn btn-sm ${cancellationPolicy.partialRefundWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, partialRefundWindowHours: h })}>{h}h</button>
              ))}
            </div>
          </div>
        </div>

        {/* Partial refund percentage */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.partialRefundPercent')}</h3>
              <p className="si-faa1c026">{t('systemSettings.partialRefundPercentDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[25, 50, 75].map(n => (
                <button key={n} className={`btn btn-sm ${cancellationPolicy.partialRefundPercent === n ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, partialRefundPercent: n })}>{n}%</button>
              ))}
              <input type="number" className="form-input ss-field ss-num-input"
                value={cancellationPolicy.partialRefundPercent} min={0} max={100}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 100) setCancellationPolicy({ ...cancellationPolicy, partialRefundPercent: v }) }} />
            </div>
          </div>
        </div>

        {/* Doctor max cancellations per month */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.doctorMaxCancellations')}</h3>
              <p className="si-faa1c026">0 = unlimited.</p>
            </div>
            <div className="si-ef8e09e5">
              {[0, 3, 5, 10].map(n => (
                <button key={n} className={`btn btn-sm ${cancellationPolicy.doctorMaxCancellationsPerMonth === n ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, doctorMaxCancellationsPerMonth: n })}>
                  {n === 0 ? '∞' : n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Refund policy preview */}
        <div className="si-50d6616f">
          <div className="si-e36b189a">
            <strong>📋 Policy Preview (for a {formatCurrency(1000)} consultation):</strong>
            <ul className="si-9f9227b0">
              <li>Cancel {cancellationPolicy.patientFreeWindowHours}+ hours before → <strong className="si-487e8582">{formatCurrency(1000)} full refund</strong></li>
              <li>Cancel {cancellationPolicy.partialRefundWindowHours}-{cancellationPolicy.patientFreeWindowHours} hours before → <strong className="si-cdb09cc1">{formatCurrency(cancellationPolicy.partialRefundPercent * 10)} ({cancellationPolicy.partialRefundPercent}%)</strong></li>
              <li>Cancel &lt; {cancellationPolicy.partialRefundWindowHours} hours before → <strong className="si-f84f41a5">No refund</strong></li>
              <li>Doctor cancels → <strong className="si-487e8582">{formatCurrency(1000)} + {formatCurrency(cancellationPolicy.goodwillBonusPercent * 10)} bonus ({cancellationPolicy.goodwillBonusPercent}%)</strong></li>
            </ul>
          </div>
        </div>

        <div className="si-7332b1a9">
          {cancellationSaved && <span className="si-392ff007">✅ {t('systemSettings.cancellationSaved')}</span>}
          <button className="btn btn-primary" disabled={savingCancellation} onClick={onSave}>
            {savingCancellation ? t('systemSettings.saving') : t('systemSettings.saveCancellationPolicy')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancellationPolicyCard

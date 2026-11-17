import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  show: boolean
  gatewayMode: string
  setGatewayMode: (v: string) => void
  gatewayProvider: string
  setGatewayProvider: (v: string) => void
  gatewayUrl: string
  setGatewayUrl: (v: string) => void
  gatewayApiKey: string
  setGatewayApiKey: (v: string) => void
  savingGateway: boolean
  gatewaySaved: boolean
  onSave: () => void
}

const PaymentGatewayCard: React.FC<Props> = ({
  show, gatewayMode, setGatewayMode, gatewayProvider, setGatewayProvider,
  gatewayUrl, setGatewayUrl, gatewayApiKey, setGatewayApiKey, savingGateway, gatewaySaved, onSave,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-payment" className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">💳 {t('systemSettings.paymentGateway')}</h2></div>
      <div className="card-body">
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.gatewayMode')}</h3>
            <p className="si-faa1c026">
              <strong>Demo:</strong> Simulated payments. <strong>Test:</strong> Sandbox. <strong>Live:</strong> Real processing.
            </p>
          </div>
          <div className="si-ef8e09e5">
            {(['demo', 'test', 'live'] as const).map(mode => (
              <button key={mode} className={`btn btn-sm ${gatewayMode === mode ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setGatewayMode(mode)}>
                {mode === 'demo' ? '🧪 Demo' : mode === 'test' ? '🔧 Test' : '🟢 Live'}
              </button>
            ))}
          </div>
        </div>

        {gatewayMode !== 'demo' && (
          <div className="si-50d6616f">
            <div className="si-7e460960">
              <div className="si-0f14bb0a">
                <label className="form-label si-0a803082">Provider</label>
                <select className="form-input ss-field" value={gatewayProvider} onChange={e => setGatewayProvider(e.target.value)}>
                  <option value="stripe">Stripe</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="paypal">PayPal</option>
                  <option value="square">Square</option>
                </select>
              </div>
              <div className="si-c5aba850">
                <label className="form-label si-0a803082">Gateway URL</label>
                <input className="form-input ss-field" placeholder="https://api.stripe.com/v1" value={gatewayUrl}
                  onChange={e => setGatewayUrl(e.target.value)} />
              </div>
              <div className="si-c5aba850">
                <label className="form-label si-0a803082">API Key</label>
                <input className="form-input ss-field" type="password" placeholder="sk_test_..." value={gatewayApiKey}
                  onChange={e => setGatewayApiKey(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {gatewayMode === 'demo' && (
          <div className="si-50d6616f">
            <div className="si-8638f8e4">
              ⚠️ <strong>{t('systemSettings.demoModeActive')}</strong> - {t('systemSettings.demoModeDesc')}
            </div>
          </div>
        )}

        {gatewayMode === 'live' && (
          <div className="si-50d6616f">
            <div className="si-ce0d3ed4">
              🔴 <strong>{t('systemSettings.liveMode')}</strong> - {t('systemSettings.liveModeDesc')}
            </div>
          </div>
        )}

        <div className="si-7332b1a9">
          {gatewaySaved && <span className="si-392ff007">✅ {t('systemSettings.gatewaySaved')}</span>}
          <button className="btn btn-primary" disabled={savingGateway} onClick={onSave}>
            {savingGateway ? t('systemSettings.saving') : t('systemSettings.saveGateway')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentGatewayCard

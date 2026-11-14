import React from 'react'
import { useTranslation } from 'react-i18next'

type RazorpayStatus = Record<'test' | 'live', { configured: boolean; keyId: string | null; keySecretConfigured: boolean; webhookSecretConfigured: boolean; updatedAt: string | null }>
type RazorpayForm = Record<'test' | 'live', { keyId: string; keySecret: string; webhookSecret: string }>

interface Props {
  show: boolean
  gatewayMode: string
  razorpayStatus: RazorpayStatus
  razorpayForm: RazorpayForm
  setRazorpayForm: React.Dispatch<React.SetStateAction<RazorpayForm>>
  savingRazorpay: 'test' | 'live' | null
  razorpaySaved: 'test' | 'live' | null
  onSave: (environment: 'test' | 'live') => void
  razorpayWebhookUrl: string
}

const RazorpayCredentialsCard: React.FC<Props> = ({
  show, gatewayMode, razorpayStatus, razorpayForm, setRazorpayForm, savingRazorpay, razorpaySaved, onSave, razorpayWebhookUrl,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">🔑 Razorpay Credentials</h2></div>
      <div className="card-body">
        <p className="si-5b728486">
          Used by the payment module when Gateway Mode above is <strong>Test</strong> or <strong>Live</strong>. Secrets are encrypted at rest and never shown again after saving - leave a secret field blank to keep its current value.
        </p>
        {(['test', 'live'] as const).map(env => {
          const status = razorpayStatus[env]
          const form = razorpayForm[env]
          const isActive = (env === 'test' && gatewayMode === 'test') || (env === 'live' && gatewayMode === 'live')
          return (
            <div key={env} className={env === 'live' ? 'ss-razorpay-env-live' : undefined}>
              <div className="si-61a69ccf">
                <h3 className="si-3301c332">{env === 'test' ? '🧪 Test Credentials' : '🟢 Live Credentials'}</h3>
                {isActive && <span className="si-f856b74a">ACTIVE</span>}
                {status.configured && <span className="si-07c48918">✓ configured</span>}
              </div>
              <div className="si-7e460960">
                <div className="si-556e093e">
                  <label className="form-label si-0a803082">Key Id</label>
                  <input className="form-input ss-field" placeholder={`rzp_${env}_...`} value={form.keyId}
                    onChange={e => setRazorpayForm(f => ({ ...f, [env]: { ...f[env], keyId: e.target.value } }))} />
                </div>
                <div className="si-556e093e">
                  <label className="form-label si-0a803082">Key Secret</label>
                  <input className="form-input ss-field" type="password" placeholder={status.keySecretConfigured ? '•••••••• (unchanged if left blank)' : 'Not set'} value={form.keySecret}
                    onChange={e => setRazorpayForm(f => ({ ...f, [env]: { ...f[env], keySecret: e.target.value } }))} />
                </div>
                <div className="si-556e093e">
                  <label className="form-label si-0a803082">Webhook Secret</label>
                  <input className="form-input ss-field" type="password" placeholder={status.webhookSecretConfigured ? '•••••••• (unchanged if left blank)' : 'Not set'} value={form.webhookSecret}
                    onChange={e => setRazorpayForm(f => ({ ...f, [env]: { ...f[env], webhookSecret: e.target.value } }))} />
                </div>
              </div>
              <div className="si-e735c763">
                {razorpaySaved === env && <span className="si-ab4fa2e9">✅ Saved</span>}
                <button className="btn btn-primary btn-sm" disabled={savingRazorpay === env} onClick={() => onSave(env)}>
                  {savingRazorpay === env ? t('systemSettings.saving') : `Save ${env === 'test' ? 'Test' : 'Live'} Credentials`}
                </button>
              </div>
            </div>
          )
        })}
        <div className="si-bfb0f1bd">
          <label className="form-label si-0a803082">Webhook URL (paste into Razorpay Dashboard → Webhooks)</label>
          <div className="si-d223efb3">
            <input className="form-input ss-field ss-field-readonly" readOnly value={razorpayWebhookUrl} />
            <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(razorpayWebhookUrl)}>Copy</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RazorpayCredentialsCard

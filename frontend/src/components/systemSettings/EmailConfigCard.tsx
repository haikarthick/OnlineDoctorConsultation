import React from 'react'

interface TestEmailResult {
  success: boolean
  message: string
  previewUrl?: string | null
}

interface Props {
  emailDevRedirect: string
  setEmailDevRedirect: (v: string) => void
  emailFromName: string
  setEmailFromName: (v: string) => void
  emailFromAddress: string
  setEmailFromAddress: (v: string) => void
  emailSaving: boolean
  emailSaved: boolean
  onSave: () => void
  testEmailTo: string
  setTestEmailTo: (v: string) => void
  testEmailSending: boolean
  testEmailResult: TestEmailResult | null
  onSendTestEmail: () => void
}

const EmailConfigCard: React.FC<Props> = ({
  emailDevRedirect, setEmailDevRedirect, emailFromName, setEmailFromName, emailFromAddress, setEmailFromAddress,
  emailSaving, emailSaved, onSave, testEmailTo, setTestEmailTo, testEmailSending, testEmailResult, onSendTestEmail,
}) => {
  return (
    <div className="card si-478be2e9">
      <div className="card-header">
        <h2 className="si-63c2680d">📧 Email Configuration</h2>
      </div>
      <div className="card-body">
        <div className="module-form">
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">Dev/Demo Email Redirect</label>
              <input type="email" className="module-input ss-field" value={emailDevRedirect}
                onChange={e => setEmailDevRedirect(e.target.value)}
                placeholder="test@example.com" />
              <p className="si-3341a4cc">When set, ALL outgoing emails are redirected to this address instead of the actual recipient. Use for testing.</p>
            </div>
          </div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">From Name</label>
              <input type="text" className="module-input ss-field" value={emailFromName}
                onChange={e => setEmailFromName(e.target.value)}
                placeholder="waytovet" />
            </div>
            <div className="module-form-group">
              <label className="module-label">From Address</label>
              <input type="email" className="module-input ss-field" value={emailFromAddress}
                onChange={e => setEmailFromAddress(e.target.value)}
                placeholder="noreply@waytovet.app" />
            </div>
          </div>
        </div>
        <div className="si-618178f5">
          {emailSaved && <span className="si-392ff007">✅ Saved</span>}
          <button className="btn btn-primary" disabled={emailSaving} onClick={onSave}>
            {emailSaving ? 'Saving...' : 'Save Email Settings'}
          </button>
        </div>
        <div className="si-da631b2c">
          <label className="module-label">Send Test Email</label>
          <div className="si-d4b9ebb0">
            <input type="email" className="module-input ss-field ss-flex-1" value={testEmailTo}
              onChange={e => setTestEmailTo(e.target.value)}
              placeholder="recipient@example.com" />
            <button className="btn btn-primary" disabled={testEmailSending || !testEmailTo} onClick={onSendTestEmail}>
              {testEmailSending ? 'Sending...' : '📤 Send Test'}
            </button>
          </div>
          {testEmailResult && (
            <div className={`ss-test-email-result ${testEmailResult.success ? 'is-success' : 'is-error'}`}>
              {testEmailResult.success ? '✅ ' : '❌ '}{testEmailResult.message}
              {testEmailResult.previewUrl && (
                <> - <a href={testEmailResult.previewUrl} target="_blank" rel="noopener noreferrer" className="si-215a56c7">Preview Email</a></>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailConfigCard

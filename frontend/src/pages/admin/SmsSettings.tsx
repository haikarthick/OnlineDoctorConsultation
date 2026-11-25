import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../ModulePage.css'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'

interface SettingRow { key: string; value: string | null; isSecret: boolean; isSet: boolean; description: string | null }
interface LogRow { to: string; template: string; provider: string | null; status: string; error: string | null; createdAt: string }

const PROVIDER_FIELDS: Record<string, string[]> = {
  msg91: ['sms.msg91.authKey', 'sms.msg91.senderId', 'sms.msg91.dltEntityId'],
  twilio: ['sms.twilio.accountSid', 'sms.twilio.authToken', 'sms.twilio.from'],
  log: [],
}

/**
 * Admin -> SMS Settings. Once the owner has the provider account and DLT registration, the details
 * are entered here and SMS works - no deploy. Secrets are write-only: the screen only shows whether
 * one is saved, and leaving it blank keeps it.
 */
const SmsSettings: React.FC = () => {
  const { t } = useTranslation()
  const [rows, setRows] = useState<SettingRow[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)
  const [log, setLog] = useState<LogRow[]>([])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [s, l] = await Promise.all([apiService.getSmsSettings(), apiService.getSmsLog()])
      setRows(s.data?.settings || [])
      setLog(l.data?.items || [])
      setEdits({})
    } catch (err) {
      setError(userMessage(err, 'smsSettings.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const byKey = useMemo(() => Object.fromEntries(rows.map(r => [r.key, r])), [rows])
  const valueOf = (key: string): string => (key in edits ? edits[key] : (byKey[key]?.value ?? ''))
  const set = (key: string, v: string) => { setEdits(prev => ({ ...prev, [key]: v })); setMessage('') }
  const enabled = valueOf('sms.enabled') === 'true'
  const provider = valueOf('sms.provider') || 'msg91'
  const dirty = Object.keys(edits).length > 0

  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      await apiService.saveSmsSettings(edits)
      setMessage(t('smsSettings.saved'))
      await load()
    } catch (err) {
      setError(userMessage(err, 'smsSettings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    setTesting(true); setTestResult(''); setError('')
    try {
      const res = await apiService.testSms(testTo)
      const o = res.data || {}
      setTestResult(
        o.status === 'sent' ? t('smsSettings.testSent')
          : o.status === 'logged' ? t('smsSettings.testLogged')
            : o.status === 'skipped' ? t('smsSettings.testSkipped', { reason: o.reason || '' })
              : t('smsSettings.testFailed', { reason: o.reason || '' }),
      )
      const l = await apiService.getSmsLog()
      setLog(l.data?.items || [])
    } catch (err) {
      setError(userMessage(err, 'smsSettings.testError'))
    } finally {
      setTesting(false)
    }
  }

  const field = (key: string, labelKey: string, opts: { multiline?: boolean } = {}) => {
    const row = byKey[key]
    const secret = !!row?.isSecret
    return (
      <div className="form-group" key={key}>
        <label htmlFor={key}>{t(labelKey)}</label>
        {opts.multiline ? (
          <textarea id={key} className="module-input" rows={3} value={valueOf(key)} onChange={e => set(key, e.target.value)} />
        ) : (
          <input
            id={key} className="module-input" type={secret ? 'password' : 'text'} autoComplete="off"
            value={valueOf(key)} onChange={e => set(key, e.target.value)}
            placeholder={secret ? (row?.isSet ? t('smsSettings.secretSet') : t('smsSettings.secretNotSet')) : ''}
          />
        )}
        {secret && <small className="field-hint">{row?.isSet ? t('smsSettings.secretSet') : t('smsSettings.secretNotSet')}</small>}
      </div>
    )
  }

  if (loading) return <div className="module-page"><div className="loading-spinner">{t('smsSettings.loading')}</div></div>

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('smsSettings.title')}</h1>
          <p className="subtitle">{t('smsSettings.subtitle')}</p>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}

      <div className={`sms-status ${enabled ? 'is-on' : 'is-off'}`} role="status">
        {enabled ? t('smsSettings.statusOn') : t('smsSettings.statusOff')}
      </div>
      <p className="field-hint">{t('smsSettings.dltNote')}</p>

      <section className="card sms-card">
        <label className="sms-switch">
          <input type="checkbox" checked={enabled} onChange={e => set('sms.enabled', e.target.checked ? 'true' : 'false')} />
          <span>{t('smsSettings.enable')}</span>
        </label>
        <div className="form-group">
          <label htmlFor="sms-provider">{t('smsSettings.provider')}</label>
          <select id="sms-provider" className="module-input" value={provider} onChange={e => set('sms.provider', e.target.value)}>
            {Object.keys(PROVIDER_FIELDS).map(p => <option key={p} value={p}>{t(`smsSettings.providers.${p}`)}</option>)}
          </select>
        </div>
        {PROVIDER_FIELDS[provider]?.map(k => field(k, `smsSettings.fields.${k.replace('sms.', '').replace('.', '_')}`))}
        {field('sms.defaultCountryCode', 'smsSettings.fields.defaultCountryCode')}
      </section>

      <section className="card sms-card">
        <h2 className="sms-section-title">{t('smsSettings.templateTitle')}</h2>
        {provider === 'msg91' && field('sms.template.farm_invite.id', 'smsSettings.fields.templateId')}
        {provider === 'twilio' && field('sms.template.farm_invite.text', 'smsSettings.fields.templateText', { multiline: true })}
        <p className="field-hint">{t('smsSettings.templateHint')}</p>
      </section>

      <div className="sms-actions">
        <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={save}>
          {saving ? t('smsSettings.saving') : t('smsSettings.save')}
        </button>
        {dirty && <span className="field-hint">{t('smsSettings.unsaved')}</span>}
      </div>

      <section className="card sms-card">
        <h2 className="sms-section-title">{t('smsSettings.testTitle')}</h2>
        <p className="field-hint">{t('smsSettings.testHint')}</p>
        <div className="form-group">
          <label htmlFor="sms-test-to">{t('smsSettings.testNumber')}</label>
          <input id="sms-test-to" className="module-input" inputMode="tel" autoComplete="off" value={testTo} onChange={e => { setTestTo(e.target.value); setTestResult('') }} placeholder="98765 43210" />
        </div>
        <button type="button" className="btn btn-secondary" disabled={!testTo.trim() || testing || dirty} onClick={sendTest}>
          {testing ? t('smsSettings.saving') : t('smsSettings.testSend')}
        </button>
        {dirty && <p className="field-hint">{t('smsSettings.saveFirst')}</p>}
        {testResult && <p className="sms-test-result" role="status">{testResult}</p>}
      </section>

      <section className="card sms-card">
        <h2 className="sms-section-title">{t('smsSettings.logTitle')}</h2>
        {log.length === 0 ? <p className="field-hint">{t('smsSettings.logEmpty')}</p> : (
          <div className="sms-log">
            {log.map((l, i) => (
              <div key={`${l.createdAt}-${i}`} className="sms-log-row">
                <span className="sms-log-when">{new Date(l.createdAt).toLocaleString(appLocale())}</span>
                <span>{l.to}</span>
                <span className={`sms-log-status is-${l.status}`}>{t(`smsSettings.statuses.${l.status}`)}</span>
                {l.error && <span className="sms-log-error">{l.error}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default SmsSettings

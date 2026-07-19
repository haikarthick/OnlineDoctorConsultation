import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface DoctorRow {
  id: string
  name: string
  email: string
  consultationFee: number | null
  emergencyFee: number | null
  commissionPercentOverride: number | null
  commissionFlatOverride: number | null
}

interface CommissionSettingsProps {
  onNavigate?: (path: string) => void
}

/**
 * Admin → Payments & Finance → Commission Rules (plan §5, §10 item 2).
 * Global default % + flat live in System Settings (commission.* keys);
 * this screen manages per-doctor overrides with an audit-logged save.
 */
const CommissionSettings: React.FC<CommissionSettingsProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [edits, setEdits] = useState<Record<string, { pct: string; flat: string }>>({})
  const [globals, setGlobals] = useState<{ percent: string; flat: string }>({ percent: '15', flat: '20' })
  const [taxCodes, setTaxCodes] = useState<any[]>([])
  const [taxEdits, setTaxEdits] = useState<Record<string, string>>({})
  const [taxBusy, setTaxBusy] = useState<string | null>(null)
  const [gstFrom, setGstFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [gstTo, setGstTo] = useState(() => new Date().toISOString().split('T')[0])

  const loadTaxCodes = useCallback(async () => {
    try {
      const resp: any = await apiService.adminListTaxCodes()
      const list = Array.isArray(resp?.data) ? resp.data : []
      setTaxCodes(list)
      const e: Record<string, string> = {}
      for (const tc of list) e[tc.sacCode] = String(tc.ratePercent)
      setTaxEdits(e)
    } catch { setTaxCodes([]) }
  }, [])

  const saveTaxRate = useCallback(async (sacCode: string) => {
    try {
      setTaxBusy(sacCode)
      setMessage('')
      await apiService.adminUpdateTaxCode(sacCode, parseFloat(taxEdits[sacCode]))
      setMessage(t('taxAdmin.rateSaved'))
      await loadTaxCodes()
    } catch (err: any) {
      setMessage(err.response?.data?.error || t('taxAdmin.rateSaveFailed'))
    } finally { setTaxBusy(null) }
  }, [taxEdits, loadTaxCodes, t])

  const downloadGst = useCallback(async () => {
    try {
      const blob = await apiService.adminDownloadGstExport(gstFrom, gstTo)
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `gst-export-${gstFrom}-to-${gstTo}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setMessage(t('taxAdmin.exportFailed')) }
  }, [gstFrom, gstTo, t])

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const resp: any = await apiService.adminListCommissionDoctors(q)
      const list = Array.isArray(resp?.data) ? resp.data : []
      setDoctors(list)
      const e: Record<string, { pct: string; flat: string }> = {}
      for (const d of list) {
        e[d.id] = {
          pct: d.commissionPercentOverride === null || d.commissionPercentOverride === undefined ? '' : String(d.commissionPercentOverride),
          flat: d.commissionFlatOverride === null || d.commissionFlatOverride === undefined ? '' : String(d.commissionFlatOverride),
        }
      }
      setEdits(e)
    } catch { setDoctors([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); loadTaxCodes() }, [load, loadTaxCodes])

  useEffect(() => {
    // Show the current global defaults for context (read-only here; edited in System Settings)
    apiService.adminGetSettings()
      .then((resp: any) => {
        const settings = resp?.data || resp || []
        const arr = Array.isArray(settings) ? settings : (settings.settings || [])
        const find = (k: string) => arr.find((s: any) => s.key === k)?.value
        setGlobals({ percent: find('commission.defaultPercent') || '15', flat: find('commission.flatFee') || '20' })
      })
      .catch(() => {})
  }, [])

  const save = useCallback(async (doctorId: string) => {
    const e = edits[doctorId]
    if (!e) return
    try {
      setSavingId(doctorId)
      setMessage('')
      await apiService.adminUpdateCommissionOverride(doctorId, {
        commissionPercentOverride: e.pct.trim() === '' ? null : parseFloat(e.pct),
        commissionFlatOverride: e.flat.trim() === '' ? null : parseFloat(e.flat),
      })
      setMessage(t('commissionAdmin.saved'))
      await load(search)
    } catch (err: any) {
      setMessage(err.response?.data?.error || t('commissionAdmin.saveFailed'))
    } finally {
      setSavingId(null)
    }
  }, [edits, load, search, t])

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('commissionAdmin.title')}</h1>
          <p className="page-subtitle">{t('commissionAdmin.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate && onNavigate('/admin/settings')}>
            {t('commissionAdmin.globalSettings')}
          </button>
        </div>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
        {t('commissionAdmin.globalInfo', { percent: globals.percent, flat: formatCurrency(parseFloat(globals.flat) || 0) })}
      </div>

      {message && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(search) }}
          placeholder={t('commissionAdmin.searchPlaceholder')}
          style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px' }}
        />
        <button className="btn btn-primary" onClick={() => load(search)}>{t('common.search')}</button>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : doctors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#6b7280' }}>{t('commissionAdmin.noDoctors')}</div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>{t('commissionAdmin.colDoctor')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('commissionAdmin.colFee')}</th>
                  <th style={{ padding: '10px 14px' }}>{t('commissionAdmin.colPercentOverride')}</th>
                  <th style={{ padding: '10px 14px' }}>{t('commissionAdmin.colFlatOverride')}</th>
                  <th style={{ padding: '10px 14px' }}></th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ color: '#9ca3af', fontSize: 12 }}>{d.email}</div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatCurrency(parseFloat(String(d.consultationFee || 0)))}
                      {d.emergencyFee ? <div style={{ color: '#b45309', fontSize: 11 }}>⚡ {formatCurrency(parseFloat(String(d.emergencyFee)))}</div> : null}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={edits[d.id]?.pct ?? ''}
                        placeholder={`${globals.percent}%`}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], pct: e.target.value } }))}
                        style={{ width: 90, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px' }}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="number" min={0} step={1}
                        value={edits[d.id]?.flat ?? ''}
                        placeholder={globals.flat}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], flat: e.target.value } }))}
                        style={{ width: 90, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px' }}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: 13 }}
                        onClick={() => save(d.id)}
                        disabled={savingId === d.id}
                      >
                        {savingId === d.id ? t('common.loading') : t('common.save')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 12 }}>{t('commissionAdmin.snapshotNote')}</p>

      {/* ── Tax & GST (D13 — rates fully admin-configurable) ── */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 4 }}>{t('taxAdmin.title')}</h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>{t('taxAdmin.subtitle')}</p>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>SAC</th>
                  <th style={{ padding: '10px 14px' }}>{t('taxAdmin.colLabel')}</th>
                  <th style={{ padding: '10px 14px' }}>{t('taxAdmin.colRate')}</th>
                  <th style={{ padding: '10px 14px' }}></th>
                </tr>
              </thead>
              <tbody>
                {taxCodes.map((tc) => (
                  <tr key={tc.sacCode} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{tc.sacCode}</td>
                    <td style={{ padding: '10px 14px' }}>{tc.label}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <input type="number" min={0} max={100} step={0.5}
                        value={taxEdits[tc.sacCode] ?? ''}
                        onChange={(e) => setTaxEdits((prev) => ({ ...prev, [tc.sacCode]: e.target.value }))}
                        style={{ width: 80, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px' }} />
                      <span style={{ marginLeft: 4 }}>%</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}
                        disabled={taxBusy === tc.sacCode} onClick={() => saveTaxRate(tc.sacCode)}>
                        {taxBusy === tc.sacCode ? t('common.loading') : t('common.save')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>{t('taxAdmin.exportTitle')}</strong>
          <input type="date" value={gstFrom} onChange={(e) => setGstFrom(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px' }} />
          <span>→</span>
          <input type="date" value={gstTo} onChange={(e) => setGstTo(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px' }} />
          <button className="btn btn-outline" onClick={downloadGst}>{t('taxAdmin.exportButton')}</button>
        </div>
        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 10 }}>{t('taxAdmin.settingsHint')}</p>
      </div>
    </div>
  )
}

export default CommissionSettings

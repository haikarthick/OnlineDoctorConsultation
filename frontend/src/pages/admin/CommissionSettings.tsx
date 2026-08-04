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
      .catch(() => setMessage(t('commissionAdmin.globalsLoadFailed')))
  }, [t])

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

      <div className="si-a0bcd0db">
        {t('commissionAdmin.globalInfo', { percent: globals.percent, flat: formatCurrency(parseFloat(globals.flat) || 0) })}
      </div>

      {message && (
        <div className="si-320cf962">
          {message}
        </div>
      )}

      <div className="si-b4c62bf9">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(search) }}
          placeholder={t('commissionAdmin.searchPlaceholder')}
          className="si-620e16a1"
        />
        <button className="btn btn-primary" onClick={() => load(search)}>{t('common.search')}</button>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : doctors.length === 0 ? (
        <div className="si-8fce2994">{t('commissionAdmin.noDoctors')}</div>
      ) : (
        <div className="si-0b7c8512">
          <div className="si-9aa6c55f">
            <table className="si-ec76dd85">
              <thead>
                <tr className="si-321a0f36">
                  <th className="si-37f3ee27">{t('commissionAdmin.colDoctor')}</th>
                  <th className="si-7e6dbf07">{t('commissionAdmin.colFee')}</th>
                  <th className="si-37f3ee27">{t('commissionAdmin.colPercentOverride')}</th>
                  <th className="si-37f3ee27">{t('commissionAdmin.colFlatOverride')}</th>
                  <th className="si-37f3ee27"></th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id} className="si-c20fa118">
                    <td className="si-37f3ee27">
                      <div className="si-b2cfcbec">{d.name}</div>
                      <div className="si-3f4bbe41">{d.email}</div>
                    </td>
                    <td className="si-048cfa66">
                      {formatCurrency(parseFloat(String(d.consultationFee || 0)))}
                      {d.emergencyFee ? <div className="si-55234acc">⚡ {formatCurrency(parseFloat(String(d.emergencyFee)))}</div> : null}
                    </td>
                    <td className="si-37f3ee27">
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={edits[d.id]?.pct ?? ''}
                        placeholder={`${globals.percent}%`}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], pct: e.target.value } }))}
                        className="si-76a9c4f7"
                      />
                    </td>
                    <td className="si-37f3ee27">
                      <input
                        type="number" min={0} step={1}
                        value={edits[d.id]?.flat ?? ''}
                        placeholder={globals.flat}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], flat: e.target.value } }))}
                        className="si-76a9c4f7"
                      />
                    </td>
                    <td className="si-37f3ee27">
                      <button
                        className="btn btn-primary si-efbe533c"
                       
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

      <p className="si-5a747b21">{t('commissionAdmin.snapshotNote')}</p>

      {/* ── Tax & GST (D13 - rates fully admin-configurable) ── */}
      <div className="si-789c0fab">
        <h2 className="si-e57614ee">{t('taxAdmin.title')}</h2>
        <p className="si-ea95bef1">{t('taxAdmin.subtitle')}</p>

        <div className="si-6d867bc6">
          <div className="si-9aa6c55f">
            <table className="si-ec76dd85">
              <thead>
                <tr className="si-321a0f36">
                  <th className="si-37f3ee27">SAC</th>
                  <th className="si-37f3ee27">{t('taxAdmin.colLabel')}</th>
                  <th className="si-37f3ee27">{t('taxAdmin.colRate')}</th>
                  <th className="si-37f3ee27"></th>
                </tr>
              </thead>
              <tbody>
                {taxCodes.map((tc) => (
                  <tr key={tc.sacCode} className="si-c20fa118">
                    <td className="si-674357ac">{tc.sacCode}</td>
                    <td className="si-37f3ee27">{tc.label}</td>
                    <td className="si-37f3ee27">
                      <input type="number" min={0} max={100} step={0.5}
                        value={taxEdits[tc.sacCode] ?? ''}
                        onChange={(e) => setTaxEdits((prev) => ({ ...prev, [tc.sacCode]: e.target.value }))}
                        className="si-4de231f8" />
                      <span className="si-12f273ab">%</span>
                    </td>
                    <td className="si-37f3ee27">
                      <button className="btn btn-primary si-efbe533c"
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

        <div className="si-f554cf3f">
          <strong className="si-0a803082">{t('taxAdmin.exportTitle')}</strong>
          <input type="date" value={gstFrom} onChange={(e) => setGstFrom(e.target.value)}
            className="si-676bd163" />
          <span>→</span>
          <input type="date" value={gstTo} onChange={(e) => setGstTo(e.target.value)}
            className="si-676bd163" />
          <button className="btn btn-outline" onClick={downloadGst}>{t('taxAdmin.exportButton')}</button>
        </div>
        <p className="si-afe6b95d">{t('taxAdmin.settingsHint')}</p>
      </div>
    </div>
  )
}

export default CommissionSettings

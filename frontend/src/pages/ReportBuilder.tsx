import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, ReportTemplate, GeneratedReport } from '../types'
import { useTranslation } from 'react-i18next'

const REPORT_TYPES = [
  { value: 'animal_census', label: '🐄 Animal Census', desc: 'Comprehensive animal inventory by species, breed, gender' },
  { value: 'health_summary', label: '🏥 Health Summary', desc: 'Health observations, resolution rates, severity analysis' },
  { value: 'financial_summary', label: '💰 Financial Summary', desc: 'Income vs expenses by category over time' },
  { value: 'breeding_report', label: '🧬 Breeding Report', desc: 'Breeding outcomes, pregnancy rates, offspring stats' },
  { value: 'compliance_audit', label: '📋 Compliance Audit', desc: 'Document verification status, expiring certifications' },
  { value: 'task_performance', label: '👷 Task Performance', desc: 'Worker productivity, completion rates, overdue analysis' },
  { value: 'sensor_analytics', label: '📡 Sensor Analytics', desc: 'IoT sensor readings, anomalies, averages across devices' }
]

const ReportBuilderPage: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'generate' | 'history' | 'view' | 'templates'>('generate')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [genForm, setGenForm] = useState({
    reportType: 'animal_census', name: '', format: 'json', days: '90', months: '12'
  })
  const [templateForm, setTemplateForm] = useState({
    name: '', description: '', reportType: 'animal_census'
  })

  useEffect(() => {
    const f = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    f()
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [tplRes, repRes] = await Promise.all([
        apiService.listReportTemplates(selectedEnterpriseId),
        apiService.listGeneratedReports(selectedEnterpriseId)
      ])
      setTemplates(tplRes.data?.items || [])
      setReports(repRes.data?.items || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    setGenerating(true)
    try {
      const result = await apiService.generateReport(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, reportType: genForm.reportType,
        name: genForm.name || `${genForm.reportType} - ${new Date().toLocaleDateString()}`,
        format: genForm.format,
        parameters: { days: parseInt(genForm.days) || 90, months: parseInt(genForm.months) || 12 }
      })
      setSuccessMsg(t('reportBuilder.reportGenerated'))
      const report = result.data
      if (report) { setSelectedReport(report); setTab('view') }
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('reportBuilder.failedGenerate')) }
    finally { setGenerating(false) }
  }

  const handleViewReport = async (id: string) => {
    try {
      const res = await apiService.getReport(id)
      setSelectedReport(res.data || null)
      setTab('view')
    } catch { setError(t('common.failedToLoad')) }
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    try {
      await apiService.createReportTemplate(selectedEnterpriseId, {
        enterpriseId: selectedEnterpriseId, name: templateForm.name,
        description: templateForm.description || undefined, reportType: templateForm.reportType
      })
      setSuccessMsg(t('reportBuilder.templateCreated'))
      setShowTemplateForm(false)
      setTemplateForm({ name: '', description: '', reportType: 'animal_census' })
      fetchData()
    } catch (err: any) { setError(err.response?.data?.error?.message || t('common.failedToSave')) }
  }

  const handleDeleteReport = async (id: string) => {
    try { await apiService.deleteReport(id); setSuccessMsg(t('reportBuilder.reportDeleted')); fetchData() }
    catch { setError(t('common.failedToDelete')) }
  }

  const renderReportData = (report: GeneratedReport) => {
    const data = report.resultData || (report as any).result_data
    if (!data || data.error) return <div className="alert alert-error">{data?.error || 'No data'}</div>

    const rows = data.rows || []
    if (!rows.length) return <div className="empty-state">{t('reportBuilder.noDataRows')}</div>

    const columns = Object.keys(rows[0])
    return (
      <div>
        <div className="card-stats si-1cb81cae">
          <div>Rows: <strong>{data.totalRows || rows.length}</strong></div>
          {data.period && <div>Period: <strong>{data.period}</strong></div>}
          {data.reportDate && <div>Date: <strong>{new Date(data.reportDate).toLocaleDateString()}</strong></div>}
        </div>
        <div className="si-9aa6c55f">
          <table className="data-table">
            <thead><tr>{columns.map(c => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>
              {rows.map((row: any, i: number) => (
                <tr key={i}>{columns.map(c => <td key={c}>{typeof row[c] === 'number' ? (+row[c]).toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(row[c] ?? '-')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const typeInfo = (type: string) => REPORT_TYPES.find(t => t.value === type)

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('reportBuilder.pageTitle')}</h1>
        <p>{t('reportBuilder.subtitle')}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>{t('common.selectEnterprise')}:</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('common.selectOption')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!selectedEnterpriseId ? (
        <div className="empty-state">{t('reportBuilder.selectEnterprise')}</div>
      ) : loading ? (
        <div className="loading-spinner">{t('reportBuilder.loading')}</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab === 'generate' ? 'tab-active' : ''} onClick={() => setTab('generate')}>{t('reportBuilder.tabs.generate')}</button>
            <button className={tab === 'history' ? 'tab-active' : ''} onClick={() => setTab('history')}>{t('reportBuilder.tabs.history')}</button>
            <button className={tab === 'view' ? 'tab-active' : ''} onClick={() => setTab('view')}>{t('reportBuilder.tabs.view')}</button>
            <button className={tab === 'templates' ? 'tab-active' : ''} onClick={() => setTab('templates')}>{t('reportBuilder.tabs.templates')}</button>
          </div>

          {tab === 'generate' && (
            <div>
              <h2 className="si-1e52b2bd">{t('reportBuilder.selectReportType')}</h2>
              <div className="cards-grid">
                {REPORT_TYPES.map(rt => (
                  <div key={rt.value} className={`card ${genForm.reportType === rt.value ? 'card-selected' : ''}`}
                    onClick={() => setGenForm({ ...genForm, reportType: rt.value })}
                    style={{ cursor: 'pointer', border: genForm.reportType === rt.value ? '2px solid #3b82f6' : undefined }}>
                    <h3>{rt.label}</h3>
                    <p className="card-note">{rt.desc}</p>
                  </div>
                ))}
              </div>

              <form className="module-form si-70453e1a" onSubmit={handleGenerate}>
                <div className="form-grid">
                  <div className="form-group"><label>{t('reportBuilder.reportName')}</label><input value={genForm.name} onChange={e => setGenForm({ ...genForm, name: e.target.value })} placeholder="Auto-generated if empty" /></div>
                  <div className="form-group"><label>{t('reportBuilder.format')}</label>
                    <select value={genForm.format} onChange={e => setGenForm({ ...genForm, format: e.target.value })}>
                      <option value="json">JSON</option><option value="csv">CSV</option><option value="pdf">PDF</option>
                    </select>
                  </div>
                  <div className="form-group"><label>{t('reportBuilder.days')}</label><input type="number" value={genForm.days} onChange={e => setGenForm({ ...genForm, days: e.target.value })} /></div>
                  <div className="form-group"><label>{t('reportBuilder.months')}</label><input type="number" value={genForm.months} onChange={e => setGenForm({ ...genForm, months: e.target.value })} /></div>
                </div>
                <button type="submit" className="btn-primary" disabled={generating}>
                  {generating ? `⏳ ${t('reportBuilder.generating')}` : `🚀 ${t('reportBuilder.tabs.generate')}`}
                </button>
              </form>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <table className="data-table">
                <thead><tr><th>{t('common.name')}</th><th>{t('common.type')}</th><th>{t('reportBuilder.format')}</th><th>{t('reportBuilder.rows')}</th><th>{t('reportBuilder.generated')}</th><th>{t('common.actions')}</th></tr></thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td><span className="badge">{typeInfo(r.reportType || (r as any).report_type)?.label || r.reportType || (r as any).report_type}</span></td>
                      <td>{r.format}</td>
                      <td>{r.rowCount || (r as any).row_count || 0}</td>
                      <td>{(r.generatedAt || (r as any).generated_at) ? new Date(r.generatedAt || (r as any).generated_at).toLocaleString() : '-'}</td>
                      <td>
                        <button className="btn-sm" onClick={() => handleViewReport(r.id)}>{t('common.view')}</button>
                        <button className="btn-sm btn-danger si-fd5a3e17" onClick={() => handleDeleteReport(r.id)}>{t('common.delete')}</button>
                      </td>
                    </tr>
                  ))}
                  {!reports.length && <tr><td colSpan={6} className="empty-cell">{t('reportBuilder.noReports')}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'view' && (
            <div>
              {selectedReport ? (
                <div>
                  <div className="card full-width si-1cb81cae">
                    <h2>{selectedReport.name}</h2>
                    <div className="card-meta">
                      <span className="badge">{typeInfo(selectedReport.reportType || (selectedReport as any).report_type)?.label || selectedReport.reportType}</span>
                      <span className="badge">{selectedReport.format?.toUpperCase()}</span>
                      <span>Generated: {(selectedReport.generatedAt || (selectedReport as any).generated_at) ? new Date(selectedReport.generatedAt || (selectedReport as any).generated_at).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                  {renderReportData(selectedReport)}
                </div>
              ) : (
                <div className="empty-state">{t('reportBuilder.selectReport')}</div>
              )}
            </div>
          )}

          {tab === 'templates' && (
            <div>
              <div className="section-toolbar">
                <button className="btn-primary" onClick={() => setShowTemplateForm(!showTemplateForm)}>
                  {showTemplateForm ? t('common.cancel') : t('reportBuilder.createTemplate')}
                </button>
              </div>

              {showTemplateForm && (
                <form className="module-form" onSubmit={handleCreateTemplate}>
                  <div className="form-grid">
                    <div className="form-group"><label>{t('common.name')} *</label><input required value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} /></div>
                    <div className="form-group"><label>{t('reportBuilder.reportType')}</label>
                      <select value={templateForm.reportType} onChange={e => setTemplateForm({ ...templateForm, reportType: e.target.value })}>
                        {REPORT_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group full-width"><label>{t('common.description')}</label><textarea value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn-primary">{t('reportBuilder.createTemplate')}</button>
                </form>
              )}

              <div className="cards-grid">
                {templates.map(tpl => (
                  <div key={tpl.id} className="card">
                    <h3>{tpl.name}</h3>
                    <div className="card-meta">
                      <span className="badge">{typeInfo(tpl.reportType || (tpl as any).report_type)?.label || tpl.reportType || (tpl as any).report_type}</span>
                      {(tpl.isSystem || (tpl as any).is_system) && <span className="badge badge-system">System</span>}
                    </div>
                    {tpl.description && <p className="card-note">{tpl.description}</p>}
                  </div>
                ))}
                {!templates.length && <div className="empty-state">{t('reportBuilder.noTemplates')}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ReportBuilderPage

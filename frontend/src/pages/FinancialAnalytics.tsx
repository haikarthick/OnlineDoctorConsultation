import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { useSettings } from '../context/SettingsContext'
import { Enterprise, FinancialRecord, FinancialDashboard } from '../types'
import { useTranslation } from 'react-i18next'
import { useScrollToForm } from '../hooks/useScrollToForm'

const TYPE_COLORS: Record<string, string> = { income: '#22c55e', expense: '#ef4444' }

const CATEGORIES = {
  income: ['animal_sales', 'milk_sales', 'egg_sales', 'meat_sales', 'breeding_fees', 'consultation_fees', 'grants', 'subsidies', 'other_income'],
  expense: ['feed', 'veterinary', 'medication', 'equipment', 'labor', 'utilities', 'transport', 'insurance', 'maintenance', 'rent', 'taxes', 'marketing', 'other_expense']
}

const FinancialAnalytics: React.FC = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'records'>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    recordType: 'expense' as 'income' | 'expense', category: 'feed',
    amount: '', description: '', referenceNumber: '',
    transactionDate: new Date().toISOString().split('T')[0], notes: ''
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const fetchEnterprises = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    fetchEnterprises()
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [recRes, dashRes] = await Promise.all([
        apiService.listFinancialRecords(selectedEnterpriseId),
        apiService.getFinancialDashboard(selectedEnterpriseId)
      ])
      setRecords(recRes.data?.items || [])
      setDashboard(dashRes.data || null)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId,
      ...formData,
      amount: parseFloat(formData.amount),
    }
    try {
      if (editingId) {
        await apiService.updateFinancialRecord(editingId, payload)
        setSuccessMsg(t('financialAnalytics.toasts.recordUpdated'))
      } else {
        await apiService.createFinancialRecord(selectedEnterpriseId, payload)
        setSuccessMsg(t('financialAnalytics.toasts.recordCreated'))
      }
      setShowForm(false); setEditingId(null)
      resetForm()
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('financialAnalytics.toasts.saveFailed'))
    }
  }

  const resetForm = () => setFormData({ recordType: 'expense', category: 'feed', amount: '', description: '', referenceNumber: '', transactionDate: new Date().toISOString().split('T')[0], notes: '' })

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('financialAnalytics.deleteConfirm'))) return
    try {
      await apiService.deleteFinancialRecord(id)
      setSuccessMsg(t('financialAnalytics.toasts.recordDeleted'))
      fetchData()
    } catch { setError(t('financialAnalytics.toasts.deleteFailed')) }
  }

  const startEdit = (rec: FinancialRecord) => {
    setEditingId(rec.id)
    setFormData({
      recordType: rec.recordType, category: rec.category,
      amount: rec.amount.toString(), description: rec.description || '',
      referenceNumber: rec.referenceNumber || '',
      transactionDate: rec.transactionDate?.split('T')[0] || '', notes: rec.notes || ''
    })
    setShowForm(true)
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('financialAnalytics.pageTitle')}</h1>
        <p>{t('financialAnalytics.subtitle')}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>{t('financialAnalytics.selectEnterprise')}</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('financialAnalytics.selectDefault')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>{t('financialAnalytics.tabs.dashboard')}</button>
            <button className={`tab-btn ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>{t('financialAnalytics.tabs.records')}</button>
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm() }}>{t('financialAnalytics.addRecord')}</button>
          </div>

          {showForm && <div className="edit-form-overlay" onClick={() => { setShowForm(false); setEditingId(null) }} />}
          {showForm && (
            <div ref={formRef} className="edit-form-panel">
            <form className="module-form" onSubmit={handleSubmit}>
              <h3>{editingId ? t('financialAnalytics.form.editTitle') : t('financialAnalytics.form.createTitle')}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('financialAnalytics.form.type')}</label>
                  <select value={formData.recordType} onChange={e => setFormData({ ...formData, recordType: e.target.value as 'income' | 'expense', category: CATEGORIES[e.target.value as 'income' | 'expense'][0] })}>
                    <option value="income">{t('financialAnalytics.form.income')}</option>
                    <option value="expense">{t('financialAnalytics.form.expense')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('financialAnalytics.form.category')}</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    {CATEGORIES[formData.recordType].map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('financialAnalytics.form.amount')}</label>
                  <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('financialAnalytics.form.date')}</label>
                  <input type="date" required value={formData.transactionDate} onChange={e => setFormData({ ...formData, transactionDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('financialAnalytics.form.description')}</label>
                  <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('financialAnalytics.form.reference')}</label>
                  <input value={formData.referenceNumber} onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>{t('financialAnalytics.form.notes')}</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingId ? t('common.update') : t('financialAnalytics.addRecord')}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>{t('common.cancel')}</button>
              </div>
            </form>
            </div>
          )}

          {loading ? <p className="loading-text">{t('common.loading')}</p> : tab === 'dashboard' && dashboard ? (
            <div className="dashboard-grid">
              {/* Summary cards */}
              <div className="card">
                <h3>{t('financialAnalytics.dashboard.totalIncome')}</h3>
                <div className="big-stat success">{formatCurrency(dashboard.totalIncome || 0)}</div>
              </div>
              <div className="card">
                <h3>{t('financialAnalytics.dashboard.totalExpenses')}</h3>
                <div className="big-stat danger">{formatCurrency(dashboard.totalExpenses || 0)}</div>
              </div>
              <div className="card">
                <h3>{t('financialAnalytics.dashboard.netProfit')}</h3>
                <div className={`big-stat ${Number(dashboard.netProfit) >= 0 ? 'success' : 'danger'}`}>
                  {formatCurrency(dashboard.netProfit || 0)}
                </div>
              </div>

              {/* Monthly Breakdown */}
              <div className="card full-width">
                <h3>{t('financialAnalytics.dashboard.monthlyBreakdown')}</h3>
                {(dashboard.monthlyBreakdown || []).length === 0 ? <p className="empty-text">{t('financialAnalytics.dashboard.noData')}</p> : (
                  <table className="data-table compact">
                    <thead><tr><th>{t('financialAnalytics.dashboard.headers.month')}</th><th>{t('financialAnalytics.dashboard.headers.income')}</th><th>{t('financialAnalytics.dashboard.headers.expenses')}</th><th>{t('financialAnalytics.dashboard.headers.profit')}</th></tr></thead>
                    <tbody>
                      {(dashboard.monthlyBreakdown || []).map(m => (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td className="text-success">{formatCurrency(m.income)}</td>
                          <td className="text-danger">{formatCurrency(m.expenses)}</td>
                          <td className={Number(m.profit) >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(m.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Expenses */}
              <div className="card">
                <h3>{t('financialAnalytics.dashboard.topExpenses')}</h3>
                <table className="data-table compact">
                  <thead><tr><th>{t('financialAnalytics.dashboard.headers.category')}</th><th>{t('financialAnalytics.dashboard.headers.total')}</th></tr></thead>
                  <tbody>
                    {(dashboard.topExpenseCategories || []).map(c => (
                      <tr key={c.category}><td>{c.category.replace(/_/g, ' ')}</td><td className="text-danger">{formatCurrency(c.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Revenue by Category */}
              <div className="card">
                <h3>{t('financialAnalytics.dashboard.revenueByCategory')}</h3>
                <table className="data-table compact">
                  <thead><tr><th>{t('financialAnalytics.dashboard.headers.category')}</th><th>{t('financialAnalytics.dashboard.headers.total')}</th></tr></thead>
                  <tbody>
                    {(dashboard.revenueByCategory || []).map(c => (
                      <tr key={c.category}><td>{c.category.replace(/_/g, ' ')}</td><td className="text-success">{formatCurrency(c.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'records' ? (
            <div className="card full-width">
              <h3>{t('financialAnalytics.tabs.records')}</h3>
              {records.length === 0 ? <p className="empty-text">{t('financialAnalytics.emptyRecords')}</p> : (
                <table className="data-table">
                  <thead><tr><th>{t('common.date')}</th><th>{t('common.type')}</th><th>{t('financialAnalytics.dashboard.headers.category')}</th><th>{t('financialAnalytics.form.amount')}</th><th>{t('common.description')}</th><th>{t('financialAnalytics.form.reference')}</th><th>{t('common.actions')}</th></tr></thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td>{r.transactionDate ? new Date(r.transactionDate).toLocaleDateString() : '–'}</td>
                        <td><span className="badge" style={{ background: TYPE_COLORS[r.recordType] }}>{r.recordType}</span></td>
                        <td>{r.category.replace(/_/g, ' ')}</td>
                        <td className={r.recordType === 'income' ? 'text-success' : 'text-danger'}>{formatCurrency(r.amount)}</td>
                        <td>{r.description || '–'}</td>
                        <td>{r.referenceNumber || '–'}</td>
                        <td>
                          <button className="btn btn-sm" onClick={() => startEdit(r)}>{t('common.edit')}</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>{t('common.delete')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default FinancialAnalytics

import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, FinancialRecord, FinancialDashboard } from '../types'

const TYPE_COLORS: Record<string, string> = { income: '#22c55e', expense: '#ef4444' }

const CATEGORIES = {
  income: ['animal_sales', 'milk_sales', 'egg_sales', 'meat_sales', 'breeding_fees', 'consultation_fees', 'grants', 'subsidies', 'other_income'],
  expense: ['feed', 'veterinary', 'medication', 'equipment', 'labor', 'utilities', 'transport', 'insurance', 'maintenance', 'rent', 'taxes', 'marketing', 'other_expense']
}

const FinancialAnalytics: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'records'>('dashboard')
  const [showForm, setShowForm] = useState(false)
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
        setSuccessMsg('Record updated!')
      } else {
        await apiService.createFinancialRecord(selectedEnterpriseId, payload)
        setSuccessMsg('Record created!')
      }
      setShowForm(false); setEditingId(null)
      resetForm()
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save record')
    }
  }

  const resetForm = () => setFormData({ recordType: 'expense', category: 'feed', amount: '', description: '', referenceNumber: '', transactionDate: new Date().toISOString().split('T')[0], notes: '' })

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this financial record?')) return
    try {
      await apiService.deleteFinancialRecord(id)
      setSuccessMsg('Record deleted!')
      fetchData()
    } catch { setError('Failed to delete') }
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
        <h1>💰 Financial Analytics</h1>
        <p>Track income, expenses, and analyze financial performance</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>Select Enterprise:</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">-- Select --</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>📊 Dashboard</button>
            <button className={`tab-btn ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>📋 Records</button>
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm() }}>+ Add Record</button>
          </div>

          {showForm && (
            <form className="module-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Edit Financial Record' : 'Add Financial Record'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Type *</label>
                  <select value={formData.recordType} onChange={e => setFormData({ ...formData, recordType: e.target.value as 'income' | 'expense', category: CATEGORIES[e.target.value as 'income' | 'expense'][0] })}>
                    <option value="income">💚 Income</option>
                    <option value="expense">🔴 Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    {CATEGORIES[formData.recordType].map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount *</label>
                  <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Transaction Date *</label>
                  <input type="date" required value={formData.transactionDate} onChange={e => setFormData({ ...formData, transactionDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Reference #</label>
                  <input value={formData.referenceNumber} onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button>
              </div>
            </form>
          )}

          {loading ? <p className="loading-text">Loading...</p> : tab === 'dashboard' && dashboard ? (
            <div className="dashboard-grid">
              {/* Summary cards */}
              <div className="card">
                <h3>Total Income</h3>
                <div className="big-stat success">${Number(dashboard.totalIncome || 0).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="card">
                <h3>Total Expenses</h3>
                <div className="big-stat danger">${Number(dashboard.totalExpenses || 0).toLocaleString('en', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="card">
                <h3>Net Profit</h3>
                <div className={`big-stat ${Number(dashboard.netProfit) >= 0 ? 'success' : 'danger'}`}>
                  ${Number(dashboard.netProfit || 0).toLocaleString('en', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Monthly Breakdown */}
              <div className="card full-width">
                <h3>Monthly Breakdown</h3>
                {(dashboard.monthlyBreakdown || []).length === 0 ? <p className="empty-text">No data yet.</p> : (
                  <table className="data-table compact">
                    <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Profit</th></tr></thead>
                    <tbody>
                      {(dashboard.monthlyBreakdown || []).map(m => (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td className="text-success">${Number(m.income).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                          <td className="text-danger">${Number(m.expenses).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                          <td className={Number(m.profit) >= 0 ? 'text-success' : 'text-danger'}>${Number(m.profit).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Expenses */}
              <div className="card">
                <h3>Top Expense Categories</h3>
                <table className="data-table compact">
                  <thead><tr><th>Category</th><th>Total</th></tr></thead>
                  <tbody>
                    {(dashboard.topExpenseCategories || []).map(c => (
                      <tr key={c.category}><td>{c.category.replace(/_/g, ' ')}</td><td className="text-danger">${Number(c.total).toLocaleString('en', { minimumFractionDigits: 2 })}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Revenue by Category */}
              <div className="card">
                <h3>Revenue by Category</h3>
                <table className="data-table compact">
                  <thead><tr><th>Category</th><th>Total</th></tr></thead>
                  <tbody>
                    {(dashboard.revenueByCategory || []).map(c => (
                      <tr key={c.category}><td>{c.category.replace(/_/g, ' ')}</td><td className="text-success">${Number(c.total).toLocaleString('en', { minimumFractionDigits: 2 })}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'records' ? (
            <div className="card full-width">
              <h3>Financial Records</h3>
              {records.length === 0 ? <p className="empty-text">No records yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th><th>Ref #</th><th>Actions</th></tr></thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td>{r.transactionDate ? new Date(r.transactionDate).toLocaleDateString() : '–'}</td>
                        <td><span className="badge" style={{ background: TYPE_COLORS[r.recordType] }}>{r.recordType}</span></td>
                        <td>{r.category.replace(/_/g, ' ')}</td>
                        <td className={r.recordType === 'income' ? 'text-success' : 'text-danger'}>${Number(r.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                        <td>{r.description || '–'}</td>
                        <td>{r.referenceNumber || '–'}</td>
                        <td>
                          <button className="btn btn-sm" onClick={() => startEdit(r)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Del</button>
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

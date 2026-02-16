import React, { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'

const MedicalRecords: React.FC = () => {
  const { formatDate } = useSettings()
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'consultations'>('prescriptions')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const [rxRes, cRes] = await Promise.all([
        apiService.getMyPrescriptions({ limit: 50 }).catch(() => ({ data: [] })),
        apiService.listConsultations({ limit: 50 }).catch(() => ({ data: [] }))
      ])
      const rxData = rxRes.data?.items || (Array.isArray(rxRes.data) ? rxRes.data : [])
      setPrescriptions(rxData)

      const cData = cRes.data?.items || (Array.isArray(cRes.data) ? cRes.data : [])
      // Only show completed consultations with diagnosis/notes
      setConsultations(cData.filter((c: any) => c.status === 'completed' && (c.diagnosis || c.notes)))
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load records')
    } finally { setLoading(false) }
  }

  const fmtDate = (d: string) => {
    if (!d) return 'N/A'
    try { return formatDate(d) } catch { return d }
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>📋 Medical Records</h1></div>
        <div className="module-content" style={{ textAlign: 'center', padding: 60 }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading your medical records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📋 Medical Records</h1>
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('prescriptions')}
          style={{
            padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: activeTab === 'prescriptions' ? '#fff' : 'transparent',
            color: activeTab === 'prescriptions' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'prescriptions' ? '2px solid #667eea' : '2px solid transparent',
            marginBottom: -2
          }}>
          💊 Prescriptions ({prescriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('consultations')}
          style={{
            padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: activeTab === 'consultations' ? '#fff' : 'transparent',
            color: activeTab === 'consultations' ? '#667eea' : '#6b7280',
            borderBottom: activeTab === 'consultations' ? '2px solid #667eea' : '2px solid transparent',
            marginBottom: -2
          }}>
          🩺 Consultation Notes ({consultations.length})
        </button>
      </div>

      <div className="module-content">
        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <>
            {prescriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💊</div>
                <p style={{ fontSize: 16, fontWeight: 500 }}>No prescriptions yet</p>
                <p style={{ fontSize: 13 }}>Prescriptions from your consultations will appear here</p>
              </div>
            ) : (
              <div className="records-list">
                {prescriptions.map((rx: any) => (
                  <div key={rx.id} className="record-item" style={{ borderLeft: '4px solid #059669' }}>
                    <div className="record-icon">💊</div>
                    <div className="record-details">
                      <h4>
                        {Array.isArray(rx.medications)
                          ? rx.medications.map((m: any) => m.name).join(', ')
                          : 'Medication'}
                      </h4>
                      {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                        <p key={mi}>
                          <strong>{med.name}</strong>{med.dosage ? ` — ${med.dosage}` : ''}{med.frequency ? `, ${med.frequency}` : ''}{med.duration ? ` for ${med.duration}` : ''}
                        </p>
                      ))}
                      {rx.instructions && (
                        <p className="text-muted">📝 {rx.instructions}</p>
                      )}
                      <p className="text-muted">
                        Prescribed: {fmtDate(rx.createdAt || rx.created_at || '')}
                        {' • '} Valid until: {fmtDate(rx.validUntil || rx.valid_until || '')}
                      </p>
                    </div>
                    <div className="record-actions">
                      <span className="badge badge-completed">{rx.isActive ? 'active' : 'expired'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Consultation Notes Tab */}
        {activeTab === 'consultations' && (
          <>
            {consultations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🩺</div>
                <p style={{ fontSize: 16, fontWeight: 500 }}>No consultation notes yet</p>
                <p style={{ fontSize: 13 }}>Notes and diagnoses from completed consultations will appear here</p>
              </div>
            ) : (
              <div className="records-list">
                {consultations.map((c: any) => (
                  <div key={c.id} className="record-item" style={{ borderLeft: '4px solid #667eea' }}>
                    <div className="record-icon">📄</div>
                    <div className="record-details">
                      <h4>{c.animalType || 'Consultation'}</h4>
                      {c.diagnosis && <p><strong>Diagnosis:</strong> {c.diagnosis}</p>}
                      {c.notes && <p className="text-muted">📝 {c.notes}</p>}
                      <p className="text-muted">{fmtDate(c.completedAt || c.createdAt || '')}</p>
                    </div>
                    <div className="record-actions">
                      <span className="badge badge-completed">{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MedicalRecords

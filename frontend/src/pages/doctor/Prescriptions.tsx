import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface PrescriptionsProps {
  onNavigate: (path: string) => void
}

interface PrescriptionItem {
  id: string
  consultationId?: string
  petOwnerId?: string
  animalId?: string
  medications: { name: string; dosage: string; frequency: string; duration: string; instructions?: string }[]
  instructions?: string
  validUntil?: string
  isActive: boolean
  createdAt: string
  petOwnerName?: string
  vetName?: string
  diagnosis?: string
}

const Prescriptions: React.FC<PrescriptionsProps> = ({ onNavigate }) => {
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadPrescriptions() }, [])

  const loadPrescriptions = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiService.getMyPrescriptions({ limit: 50 })
      const items = res.data?.items || (Array.isArray(res.data) ? res.data : [])
      setPrescriptions(items)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load prescriptions')
    } finally {
      setLoading(false)
    }
  }

  const isVet = user?.role === 'veterinarian'

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>💊 Prescriptions</h1>
          <p className="page-subtitle">
            {isVet ? 'Prescriptions you have written' : 'Your prescriptions'}
          </p>
        </div>
        {isVet && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={() => onNavigate('/doctor/prescriptions/new')}>
              + Write Prescription
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>Loading prescriptions...</p></div>
      ) : prescriptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💊</div>
          <h2>No Prescriptions Yet</h2>
          <p>{isVet ? 'Prescriptions you write during consultations will appear here.' : 'Prescriptions from your consultations will appear here.'}</p>
          {isVet && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate('/doctor/prescriptions/new')}>
              Write a Prescription
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {prescriptions.map(rx => (
            <div key={rx.id} className="card" style={{ borderLeft: rx.isActive ? '4px solid #10b981' : '4px solid #9ca3af' }}>
              <div className="card-body" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      {rx.medications.map(m => m.name).join(', ')}
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
                      Created: {formatDate(rx.createdAt)}
                      {rx.validUntil && ` • Valid until: ${formatDate(rx.validUntil)}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: rx.isActive ? '#d1fae5' : '#f3f4f6',
                      color: rx.isActive ? '#065f46' : '#6b7280'
                    }}>
                      {rx.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {rx.consultationId && (
                      <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => onNavigate(isVet ? `/doctor/consultation-room/${rx.consultationId}` : `/video-consultation/${rx.consultationId}`)}>
                        View Consultation
                      </button>
                    )}
                  </div>
                </div>

                {/* Medications */}
                <div style={{ display: 'grid', gap: 8 }}>
                  {rx.medications.map((med, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, fontSize: 14 }}>
                      <strong>{med.name}</strong> — {med.dosage} • {med.frequency}
                      {med.duration && ` • ${med.duration}`}
                      {med.instructions && <span style={{ color: '#6b7280' }}> ({med.instructions})</span>}
                    </div>
                  ))}
                </div>

                {rx.instructions && (
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: '#4b5563' }}>
                    📝 {rx.instructions}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Prescriptions

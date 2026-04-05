import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  animalName?: string
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
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([])
  const [filtered, setFiltered] = useState<PrescriptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'

  const loadPrescriptions = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiService.getMyPrescriptions({ limit: 100 })
      const items: PrescriptionItem[] = res.data?.items || (Array.isArray(res.data) ? res.data : [])
      setPrescriptions(items)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || t('prescriptions.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadPrescriptions() }, [loadPrescriptions])

  // Apply search + status filter
  useEffect(() => {
    let result = [...prescriptions]
    if (statusFilter !== 'all') result = result.filter(rx => statusFilter === 'active' ? rx.isActive : !rx.isActive)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter(rx =>
        rx.medications.some(m => m.name.toLowerCase().includes(q)) ||
        (rx.animalName || '').toLowerCase().includes(q) ||
        (rx.petOwnerName || '').toLowerCase().includes(q) ||
        (rx.vetName || '').toLowerCase().includes(q) ||
        (rx.diagnosis || '').toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [prescriptions, searchTerm, statusFilter])

  const handleDeactivate = async (id: string) => {
    if (!window.confirm(t('prescriptions.confirmDeactivate'))) return
    try {
      setDeactivating(id)
      await apiService.deactivatePrescription(id)
      setPrescriptions(prev => prev.map(rx => rx.id === id ? { ...rx, isActive: false } : rx))
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('prescriptions.failedToDeactivate'))
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>💊 {t('prescriptions.title')}</h1>
          <p>{isVet || isAdmin ? t('prescriptions.vetSubtitle') : t('prescriptions.ownerSubtitle')}</p>
        </div>
        {(isVet || isAdmin) && (
          <button className="module-btn primary" onClick={() => onNavigate('/doctor/prescriptions/new')}>
            + {t('prescriptions.writePrescription')}
          </button>
        )}
      </div>

      {/* Search + Filter bar */}
      <div className="module-form-row" style={{ marginBottom: 16 }}>
        <input
          className="module-input"
          placeholder={t('prescriptions.searchPlaceholder')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="module-input"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          style={{ maxWidth: 180 }}
        >
          <option value="all">{t('prescriptions.filterAll')}</option>
          <option value="active">{t('prescriptions.filterActive')}</option>
          <option value="inactive">{t('prescriptions.filterInactive')}</option>
        </select>
      </div>

      {error && (
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          {error}
          <button className="module-alert-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('prescriptions.loadingPrescriptions')}</p></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💊</div>
          <h2>{prescriptions.length === 0 ? t('prescriptions.noPrescriptionsYet') : t('prescriptions.noMatchingPrescriptions')}</h2>
          <p>{isVet || isAdmin ? t('prescriptions.vetEmptyMessage') : t('prescriptions.ownerEmptyMessage')}</p>
          {(isVet || isAdmin) && prescriptions.length === 0 && (
            <button className="module-btn primary" style={{ marginTop: 16 }} onClick={() => onNavigate('/doctor/prescriptions/new')}>
              {t('prescriptions.writeAPrescription')}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {t('prescriptions.showing', { count: filtered.length, total: prescriptions.length })}
          </p>
          {filtered.map(rx => (
            <div key={rx.id} className="card" style={{ borderLeft: rx.isActive ? '4px solid #10b981' : '4px solid #9ca3af' }}>
              <div className="card-body" style={{ padding: 20 }}>

                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      💊 {rx.medications.map(m => m.name).join(', ')}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 4 }}>
                      {rx.animalName && (
                        <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>🐾 {rx.animalName}</span>
                      )}
                      {isVet || isAdmin ? (
                        rx.petOwnerName && <span style={{ fontSize: 13, color: '#6b7280' }}>👤 {rx.petOwnerName}</span>
                      ) : (
                        rx.vetName && <span style={{ fontSize: 13, color: '#6b7280' }}>👨‍⚕️ Dr. {rx.vetName}</span>
                      )}
                      {rx.diagnosis && (
                        <span style={{ fontSize: 13, color: '#667eea' }}>🩺 {rx.diagnosis}</span>
                      )}
                    </div>
                    <p style={{ color: '#9ca3af', fontSize: 12, margin: '4px 0 0' }}>
                      {t('prescriptions.created')}: {formatDate(rx.createdAt)}
                      {rx.validUntil && ` • ${t('prescriptions.validUntil')}: ${formatDate(rx.validUntil)}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: rx.isActive ? '#d1fae5' : '#f3f4f6',
                      color: rx.isActive ? '#065f46' : '#6b7280'
                    }}>
                      {rx.isActive ? t('prescriptions.active') : t('prescriptions.inactive')}
                    </span>
                    {rx.consultationId && (
                      <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => onNavigate(isVet || isAdmin ? `/doctor/consultation-room/${rx.consultationId}` : `/video-consultation/${rx.consultationId}`)}>
                        {t('prescriptions.viewConsultation')}
                      </button>
                    )}
                    {(isVet || isAdmin) && rx.isActive && (
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '4px 10px', color: '#dc2626', borderColor: '#dc2626' }}
                        disabled={deactivating === rx.id}
                        onClick={() => handleDeactivate(rx.id)}
                      >
                        {deactivating === rx.id ? '...' : t('prescriptions.deactivate')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Medications */}
                <div style={{ display: 'grid', gap: 6 }}>
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

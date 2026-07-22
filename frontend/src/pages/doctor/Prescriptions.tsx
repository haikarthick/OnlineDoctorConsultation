import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import PrescriptionPrintView, { PrescriptionPrintData, PrescriptionTemplate } from '../../components/PrescriptionPrintView'
import '../../styles/modules.css'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface PrescriptionsProps {
  onNavigate: (path: string) => void
}

interface PrescriptionItem {
  id: string
  consultationId?: string
  petOwnerId?: string
  animalId?: string
  animalName?: string
  animalSpecies?: string
  animalBreed?: string
  animalGender?: string
  animalClass?: string
  medications: { name: string; dosage: string; frequency: string; duration: string; route?: string; instructions?: string }[]
  instructions?: string
  validUntil?: string
  isActive: boolean
  createdAt: string
  petOwnerName?: string
  vetName?: string
  diagnosis?: string
  // Pharmacy fields
  reviewStatus?: string
  isNetworkCoordinated?: boolean
  pharmacyName?: string
  reviewedAt?: string
  reviewNotes?: string
  dispensingStatus?: string
  dispensedAt?: string
  dispensingMethod?: string
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
  // Print view state
  const [printData, setPrintData] = useState<PrescriptionPrintData | null>(null)
  const [printTemplate, setPrintTemplate] = useState<PrescriptionTemplate | null>(null)
  const [loadingPrint, setLoadingPrint] = useState<string | null>(null)

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
  useAutoRefresh('prescriptions', loadPrescriptions)

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

  const handlePrint = async (rx: PrescriptionItem) => {
    try {
      setLoadingPrint(rx.id)
      // Fetch full prescription details (with vet profile) + template in parallel
      const [fullRx, tpl] = await Promise.all([
        apiService.getPrescription(rx.id),
        apiService.getPrescriptionTemplate(),
      ])
      const rxData = fullRx?.data || fullRx
      const animalDob: string | undefined = rxData?.animalDob
      let animalAge: string | undefined
      if (animalDob) {
        const dob = new Date(animalDob)
        const ageDays = Math.floor((Date.now() - dob.getTime()) / 86400000)
        if (ageDays < 30) animalAge = `${ageDays}d`
        else if (ageDays < 365) animalAge = `${Math.floor(ageDays / 30)}mo`
        else animalAge = `${Math.floor(ageDays / 365)}yr`
      }
      const printPayload: PrescriptionPrintData = {
        id: rxData?.id || rx.id,
        consultationId: rxData?.consultationId || rx.consultationId,
        isActive: rxData?.isActive ?? rx.isActive,
        createdAt: rxData?.createdAt || rx.createdAt,
        validUntil: rxData?.validUntil || rx.validUntil,
        animalName: rxData?.animalName || rx.animalName,
        animalSpecies: rxData?.animalSpecies || rx.animalSpecies,
        animalBreed: rxData?.animalBreed || rx.animalBreed,
        animalAge,
        animalGender: rxData?.animalGender || rx.animalGender,
        animalClass: rxData?.animalClass || rx.animalClass,
        petOwnerName: rxData?.petOwnerName || rx.petOwnerName,
        vetName: rxData?.vetName || rx.vetName,
        vetLicense: rxData?.vetLicense,
        vetSpecialization: Array.isArray(rxData?.vetSpecializations) ? rxData.vetSpecializations[0] : rxData?.vetSpecializations,
        vetQualifications: Array.isArray(rxData?.vetQualifications) ? rxData.vetQualifications.join(', ') : rxData?.vetQualifications,
        vetClinicName: rxData?.vetClinicName,
        diagnosis: rxData?.diagnosis || rx.diagnosis,
        chiefComplaints: rxData?.chiefComplaints,
        instructions: rxData?.instructions || rx.instructions,
        medications: (rxData?.medications || rx.medications).map((m: any) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          route: m.route,
          instructions: m.instructions,
        })),
      }
      const template: PrescriptionTemplate = {
        clinicName: tpl.clinicName || 'VetCare Platform',
        clinicTagline: tpl.clinicTagline || '',
        clinicAddress: tpl.clinicAddress || '',
        clinicPhone: tpl.clinicPhone || '',
        clinicEmail: tpl.clinicEmail || '',
        clinicWebsite: tpl.clinicWebsite || '',
        registrationNumber: tpl.registrationNumber || '',
        clinicLogo: tpl.clinicLogo || '',
        footerText: tpl.footerText || '',
      }
      setPrintTemplate(template)
      setPrintData(printPayload)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('prescriptions.failedToPrint'))
    } finally {
      setLoadingPrint(null)
    }
  }

  return (
    <div className="module-page">
      {/* Print view modal */}
      {printData && printTemplate && (
        <PrescriptionPrintView
          prescription={printData}
          template={printTemplate}
          onClose={() => { setPrintData(null); setPrintTemplate(null) }}
        />
      )}

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
                        <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                          🐾 {rx.animalName}
                          {rx.animalSpecies && ` (${rx.animalSpecies}${rx.animalBreed ? ', ' + rx.animalBreed : ''})`}
                        </span>
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
                    {/* Pharmacy status badge */}
                    {rx.isNetworkCoordinated && rx.reviewStatus && (() => {
                      // Simplified labels for pet owner, full labels for vet/admin
                      const isOwner = !isVet && !isAdmin
                      const statusMap: Record<string, { label: string; bg: string; color: string }> = {
                        pending_review:          { label: isOwner ? t('prescriptions.pharmacy.sentToPharmacy') : `⏳ ${t('prescriptions.pharmacy.pendingReview')}`, bg: '#fff3e0', color: '#e65100' },
                        approved_for_dispensing: { label: isOwner ? t('prescriptions.pharmacy.readyForPickup') : `✅ ${t('prescriptions.pharmacy.approvedForDispensing')}`, bg: '#e8f5e9', color: '#2e7d32' },
                        dispensed:               { label: isOwner ? (rx.dispensingMethod === 'home_delivery' ? `🚚 ${t('prescriptions.pharmacy.outForDelivery')}` : `✓ ${t('prescriptions.pharmacy.dispensed')}`) : `💊 ${t('prescriptions.pharmacy.dispensed')}`, bg: '#e3f2fd', color: '#1565c0' },
                        rejected:                { label: isOwner ? `⚠️ ${t('prescriptions.pharmacy.issueContactVet')}` : `❌ ${t('prescriptions.pharmacy.rejected')}`, bg: '#ffebee', color: '#c62828' },
                        needs_clarification:     { label: isOwner ? `⏳ ${t('prescriptions.pharmacy.pendingUpdate')}` : `❓ ${t('prescriptions.pharmacy.needsClarification')}`, bg: '#fff8e1', color: '#f57f17' },
                      }
                      const statusInfo = statusMap[rx.reviewStatus]
                      if (!statusInfo) return null
                      return (
                        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                          {rx.pharmacyName && <small style={{ fontWeight: 400, opacity: 0.8 }}> · {rx.pharmacyName}</small>}
                        </span>
                      )
                    })()}
                    {/* Rejection reason for vet */}
                    {(isVet || isAdmin) && rx.reviewStatus === 'rejected' && rx.reviewNotes && (
                      <span style={{ fontSize: 11, color: '#c62828', background: '#fff5f5', padding: '3px 8px', borderRadius: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rx.reviewNotes}>
                        Reason: {rx.reviewNotes}
                      </span>
                    )}
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 12, padding: '4px 10px', color: '#2b6cb0', borderColor: '#2b6cb0' }}
                      disabled={loadingPrint === rx.id}
                      onClick={() => handlePrint(rx)}
                      title={t('prescriptions.printPrescription')}
                    >
                      {loadingPrint === rx.id ? '...' : `🖨 ${t('prescriptions.print')}`}
                    </button>
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

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import type { VetHospital, HospitalDepartment, HospitalDoctor, HospitalService, HospitalStats, HospitalDocument } from '../types'
import { DOC_LABELS, REQUIRED_DOC_TYPES, EXPIRY_DOC_TYPES } from '../types'
import './ModulePage.css'
import './VetHospitals.css'
import { useSettings } from '../context/SettingsContext'
import { useTranslation } from 'react-i18next'

type Tab = 'overview' | 'doctors' | 'departments' | 'services' | 'appointments' | 'documents' | 'settings'

const HOSPITAL_ROLES = ['owner','medical_director','department_head','consultant','resident','intern','staff','visiting']
const EMPLOYMENT_TYPES = ['full_time','part_time','visiting','contract','honorary']
const SERVICE_CATEGORIES = ['consultation','surgery','diagnostics','dentistry','pharmacy','grooming',
  'vaccination','emergency','radiology','laboratory','physiotherapy','ophthalmology']

const HOSPITAL_TYPE_LABELS: Record<string, string> = {
  clinic:           'General Practice',
  emergency_center: 'Emergency & Trauma',
  specialty:        'Specialty',
  multi_specialty:  'Multi-Specialty',
  teaching:         'Teaching Hospital',
  research:         'Research Centre',
  mobile_vet:       'Mobile Unit',
  other:            'Other / Shelter Clinic',
}

const VetHospitalManage: React.FC = () => {
  const { t } = useTranslation()
  const { formatCurrency, formatSlotTime, settings } = useSettings()

  const { user } = useAuth()
  const navigate = useNavigate()
  const [hospital, setHospital] = useState<VetHospital | null>(null)
  const [hospitals, setHospitals] = useState<VetHospital[]>([])
  const [departments, setDepartments] = useState<HospitalDepartment[]>([])
  const [doctors, setDoctors] = useState<HospitalDoctor[]>([])
  const [services, setServices] = useState<HospitalService[]>([])
  const [stats, setStats] = useState<HospitalStats | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Doctor modal
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [editDoctor, setEditDoctor] = useState<HospitalDoctor | null>(null)
  const [doctorForm, setDoctorForm] = useState({ doctorId: '', hospitalRole: 'staff', employmentType: 'full_time', departmentId: '', title: '', consultationFee: '', isPrimaryHospital: false })
  // Vet search / browse
  const [vetSearch, setVetSearch] = useState('')
  const [allVets, setAllVets] = useState<any[]>([])
  const [vetSearchLoading, setVetSearchLoading] = useState(false)
  const [selectedVetName, setSelectedVetName] = useState('')
  const [specFilter, setSpecFilter] = useState('')
  // Per-modal feedback message (shared — only one modal open at a time)
  const [modalMsg, setModalMsg] = useState<{ text: string; isError: boolean } | null>(null)

  // Department modal
  const [showAddDept, setShowAddDept] = useState(false)
  const [editDept, setEditDept] = useState<HospitalDepartment | null>(null)
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '', specializations: '', floorNumber: '', headDoctorId: '' })

  // Service modal
  const [showAddService, setShowAddService] = useState(false)
  const [editService, setEditService] = useState<HospitalService | null>(null)
  const [serviceForm, setServiceForm] = useState({ serviceName: '', category: 'consultation', description: '', priceMin: '', priceMax: '', durationMinutes: '', requiresAppointment: false })

  // Settings
  const [settingsForm, setSettingsForm] = useState<Partial<VetHospital>>({})

  // Documents
  const [documents, setDocuments] = useState<HospitalDocument[]>([])
  const [docUploading, setDocUploading] = useState<Record<string, boolean>>({})
  const [docError, setDocError] = useState<Record<string, string>>({})
  const [reviewForm, setReviewForm] = useState<{ docId: string; status: 'approved'|'rejected'; reason: string } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [docViewModal, setDocViewModal] = useState<{ url: string; name: string } | null>(null)

  // Appointments
  const [bookings, setBookings] = useState<any[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingsTotal, setBookingsTotal] = useState(0)
  const [bookingsPage, setBookingsPage] = useState(0)
  const [bookingsStatusFilter, setBookingsStatusFilter] = useState('')

  // Doctor Invites
  const [showInviteDoctor, setShowInviteDoctor] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', phone: '', hospitalRole: 'staff', departmentId: '' })
  const [invites, setInvites] = useState<any[]>([])
  const [invitesLoaded, setInvitesLoaded] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [linkCopied, setLinkCopied] = useState('')

  const loadHospital = useCallback(async (h: VetHospital) => {
    setHospital(h)
    const [depts, docs, svcs, st, hDocs] = await Promise.all([
      vetHospitalApi.listDepartments(h.id),
      vetHospitalApi.listDoctors(h.id),
      vetHospitalApi.listServices(h.id),
      vetHospitalApi.getHospitalStats(h.id).catch(() => null),
      vetHospitalApi.listDocuments(h.id).catch(() => []),
    ])
    setDepartments(depts); setDoctors(docs); setServices(svcs); setStats(st)
    setDocuments(hDocs)
    setSettingsForm({
      name: h.name, tagline: h.tagline, description: h.description,
      hospitalType: h.hospitalType, phone: h.phone, email: h.email, website: h.website,
      address: h.address, city: h.city, state: h.state, country: h.country,
      hasEmergency: h.hasEmergency, is24Hours: h.is24Hours,
    })
  }, [])

  const loadBookings = useCallback(async (hId: string, page = 0, status = '') => {
    setBookingsLoading(true)
    try {
      const res = await vetHospitalApi.listHospitalBookings(hId, { limit: 15, offset: page * 15, status: status || undefined })
      setBookings(res?.data?.bookings || res?.bookings || [])
      setBookingsTotal(res?.data?.total || res?.total || 0)
    } catch { setBookings([]) }
    finally { setBookingsLoading(false) }
  }, [])

  useEffect(() => {
    if (hospital && activeTab === 'appointments') loadBookings(hospital.id, bookingsPage, bookingsStatusFilter)
  }, [hospital, activeTab, bookingsPage, bookingsStatusFilter, loadBookings])

  // Load invites when doctors tab is active
  useEffect(() => {
    if (hospital && activeTab === 'doctors' && !invitesLoaded) {
      vetHospitalApi.listInvites(hospital.id).then(data => { setInvites(data); setInvitesLoaded(true) }).catch(() => flash(t('vetHospitalManage.errors.invitesLoadFailed'), true))
    }
  }, [hospital, activeTab, invitesLoaded])

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital || !inviteForm.email) return
    setModalMsg(null)
    setInviteLink('')
    try {
      const result = await vetHospitalApi.inviteDoctor(hospital.id, {
        email: inviteForm.email,
        firstName: inviteForm.firstName || undefined,
        lastName: inviteForm.lastName || undefined,
        phone: inviteForm.phone || undefined,
        hospitalRole: inviteForm.hospitalRole,
        departmentId: inviteForm.departmentId || undefined,
      })
      const url = result?.inviteUrl || ''
      setInviteLink(url)
      setModalMsg({ text: t('vetHospitalManage.inviteCreated'), isError: false })
      setInviteForm({ email: '', firstName: '', lastName: '', phone: '', hospitalRole: 'staff', departmentId: '' })
      setInvitesLoaded(false)
    } catch (err: any) {
      setModalMsg({ text: err?.response?.data?.message || err?.response?.data?.error?.message || t('vetHospitalManage.errors.inviteFailed'), isError: true })
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!hospital) return
    try {
      await vetHospitalApi.revokeInvite(hospital.id, inviteId)
      setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: 'revoked' } : inv))
    } catch {
      flash(t('vetHospitalManage.errors.revokeInviteFailed'), true)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        if (user?.role === 'admin') {
          const res = await vetHospitalApi.listHospitals({ limit: 100 })
          setHospitals(res.hospitals)
          if (res.hospitals.length > 0) await loadHospital(res.hospitals[0])
        } else {
          const hs = await vetHospitalApi.listMyHospitals()
          setHospitals(hs)
          if (hs.length === 0) { navigate('/vet-hospitals'); return }
          await loadHospital(hs[0])
        }
      } catch { setError(t('vetHospitalManage.errors.loadFailed')) }
      finally { setLoading(false) }
    }
    init()
  }, [user, navigate, loadHospital])

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  // ── Document ops ─────────────────────────────────────────────────────────
  const handleDocUpload = async (docType: string, file: File, expiryDate?: string) => {
    if (!hospital) return
    setDocUploading(p => ({ ...p, [docType]: true }))
    setDocError(p => ({ ...p, [docType]: '' }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', docType)
      if (expiryDate) fd.append('expiryDate', expiryDate)
      const uploaded = await vetHospitalApi.uploadDocument(hospital.id, fd)
      setDocuments(prev => {
        const filtered = prev.filter(d => d.docType !== docType)
        return [...filtered, uploaded]
      })
      // Refresh hospital to get updated verificationStatus
      const updated = await vetHospitalApi.getHospital(hospital.id)
      setHospital(updated)
      flash(t('vetHospitalManage.toasts.docUploaded'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || 'Upload failed'
      setDocError(p => ({ ...p, [docType]: msg }))
    } finally {
      setDocUploading(p => ({ ...p, [docType]: false }))
    }
  }

  const handleAdminReview = async () => {
    if (!hospital || !reviewForm) return
    try {
      const updated = await vetHospitalApi.reviewDocument(hospital.id, reviewForm.docId, {
        status: reviewForm.status,
        rejectionReason: reviewForm.reason || undefined,
      })
      setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))
      const updatedHospital = await vetHospitalApi.getHospital(hospital.id)
      setHospital(updatedHospital)
      setReviewForm(null)
      flash(`Document ${reviewForm.status} ✓`)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || 'Review failed', true) }
  }

  // Load all vets when Add Doctor modal opens
  useEffect(() => {
    if (!showAddDoctor || editDoctor) return
    setVetSearchLoading(true)
    ;(async () => {
      try {
        const res = await apiService.listVets({ limit: 100 })
        const vets = res?.data?.vets || res?.vets || (Array.isArray(res?.data) ? res.data : [])
        setAllVets(vets)
      } catch { setAllVets([]) }
      finally { setVetSearchLoading(false) }
    })()
  }, [showAddDoctor, editDoctor])

  // Filtered vet list (exclude already-added + search + specialization filter)
  const existingDoctorIds = new Set(doctors.map(d => d.doctorId))
  const filteredVets = allVets.filter(v => {
    if (existingDoctorIds.has(v.userId)) return false
    const q = vetSearch.toLowerCase().trim()
    if (q) {
      const match = `${v.firstName || ''} ${v.lastName || ''} ${v.email || ''}`.toLowerCase().includes(q)
        || v.specializations?.some((s: string) => s.toLowerCase().includes(q))
      if (!match) return false
    }
    if (specFilter && !v.specializations?.includes(specFilter)) return false
    return true
  })
  const allSpecializations = [...new Set(allVets.flatMap((v: any) => v.specializations || []))].sort() as string[]

  // ── Doctor ops ──────────────────────────────────────────────────────────
  const closeDocModal = () => {
    setShowAddDoctor(false); setEditDoctor(null)
    setVetSearch(''); setAllVets([]); setSpecFilter('')
    setSelectedVetName(''); setDoctorForm({ doctorId: '', hospitalRole: 'staff', employmentType: 'full_time', departmentId: '', title: '', consultationFee: '', isPrimaryHospital: false })
    setModalMsg(null)
  }
  const closeDeptModal = () => { setShowAddDept(false); setEditDept(null); setModalMsg(null) }
  const closeServiceModal = () => { setShowAddService(false); setEditService(null); setModalMsg(null) }
  const mFlash = (text: string, isError = false) => setModalMsg({ text, isError })
  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital) return
    if (!editDoctor && !doctorForm.doctorId) { mFlash(t('vetHospitalManage.errors.selectVet'), true); return }
    try {
      if (editDoctor) {
        await vetHospitalApi.updateDoctor(hospital.id, editDoctor.doctorId, {
          hospitalRole: doctorForm.hospitalRole,
          title: doctorForm.title || undefined,
          departmentId: doctorForm.departmentId || undefined,
          employmentType: doctorForm.employmentType,
          consultationFee: doctorForm.consultationFee ? parseFloat(doctorForm.consultationFee) : undefined,
          isPrimaryHospital: doctorForm.isPrimaryHospital,
        })
        flash(t('vetHospitalManage.toasts.doctorUpdated'))
        closeDocModal()
      } else {
        await vetHospitalApi.addDoctor(hospital.id, {
          doctorId: doctorForm.doctorId,
          hospitalRole: doctorForm.hospitalRole,
          title: doctorForm.title || undefined,
          departmentId: doctorForm.departmentId || undefined,
          employmentType: doctorForm.employmentType,
          consultationFee: doctorForm.consultationFee ? parseFloat(doctorForm.consultationFee) : undefined,
          isPrimaryHospital: doctorForm.isPrimaryHospital,
        })
        flash(t('vetHospitalManage.toasts.doctorAdded'))
        closeDocModal()
      }
      const docs = await vetHospitalApi.listDoctors(hospital.id); setDoctors(docs)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || t('vetHospitalManage.errors.operationFailed'), true) }
  }

  const handleRemoveDoctor = async (doc: HospitalDoctor) => {
    if (!hospital || !window.confirm(t('vetHospitalManage.confirmRemoveDoctor', { name: doc.doctorName || doc.doctorId }))) return
    try {
      await vetHospitalApi.removeDoctor(hospital.id, doc.doctorId)
      flash(t('vetHospitalManage.toasts.doctorRemoved'))
      setDoctors(prev => prev.filter(d => d.doctorId !== doc.doctorId))
    } catch { flash(t('vetHospitalManage.errors.removeFailed'), true) }
  }

  // ── Dept ops ─────────────────────────────────────────────────────────────
  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital) return
    try {
      if (editDept) {
        await vetHospitalApi.updateDepartment(hospital.id, editDept.id, {
          name: deptForm.name, code: deptForm.code || undefined,
          description: deptForm.description || undefined,
          specializations: deptForm.specializations ? deptForm.specializations.split(',').map(s => s.trim()) : undefined,
          floorNumber: deptForm.floorNumber || undefined,
          headDoctorId: deptForm.headDoctorId || undefined,
        })
        flash(t('vetHospitalManage.toasts.deptUpdated'))
        closeDeptModal()
      } else {
        await vetHospitalApi.createDepartment(hospital.id, {
          name: deptForm.name, code: deptForm.code || undefined,
          description: deptForm.description || undefined,
          specializations: deptForm.specializations ? deptForm.specializations.split(',').map(s => s.trim()) : undefined,
          floorNumber: deptForm.floorNumber || undefined,
          headDoctorId: deptForm.headDoctorId || undefined,
        })
        flash(t('vetHospitalManage.toasts.deptCreated'))
        closeDeptModal()
      }
      const depts = await vetHospitalApi.listDepartments(hospital.id); setDepartments(depts)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || t('vetHospitalManage.errors.operationFailed'), true) }
  }

  const handleDeleteDept = async (dept: HospitalDepartment) => {
    if (!hospital || !window.confirm(t('vetHospitalManage.confirmDeleteDept', { name: dept.name }))) return
    try {
      await vetHospitalApi.deleteDepartment(hospital.id, dept.id)
      flash(t('vetHospitalManage.toasts.deptDeleted'))
      setDepartments(prev => prev.filter(d => d.id !== dept.id))
    } catch { flash(t('vetHospitalManage.errors.deleteDeptFailed'), true) }
  }

  // ── Service ops ──────────────────────────────────────────────────────────
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital) return
    try {
      if (editService) {
        await vetHospitalApi.updateService(hospital.id, editService.id, {
          serviceName: serviceForm.serviceName, category: serviceForm.category,
          description: serviceForm.description || undefined,
          priceMin: serviceForm.priceMin ? parseFloat(serviceForm.priceMin) : undefined,
          priceMax: serviceForm.priceMax ? parseFloat(serviceForm.priceMax) : undefined,
          durationMinutes: serviceForm.durationMinutes ? parseInt(serviceForm.durationMinutes) : undefined,
          requiresAppointment: serviceForm.requiresAppointment,
        })
        flash(t('vetHospitalManage.toasts.serviceUpdated'))
        closeServiceModal()
      } else {
        await vetHospitalApi.addService(hospital.id, {
          serviceName: serviceForm.serviceName, category: serviceForm.category,
          description: serviceForm.description || undefined,
          priceMin: serviceForm.priceMin ? parseFloat(serviceForm.priceMin) : undefined,
          priceMax: serviceForm.priceMax ? parseFloat(serviceForm.priceMax) : undefined,
          durationMinutes: serviceForm.durationMinutes ? parseInt(serviceForm.durationMinutes) : undefined,
          requiresAppointment: serviceForm.requiresAppointment,
        })
        flash(t('vetHospitalManage.toasts.serviceAdded'))
        closeServiceModal()
      }
      const svcs = await vetHospitalApi.listServices(hospital.id); setServices(svcs)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || t('vetHospitalManage.errors.operationFailed'), true) }
  }

  const handleDeleteService = async (svc: HospitalService) => {
    if (!hospital || !window.confirm(t('vetHospitalManage.confirmDeleteService', { name: svc.serviceName }))) return
    try {
      await vetHospitalApi.deleteService(hospital.id, svc.id)
      flash(t('vetHospitalManage.toasts.serviceDeleted'))
      setServices(prev => prev.filter(s => s.id !== svc.id))
    } catch { flash(t('vetHospitalManage.errors.deleteServiceFailed'), true) }
  }

  // ── Settings save ────────────────────────────────────────────────────────
  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital) return
    try {
      const updated = await vetHospitalApi.updateHospital(hospital.id, settingsForm as any)
      setHospital(updated); flash(t('vetHospitalManage.toasts.profileUpdated'))
    } catch (err: any) { flash(err?.response?.data?.message || err?.response?.data?.error?.message || t('vetHospitalManage.errors.updateFailed'), true) }
  }

  const openEditDoctor = (doc: HospitalDoctor) => {
    setEditDoctor(doc)
    setDoctorForm({
      doctorId: doc.doctorId,
      hospitalRole: doc.hospitalRole || 'staff',
      employmentType: doc.employmentType || 'full_time',
      departmentId: doc.departmentId || '',
      title: doc.title || '',
      consultationFee: doc.consultationFee?.toString() || '',
      isPrimaryHospital: doc.isPrimaryHospital || false,
    })
    setShowAddDoctor(true)
  }

  const openEditDept = (dept: HospitalDepartment) => {
    setEditDept(dept)
    setDeptForm({
      name: dept.name, code: dept.code || '',
      description: dept.description || '',
      specializations: dept.specializations?.join(', ') || '',
      floorNumber: dept.floorNumber || '',
      headDoctorId: dept.headDoctorId || '',
    })
    setShowAddDept(true)
  }

  const openEditService = (svc: HospitalService) => {
    setEditService(svc)
    setServiceForm({
      serviceName: svc.serviceName, category: svc.category,
      description: svc.description || '',
      priceMin: svc.priceMin?.toString() || '',
      priceMax: svc.priceMax?.toString() || '',
      durationMinutes: svc.durationMinutes?.toString() || '',
      requiresAppointment: svc.requiresAppointment || false,
    })
    setShowAddService(true)
  }

  const VERIFICATION_STATUS_INFO: Record<string, { label: string; className: string; msg: string }> = {
    pending_documents: {
      label: 'Pending Documents',
      className: 'vstatus-pending',
      msg: `Please upload all ${REQUIRED_DOC_TYPES.length} required compliance documents to submit for verification.`,
    },
    under_review: {
      label: 'Under Review',
      className: 'vstatus-review',
      msg: 'All documents have been submitted. Our team will review them within 2–3 business days.',
    },
    approved: {
      label: 'Verified & Active',
      className: 'vstatus-approved',
      msg: 'Your hospital is verified and visible to patients.',
    },
    rejected: {
      label: 'Action Required',
      className: 'vstatus-rejected',
      msg: 'One or more documents were rejected. Please re-upload the corrected documents.',
    },
    suspended: {
      label: 'Suspended — Expired Documents',
      className: 'vstatus-suspended',
      msg: 'Your hospital has been suspended due to expired documents. Please renew and re-upload.',
    },
  }

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!hospital) return <div className="empty-state"><h3>{t('vetHospitalManage.noHospitalFound')}</h3><button className="btn-primary" onClick={() => navigate('/vet-hospitals')}>{t('vetHospitalManage.browseHospitals')}</button></div>

  return (
    <div className="module-page">
      {/* Header */}
      <div className="vh-manage-header">
        <div>
          <h1 className="module-title">🏥 {hospital.name}</h1>
          <p className="module-subtitle si-44087c4b">
            {HOSPITAL_TYPE_LABELS[hospital.hospitalType] || hospital.hospitalType}
            {hospital.isVerified && <span className="badge badge-verified si-c6efbebc">✓ Verified</span>}
          </p>
        </div>
        <div className="si-83aa9196">
          {hospitals.length > 1 && (
            <select className="vh-select" value={hospital.id}
              onChange={async e => {
                const h = hospitals.find(x => x.id === e.target.value)
                if (h) { setLoading(true); await loadHospital(h); setLoading(false) }
              }}>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button className="btn-secondary" onClick={() => navigate(`/vet-hospitals/${hospital.id}`)}>{t('vetHospitalManage.viewPublicProfile')}</button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {(() => {
        const vs = hospital.verificationStatus || 'pending_documents'
        const info = VERIFICATION_STATUS_INFO[vs]
        if (!info) return null
        return (
          <div className={`verification-banner ${info.className}`}>
            <span className="vstatus-badge">{info.label}</span>
            <span className="vstatus-msg">{info.msg}</span>
            {(vs === 'pending_documents' || vs === 'rejected' || vs === 'suspended') && (
              <button className="vstatus-action-btn" onClick={() => setActiveTab('documents')}>{t('vetHospitalManage.manageDocuments')}</button>
            )}
          </div>
        )
      })()}

      {error && <div className="error-message si-1cb81cae">{error}</div>}
      {success && <div className="success-message si-1cb81cae">{success}</div>}

      {/* Tabs */}
      <div className="vh-profile-tabs">
        {(['overview','doctors','departments','services','appointments','documents','settings'] as Tab[]).map(tab => (
          <button key={tab} className={`vh-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'overview' ? `📊 ${t('vetHospitalManage.tabs.overview')}` : tab === 'doctors' ? `👨‍⚕️ ${t('vetHospitalManage.tabs.doctors')} (${doctors.length})` :
              tab === 'departments' ? `🏢 ${t('vetHospitalManage.tabs.depts')} (${departments.length})` :
              tab === 'services' ? `💊 ${t('vetHospitalManage.tabs.services')} (${services.length})` :
              tab === 'appointments' ? `📅 ${t('vetHospitalManage.tabs.appointments')}` :
              tab === 'documents' ? `📄 ${t('vetHospitalManage.tabs.documents')} (${documents.length}/${REQUIRED_DOC_TYPES.length})` :
              `⚙ ${t('vetHospitalManage.tabs.settings')}`}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div>
          <div className="vh-manage-stats">
            {[
              { label: t('vetHospitalManage.overview.doctors'), value: doctors.length, icon: '👨‍⚕️' },
              { label: t('vetHospitalManage.overview.departments'), value: departments.length, icon: '🏢' },
              { label: t('vetHospitalManage.overview.services'), value: services.length, icon: '💊' },
              { label: t('vetHospitalManage.overview.avgRating'), value: hospital.rating > 0 ? Number(hospital.rating).toFixed(1) : '—', icon: '⭐' },
              { label: t('vetHospitalManage.overview.totalReviews'), value: hospital.totalReviews, icon: '💬' },
              { label: t('common.status'), value: hospital.isActive ? t('common.active') : t('vetHospitalManage.overview.inactive'), icon: '🔘' },
            ].map(s => (
              <div key={s.label} className="vh-stat-card">
                <div className="si-46606d89">{s.icon}</div>
                <div className="vh-stat-value">{s.value}</div>
                <div className="vh-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          {stats && (
            <div className="card">
              <h3 className="si-33c1a83e">{t('vetHospitalManage.overview.acceptingPatients')}</h3>
              <p>{doctors.filter(d => d.isAcceptingPatients).length} of {doctors.length} doctors are accepting new patients</p>
            </div>
          )}
          <div className="card si-216c99b7">
            <h3 className="si-33c1a83e">{t('vetHospitalManage.overview.quickActions')}</h3>
            <div className="si-05b84723">
              <button className="btn-secondary" onClick={() => { setActiveTab('doctors'); setShowAddDoctor(true) }}>+ {t('vetHospitalManage.modal.addDoctor')}</button>
              <button className="btn-secondary" onClick={() => { setActiveTab('departments'); setShowAddDept(true) }}>+ {t('vetHospitalManage.modal.addDept')}</button>
              <button className="btn-secondary" onClick={() => { setActiveTab('services'); setShowAddService(true) }}>+ {t('vetHospitalManage.modal.addService')}</button>
              <button className="btn-secondary" onClick={() => setActiveTab('settings')}>{t('vetHospitalManage.editProfile')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctors ── */}
      {activeTab === 'doctors' && (
        <div>
          <div className="si-3a656330">
            <h3 className="si-44087c4b">{t('vetHospitalManage.doctors.staff')} ({doctors.length})</h3>
            <div className="si-52c0cb1e">
              <button className="btn-secondary" onClick={() => { setModalMsg(null); setInviteLink(''); setLinkCopied(''); setInviteForm({ email: '', firstName: '', lastName: '', phone: '', hospitalRole: 'staff', departmentId: '' }); setShowInviteDoctor(true) }}>✉ {t('vetHospitalManage.doctors.inviteNew')}</button>
              <button className="btn-primary" onClick={() => { setEditDoctor(null); setDoctorForm({ doctorId: '', hospitalRole: 'staff', employmentType: 'full_time', departmentId: '', title: '', consultationFee: '', isPrimaryHospital: false }); setShowAddDoctor(true) }}>+ {t('vetHospitalManage.doctors.addExisting')}</button>
            </div>
          </div>

          {/* Pending Invites */}
          {invites.filter(i => i.status === 'pending').length > 0 && (
            <div className="si-e4efb72b">
              <div className="si-a32532b1">📨 Pending Invitations ({invites.filter(i => i.status === 'pending').length})</div>
              {invites.filter(i => i.status === 'pending').map(inv => (
                <div key={inv.id} className="si-633e4b1e">
                  <span className="si-6acd75e8">
                    <strong>{inv.first_name || ''} {inv.last_name || ''}</strong> · {inv.email} · <span className="si-ecf1d5e5">{(inv.hospital_role || 'staff').replace(/_/g, ' ')}</span>
                  </span>
                  <span className="si-908660d1">Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                  {inv.inviteUrl && <button type="button" className="btn-secondary si-a792b2c1" onClick={() => { navigator.clipboard.writeText(inv.inviteUrl); setLinkCopied(inv.id); setTimeout(() => setLinkCopied(''), 2000) }}>{linkCopied === inv.id ? '✓ Copied' : '📋 Copy Link'}</button>}
                  <button className="btn-danger si-fb053872" onClick={() => handleRevokeInvite(inv.id)}>{t('vetHospitalManage.invite.revoke')}</button>
                </div>
              ))}
            </div>
          )}
          {doctors.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">👨‍⚕️</div><p>{t('vetHospitalManage.doctors.emptyState')}</p></div>
            : <div className="vh-doctor-grid">
                {doctors.map(doc => (
                  <div key={doc.id} className="vh-doctor-card">
                    <div className="vh-doctor-name">{doc.doctorName || `Doctor ${doc.doctorId.slice(0,6)}`}</div>
                    <div className="vh-doctor-role">{doc.hospitalRole?.replace(/_/g,' ')}</div>
                    {doc.title && <div className="si-de1781c0">{doc.title}</div>}
                    {doc.departmentId && <div className="vh-doctor-dept">{departments.find(d => d.id === doc.departmentId)?.name || 'Dept'}</div>}
                    <div className="si-12530887">
                      <span style={{ fontSize: '.75rem', color: doc.isAcceptingPatients ? '#059669' : '#dc2626' }}>
                        {doc.isAcceptingPatients ? `● ${t('vetHospitalManage.doctors.accepting')}` : `● ${t('vetHospitalManage.doctors.notAccepting')}`}
                      </span>
                    </div>
                    <div className="vh-doctor-actions">
                      <button className="btn-secondary si-aa7179fc" onClick={() => openEditDoctor(doc)}>{t('common.edit')}</button>
                      <button className="btn-danger si-aa7179fc" onClick={() => handleRemoveDoctor(doc)}>{t('common.remove')}</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* ── Departments ── */}
      {activeTab === 'departments' && (
        <div>
          <div className="si-c66b816b">
            <h3 className="si-44087c4b">{t('vetHospitalManage.departments.title')} ({departments.length})</h3>
            <button className="btn-primary" onClick={() => { setEditDept(null); setDeptForm({ name: '', code: '', description: '', specializations: '', floorNumber: '', headDoctorId: '' }); setShowAddDept(true) }}>+ {t('vetHospitalManage.modal.addDept')}</button>
          </div>
          {departments.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">🏢</div><p>{t('vetHospitalManage.departments.emptyState')}</p></div>
            : <div className="vh-dept-grid">
                {departments.map(dept => (
                  <div key={dept.id} className="vh-dept-card">
                    <div className="vh-dept-name">{dept.name}</div>
                    {dept.code && <div className="si-95f0b257">Code: {dept.code}</div>}
                    {dept.description && <div className="si-880fbd4a">{dept.description}</div>}
                    {dept.specializations && dept.specializations.length > 0 && (
                      <div className="hcard-chips si-200bd478">
                        {dept.specializations.map(s => <span key={s} className="chip">{s}</span>)}
                      </div>
                    )}
                    <div className="si-953889dc">
                      {doctors.filter(d => d.departmentId === dept.id).length} {t('vetHospitalManage.departments.doctors')}
                    </div>
                    <div className="si-49829023">
                      <button className="btn-secondary si-aa7179fc" onClick={() => openEditDept(dept)}>{t('common.edit')}</button>
                      <button className="btn-danger si-aa7179fc" onClick={() => handleDeleteDept(dept)}>{t('common.delete')}</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* ── Services ── */}
      {activeTab === 'services' && (
        <div>
          <div className="si-c66b816b">
            <h3 className="si-44087c4b">{t('vetHospitalManage.services.title')} ({services.length})</h3>
            <button className="btn-primary" onClick={() => { setEditService(null); setServiceForm({ serviceName: '', category: 'consultation', description: '', priceMin: '', priceMax: '', durationMinutes: '', requiresAppointment: false }); setShowAddService(true) }}>+ {t('vetHospitalManage.modal.addService')}</button>
          </div>
          {services.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">💊</div><p>{t('vetHospitalManage.services.emptyState')}</p></div>
            : <div className="vh-services-grid">
                {services.map(svc => (
                  <div key={svc.id} className="vh-service-card">
                    <div className="vh-service-cat">{svc.category}</div>
                    <div className="vh-service-name">{svc.serviceName}</div>
                    {(svc.priceMin || svc.priceMax) && (
                      <div className="vh-service-price">
                        {svc.priceMin && svc.priceMax && svc.priceMin !== svc.priceMax
                          ? `${formatCurrency(svc.priceMin)}–${formatCurrency(svc.priceMax)}`
                          : `${formatCurrency(svc.priceMin || svc.priceMax || 0)}`}
                      </div>
                    )}
                    {svc.durationMinutes && <div className="vh-service-duration">⏱ {svc.durationMinutes} min</div>}
                    <div className="si-b074ba0c">
                      <button className="btn-secondary si-aa7179fc" onClick={() => openEditService(svc)}>{t('common.edit')}</button>
                      <button className="btn-danger si-aa7179fc" onClick={() => handleDeleteService(svc)}>{t('common.delete')}</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* ── Documents ── */}
      {activeTab === 'documents' && (
        <div className="doc-tab-root">
          <div className="doc-tab-header">
            <div>
              <h3 className="si-44087c4b">Compliance Documents</h3>
              <p className="si-47869ba9">
                Upload all required documents. Hospitals are only activated after admin verification.
              </p>
            </div>
            <div className="doc-progress-pill">
              {documents.filter(d => d.status === 'approved').length} / {REQUIRED_DOC_TYPES.length} approved
            </div>
          </div>

          <div className="doc-cards-grid">
            {REQUIRED_DOC_TYPES.map(dt => {
              const existing = documents.find(d => d.docType === dt)
              const needsExpiry = EXPIRY_DOC_TYPES.includes(dt)
              const isUploading = docUploading[dt] || false
              const errMsg = docError[dt] || ''

              return (
                <div key={dt} className={`doc-card${existing ? ` doc-status-${existing.status}` : ' doc-status-missing'}`}>
                  <div className="doc-card-top">
                    <div>
                      <div className="doc-type-label">{DOC_LABELS[dt]}</div>
                      {needsExpiry && <div className="doc-expiry-hint">Expiry date required</div>}
                    </div>
                    <span className={`doc-status-badge ${existing ? existing.status : 'missing'}`}>
                      {existing ? (
                        existing.status === 'pending_review' ? '⏳ Pending Review'
                        : existing.status === 'approved' ? '✓ Approved'
                        : '✗ Rejected'
                      ) : '⬆ Not Uploaded'}
                    </span>
                  </div>

                  {existing && (
                    <div className="doc-file-info">
                      <span className="doc-file-icon">📄</span>
                      <span className="doc-file-name">{existing.fileName}</span>
                      {existing.expiryDate && (
                        <span className={`doc-expiry-tag ${new Date(existing.expiryDate) < new Date() ? 'expired' : ''}`}>
                          Exp: {new Date(existing.expiryDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                      <button
                        type="button"
                        className="doc-view-link si-4fac113b"
                       
                        onClick={() => setDocViewModal({ url: existing.fileUrl, name: existing.fileName })}
                      >View</button>
                    </div>
                  )}

                  {existing?.rejectionReason && (
                    <div className="doc-rejection-reason">
                      <strong>Rejection reason:</strong> {existing.rejectionReason}
                    </div>
                  )}

                  {existing?.reviewerName && existing.status !== 'pending_review' && (
                    <div className="doc-reviewer">
                      {existing.status === 'approved' ? '✓' : '✗'} Reviewed by {existing.reviewerName}
                    </div>
                  )}

                  {/* Upload / Re-upload (owner or vet) */}
                  {user?.role !== 'admin' && existing?.status !== 'approved' && (
                    <div className="doc-upload-area">
                      {needsExpiry && (
                        <div className="form-group si-882b1663">
                          <label className="si-168b6e99">Expiry Date</label>
                          <input
                            type="date"
                            className="doc-expiry-input"
                            value={expiryDates[dt] || ''}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => { setExpiryDates(p => ({ ...p, [dt]: e.target.value })); setDocError(p => ({ ...p, [dt]: '' })) }}
                          />
                        </div>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        ref={el => { fileInputRefs.current[dt] = el }}
                        className="si-d6a2f871"
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const expiryDate = needsExpiry ? expiryDates[dt] || undefined : undefined
                          if (needsExpiry && !expiryDate) {
                            setDocError(p => ({ ...p, [dt]: 'Please enter the expiry date before uploading' }))
                            if (fileInputRefs.current[dt]) fileInputRefs.current[dt]!.value = ''
                            return
                          }
                          await handleDocUpload(dt, file, expiryDate)
                          if (fileInputRefs.current[dt]) fileInputRefs.current[dt]!.value = ''
                        }}
                      />
                      <button
                        className="btn-upload-doc"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[dt]?.click()}
                      >
                        {isUploading ? 'Uploading…' : existing ? 'Re-upload' : 'Upload Document'}
                      </button>
                      {errMsg && <div className="doc-err-msg">{errMsg}</div>}
                    </div>
                  )}

                  {/* Admin review buttons */}
                  {user?.role === 'admin' && existing && existing.status === 'pending_review' && (
                    <div className="doc-admin-review">
                      <button
                        className="btn-approve-doc"
                        onClick={() => setReviewForm({ docId: existing.id, status: 'approved', reason: '' })}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="btn-reject-doc"
                        onClick={() => setReviewForm({ docId: existing.id, status: 'rejected', reason: '' })}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Admin pending review summary */}
          {user?.role === 'admin' && (
            <div className="doc-admin-summary card">
              <h4 className="si-33c1a83e">Admin Actions</h4>
              <p className="si-936796c2">
                Review each document above. When all 7 documents are approved, the hospital will be automatically activated.
              </p>
              <div className="doc-admin-counts">
                <span className="dac-item approved">{documents.filter(d => d.status === 'approved').length} Approved</span>
                <span className="dac-item pending">{documents.filter(d => d.status === 'pending_review').length} Pending</span>
                <span className="dac-item rejected">{documents.filter(d => d.status === 'rejected').length} Rejected</span>
                <span className="dac-item missing">{REQUIRED_DOC_TYPES.length - documents.length} Not Uploaded</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Appointments ── */}
      {activeTab === 'appointments' && (
        <div>
          <div className="si-f456fb79">
            <h3 className="si-44087c4b">{t('vetHospitalManage.appointments.title')}</h3>
            <div className="si-0d113669">
              <select className="vh-select" value={bookingsStatusFilter} onChange={e => { setBookingsStatusFilter(e.target.value); setBookingsPage(0) }}>
                <option value="">{t('vetHospitalManage.appointments.allStatuses')}</option>
                <option value="pending">{t('common.pending')}</option>
                <option value="confirmed">{t('common.confirmed')}</option>
                <option value="completed">{t('common.completed')}</option>
                <option value="cancelled">{t('common.cancelled')}</option>
              </select>
              <button className="btn-secondary" onClick={() => hospital && loadBookings(hospital.id, bookingsPage, bookingsStatusFilter)}>↻ Refresh</button>
            </div>
          </div>
          {bookingsLoading ? (
            <p className="si-38b53f15">{t('vetHospitalManage.appointments.loading')}</p>
          ) : bookings.length === 0 ? (
            <div className="empty-state si-41acd90c">
              <div className="si-28db9f67">📅</div>
              <p>{t('vetHospitalManage.appointments.noAppointments')}{bookingsStatusFilter ? ` ${t('vetHospitalManage.appointments.withStatus', { status: bookingsStatusFilter })}` : ''}</p>
            </div>
          ) : (
            <>
              <table className="vh-admin-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('vetHospitalManage.appointments.time')}</th>
                    <th>{t('vetHospitalManage.appointments.patient')}</th>
                    <th>{t('vetHospitalManage.appointments.doctor')}</th>
                    <th>{t('common.type')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('vetHospitalManage.appointments.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <tr key={b.id}>
                      <td>{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : '—'}</td>
                      <td>{b.timeSlotStart ? formatSlotTime(b.timeSlotStart) : '—'}{b.timeSlotEnd ? ` – ${formatSlotTime(b.timeSlotEnd)}` : ''}</td>
                      <td>{b.patientName || b.ownerName || '—'}</td>
                      <td>{b.vetName || b.veterinarianName || '—'}</td>
                      <td><span className="chip">{(b.bookingType || 'in_person').replace(/_/g, ' ')}</span></td>
                      <td>
                        <span className={`badge badge-${b.status}`} style={{
                          background: b.status === 'confirmed' ? '#dcfce7' : b.status === 'pending' ? '#fef3c7' : b.status === 'completed' ? '#dbeafe' : '#fee2e2',
                          color: b.status === 'confirmed' ? '#166534' : b.status === 'pending' ? '#92400e' : b.status === 'completed' ? '#1e40af' : '#991b1b'
                        }}>{b.status}</span>
                      </td>
                      <td className="si-073b955b">{b.reasonForVisit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookingsTotal > 15 && (
                <div className="pagination si-216c99b7">
                  <button disabled={bookingsPage === 0} onClick={() => setBookingsPage(p => p - 1)}>← Prev</button>
                  <span className="si-24635ff2">
                    Page {bookingsPage + 1} of {Math.ceil(bookingsTotal / 15)}
                  </span>
                  <button disabled={(bookingsPage + 1) * 15 >= bookingsTotal} onClick={() => setBookingsPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Settings ── */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSettingsSave} className="vh-form">
          <h3 className="si-33c1a83e">{t('vetHospitalManage.settings.title')}</h3>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitals.form.hospitalName')}</label>
              <input required value={settingsForm.name || ''} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('common.type')}</label>
              <select value={settingsForm.hospitalType || 'clinic'} onChange={e => setSettingsForm(f => ({ ...f, hospitalType: e.target.value as any }))}>
                {Object.entries(HOSPITAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('vetHospitals.form.tagline')}</label>
            <input value={settingsForm.tagline || ''} onChange={e => setSettingsForm(f => ({ ...f, tagline: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>{t('common.description')}</label>
            <textarea rows={3} value={settingsForm.description || ''} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitals.form.city')}</label>
              <input value={settingsForm.city || ''} onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('vetHospitals.form.state')}</label>
              <input value={settingsForm.state || ''} onChange={e => setSettingsForm(f => ({ ...f, state: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitals.form.phone')}</label>
              <input value={settingsForm.phone || ''} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('vetHospitals.form.email')}</label>
              <input type="email" value={settingsForm.email || ''} onChange={e => setSettingsForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitals.form.website')}</label>
              <input value={settingsForm.website || ''} onChange={e => setSettingsForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.settings.fullAddress')}</label>
              <input value={settingsForm.address || ''} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <div className="si-c8512b7d">
            <label className="vh-toggle si-5afcd5fa">
              <input type="checkbox" checked={!!settingsForm.hasEmergency} onChange={e => setSettingsForm(f => ({ ...f, hasEmergency: e.target.checked }))} />
              {t('vetHospitalManage.settings.hasEmergency')}
            </label>
            <label className="vh-toggle">
              <input type="checkbox" checked={!!settingsForm.is24Hours} onChange={e => setSettingsForm(f => ({ ...f, is24Hours: e.target.checked }))} />
              {t('vetHospitalManage.settings.open24h')}
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">{t('vetHospitalManage.settings.saveBtn')}</button>
          </div>
        </form>
      )}

      {/* ── Invite Doctor Modal ── */}
      {showInviteDoctor && (
        <div className="modal-overlay" onClick={() => setShowInviteDoctor(false)}>
          <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInviteDoctor(false)}>✕</button>
            <h2>{t('consultations.pageTitle')}</h2>
            <p className="si-35176fa1">
              Create an invitation for a new doctor to join your hospital. Share the invite link with them to set up their account.
            </p>

            {inviteLink ? (
              /* ── Success: show the invite link ── */
              <div>
                <div className="modal-alert success">✅ Invitation created! Share this link with the doctor:</div>
                <div className="si-91a145cf">
                  <input readOnly value={inviteLink} className="si-7ddfee34" onClick={e => (e.target as HTMLInputElement).select()} />
                  <button type="button" className="btn-primary si-c3aee843" onClick={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied('modal'); setTimeout(() => setLinkCopied(''), 2000) }}>
                    {linkCopied === 'modal' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <p className="si-6c6d83b6">
                  ⚠️ This link expires in 7 days. The doctor will use it to create their account and join the hospital automatically.
                </p>
                <div className="form-actions si-216c99b7">
                  <button type="button" className="btn-secondary" onClick={() => setShowInviteDoctor(false)}>{t('common.close')}</button>
                  <button type="button" className="btn-primary" onClick={() => { setInviteLink(''); setModalMsg(null); setLinkCopied('') }}>{t('vetHospitalManage.invite.inviteAnother')}</button>
                </div>
              </div>
            ) : (
              /* ── Form: collect invite details ── */
              <form onSubmit={handleInviteSubmit} className="vh-form">
                {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
                <div className="form-group">
                  <label>{t('vetHospitalManage.invite.emailAddress')}</label>
                  <input type="email" required value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@example.com" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('vetHospitalManage.invite.firstName')}</label>
                    <input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} placeholder="(optional)" />
                  </div>
                  <div className="form-group">
                    <label>{t('vetHospitalManage.invite.lastName')}</label>
                    <input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} placeholder="(optional)" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('vetHospitals.form.phone')}</label>
                    <input value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder="(optional)" />
                  </div>
                  <div className="form-group">
                    <label>{t('vetHospitalManage.modal.hospitalRole')}</label>
                    <select value={inviteForm.hospitalRole} onChange={e => setInviteForm(f => ({ ...f, hospitalRole: e.target.value }))}>
                      {HOSPITAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                    </select>
                  </div>
                </div>
                {departments.length > 0 && (
                  <div className="form-group">
                    <label>{t('vetHospitalManage.invite.department')}</label>
                    <select value={inviteForm.departmentId} onChange={e => setInviteForm(f => ({ ...f, departmentId: e.target.value }))}>
                      <option value="">— None —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowInviteDoctor(false)}>{t('common.cancel')}</button>
                  <button type="submit" className="btn-primary">{t('vetHospitalManage.invite.createInvitation')}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Add/Edit Doctor Modal ── */}
      {showAddDoctor && (
        <div className="modal-overlay" onClick={closeDocModal}>
          <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDocModal}>✕</button>
            <h2>{editDoctor ? t('vetHospitalManage.modal.editDoctor') : t('vetHospitalManage.modal.addDoctor')}</h2>
            <form onSubmit={handleDoctorSubmit} className="vh-form">
              {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
              {!editDoctor && (
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.selectVet')}</label>
                  {selectedVetName ? (
                    <div className="vet-selected-chip">
                      <span>👨‍⚕️ {selectedVetName}</span>
                      <button type="button" className="vet-chip-clear" onClick={() => {
                        setSelectedVetName(''); setDoctorForm(f => ({ ...f, doctorId: '' }))
                      }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={vetSearch}
                        onChange={e => setVetSearch(e.target.value)}
                        placeholder="Search by name, email, or specialization..."
                        autoComplete="off"
                        className="si-3c64c436"
                      />
                      {allSpecializations.length > 0 && (
                        <div className="si-8d41d654">
                          <button type="button" onClick={() => setSpecFilter('')}
                            style={{ padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: specFilter === '' ? 700 : 400, background: specFilter === '' ? '#2563eb' : '#e2e8f0', color: specFilter === '' ? '#fff' : '#475569' }}>All</button>
                          {allSpecializations.slice(0, 8).map(s => (
                            <button type="button" key={s} onClick={() => setSpecFilter(specFilter === s ? '' : s)}
                              style={{ padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: specFilter === s ? 700 : 400, background: specFilter === s ? '#2563eb' : '#e2e8f0', color: specFilter === s ? '#fff' : '#475569' }}>{s}</button>
                          ))}
                        </div>
                      )}
                      <div className="si-d252a329">
                        {vetSearchLoading && <div className="si-61ce8c47">Loading veterinarians…</div>}
                        {!vetSearchLoading && filteredVets.length === 0 && (
                          <div className="si-61ce8c47">
                            {allVets.length === 0 ? 'No veterinarians registered in the system' : 'No matching veterinarians'}
                          </div>
                        )}
                        {!vetSearchLoading && filteredVets.map((v: any) => (
                          <div key={v.userId}
                            onClick={() => {
                              setDoctorForm(f => ({ ...f, doctorId: v.userId }))
                              setSelectedVetName(`${v.firstName || ''} ${v.lastName || ''}`.trim() + (v.email ? ` (${v.email})` : ''))
                            }}
                            className="si-42884720"
                            onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div className="si-26d7edc3">
                              <div className="si-a9b7f385">👨‍⚕️ {v.firstName} {v.lastName}</div>
                              <div className="si-7f4ca63a">{v.email}</div>
                              {v.specializations?.length > 0 && (
                                <div className="si-f49f847e">
                                  {v.specializations.slice(0, 3).map((s: string) => (
                                    <span key={s} className="si-03983371">{s}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="si-d052cd20">
                              {v.rating > 0 && <div className="si-7c2973e6">⭐ {Number(v.rating).toFixed(1)}</div>}
                              {v.yearsOfExperience > 0 && <div className="si-26b03e6b">{v.yearsOfExperience} yrs exp</div>}
                              <div style={{ fontSize: 10, color: v.isAvailable ? '#059669' : '#dc2626', fontWeight: 600 }}>{v.isAvailable ? '● Available' : '○ Unavailable'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!vetSearchLoading && allVets.length > 0 && (
                        <div className="si-0610a7ce">Showing {filteredVets.length} of {allVets.length} veterinarians{existingDoctorIds.size > 0 ? ` (${existingDoctorIds.size} already added)` : ''}</div>
                      )}
                    </>
                  )}
                  <input type="hidden" required value={doctorForm.doctorId} />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.hospitalRole')}</label>
                  <select value={doctorForm.hospitalRole} onChange={e => setDoctorForm(f => ({ ...f, hospitalRole: e.target.value }))}>
                    {HOSPITAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.employmentType')}</label>
                  <select value={doctorForm.employmentType} onChange={e => setDoctorForm(f => ({ ...f, employmentType: e.target.value }))}>
                    {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.titleDesignation')}</label>
                  <input value={doctorForm.title} onChange={e => setDoctorForm(f => ({ ...f, title: e.target.value }))} placeholder="Dr., Prof., etc." />
                </div>
                <div className="form-group">
                  <label>{t('vetHospitalManage.invite.department')}</label>
                  <select value={doctorForm.departmentId} onChange={e => setDoctorForm(f => ({ ...f, departmentId: e.target.value }))}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{t('vetHospitalManage.modal.consultationFee', { currency: settings.currency })}</label>
                <input type="number" value={doctorForm.consultationFee} onChange={e => setDoctorForm(f => ({ ...f, consultationFee: e.target.value }))} placeholder="e.g. 500" min="0" />
              </div>
              <label className="vh-toggle si-5afcd5fa">
                <input type="checkbox" checked={doctorForm.isPrimaryHospital} onChange={e => setDoctorForm(f => ({ ...f, isPrimaryHospital: e.target.checked }))} />
                {t('vetHospitalManage.modal.primaryHospital')}
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeDocModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary">{editDoctor ? t('vetHospitalManage.settings.saveBtn') : t('vetHospitalManage.modal.addDoctor')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Department Modal ── */}
      {showAddDept && (
        <div className="modal-overlay" onClick={closeDeptModal}>
          <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDeptModal}>✕</button>
            <h2>{editDept ? t('vetHospitalManage.modal.editDept') : t('vetHospitalManage.modal.addDept')}</h2>
            <form onSubmit={handleDeptSubmit} className="vh-form">
              {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.deptName')}</label>
                  <input required value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.code')}</label>
                  <input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CARDIO" />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('vetHospitalManage.modal.specializations')}</label>
                <input value={deptForm.specializations} onChange={e => setDeptForm(f => ({ ...f, specializations: e.target.value }))} placeholder="Cardiology, Neurology" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.floorLocation')}</label>
                  <input value={deptForm.floorNumber} onChange={e => setDeptForm(f => ({ ...f, floorNumber: e.target.value }))} placeholder="Floor 2, Block A" />
                </div>
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.headDoctor')}</label>
                  <select value={deptForm.headDoctorId} onChange={e => setDeptForm(f => ({ ...f, headDoctorId: e.target.value }))}>
                    <option value="">— None —</option>
                    {doctors.map(d => <option key={d.doctorId} value={d.doctorId}>{d.doctorName || d.doctorId}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeDeptModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary">{editDept ? t('vetHospitalManage.settings.saveBtn') : t('vetHospitalManage.modal.createDept')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Service Modal ── */}
      {showAddService && (
        <div className="modal-overlay" onClick={closeServiceModal}>
          <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeServiceModal}>✕</button>
            <h2>{editService ? t('vetHospitalManage.modal.editService') : t('vetHospitalManage.modal.addService')}</h2>
            <form onSubmit={handleServiceSubmit} className="vh-form">
              {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.serviceName')}</label>
                  <input required value={serviceForm.serviceName} onChange={e => setServiceForm(f => ({ ...f, serviceName: e.target.value }))} placeholder="e.g. Abdominal Ultrasound" />
                </div>
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.category')}</label>
                  <select value={serviceForm.category} onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}>
                    {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.minPrice', { currency: settings.currency })}</label>
                  <input type="number" value={serviceForm.priceMin} onChange={e => setServiceForm(f => ({ ...f, priceMin: e.target.value }))} min="0" />
                </div>
                <div className="form-group">
                  <label>{t('vetHospitalManage.modal.maxPrice', { currency: settings.currency })}</label>
                  <input type="number" value={serviceForm.priceMax} onChange={e => setServiceForm(f => ({ ...f, priceMax: e.target.value }))} min="0" />
                </div>
              </div>
              <div className="form-group">
                <label>{t('vetHospitalManage.modal.duration')}</label>
                <input type="number" value={serviceForm.durationMinutes} onChange={e => setServiceForm(f => ({ ...f, durationMinutes: e.target.value }))} min="5" step="5" />
              </div>
              <label className="vh-toggle si-5afcd5fa">
                <input type="checkbox" checked={serviceForm.requiresAppointment} onChange={e => setServiceForm(f => ({ ...f, requiresAppointment: e.target.checked }))} />
                {t('vetHospitalManage.modal.requiresAppointment')}
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeServiceModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary">{editService ? t('vetHospitalManage.settings.saveBtn') : t('vetHospitalManage.modal.createService')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin: Document Review Modal ── */}
      {reviewForm && (
        <div className="modal-overlay" onClick={() => { setReviewForm(null); setModalMsg(null) }}>
          <div className="modal-content si-3196bd33" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setReviewForm(null); setModalMsg(null) }}>✕</button>
            <h2 className="si-33c1a83e">
              {reviewForm.status === 'approved' ? '✓ Approve Document' : '✗ Reject Document'}
            </h2>
            <p className="si-afed7db4">
              {reviewForm.status === 'approved'
                ? 'Are you sure you want to approve this document?'
                : 'Please provide a reason for rejection so the hospital owner can correct it.'}
            </p>
            {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
            {reviewForm.status === 'rejected' && (
              <div className="form-group">
                <label>Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Document is blurry / expired / incorrect format"
                  value={reviewForm.reason}
                  onChange={e => setReviewForm(f => f ? { ...f, reason: e.target.value } : null)}
                />
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => { setReviewForm(null); setModalMsg(null) }}>{t('common.cancel')}</button>
              <button
                type="button"
                className={reviewForm.status === 'approved' ? 'btn-primary' : 'btn-danger'}
                onClick={handleAdminReview}
                disabled={reviewForm.status === 'rejected' && !reviewForm.reason.trim()}
              >
                {reviewForm.status === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Document Viewer Modal ──────────────────────────── */}
      {docViewModal && (
        <div className="si-9c6164ca" onClick={() => setDocViewModal(null)}>
          <div className="si-56d8d394" onClick={e => e.stopPropagation()}>
            <div className="si-95e025b0">
              <h3 className="si-36330245">📄 {docViewModal.name}</h3>
              <button onClick={() => setDocViewModal(null)}
                className="si-06279df8">✕</button>
            </div>
            <div className="si-c9793de6">
              {/\.(jpe?g|png|gif|webp|svg)$/i.test(docViewModal.name)
                ? <img src={docViewModal.url} alt={docViewModal.name} className="si-e8617b4e" />
                : <iframe src={docViewModal.url} title={docViewModal.name} className="si-066874ad" />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VetHospitalManage

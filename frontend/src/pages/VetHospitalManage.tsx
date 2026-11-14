import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import type { VetHospital, HospitalDepartment, HospitalDoctor, HospitalService, HospitalStats, HospitalDocument } from '../types'
import { EXPIRY_DOC_TYPES, REQUIRED_DOC_TYPES } from '../types'
import type { DocType } from '../types/hospital'
import './ModulePage.css'
import './VetHospitals.css'
import { useSettings } from '../context/SettingsContext'
import { useTranslation } from 'react-i18next'
import type { Tab } from '../components/vetHospitalManage/vetHospitalManageShared'
import { HOSPITAL_TYPE_LABELS } from '../components/vetHospitalManage/vetHospitalManageShared'
import VerificationBanner from '../components/vetHospitalManage/VerificationBanner'
import OverviewTab from '../components/vetHospitalManage/OverviewTab'
import DoctorsTab from '../components/vetHospitalManage/DoctorsTab'
import DepartmentsTab from '../components/vetHospitalManage/DepartmentsTab'
import ServicesTab from '../components/vetHospitalManage/ServicesTab'
import DocumentsTab from '../components/vetHospitalManage/DocumentsTab'
import AppointmentsTab from '../components/vetHospitalManage/AppointmentsTab'
import SettingsTab from '../components/vetHospitalManage/SettingsTab'
import InviteDoctorModal from '../components/vetHospitalManage/InviteDoctorModal'
import AddEditDoctorModal from '../components/vetHospitalManage/AddEditDoctorModal'
import AddEditDepartmentModal from '../components/vetHospitalManage/AddEditDepartmentModal'
import AddEditServiceModal from '../components/vetHospitalManage/AddEditServiceModal'
import DocumentReviewModal from '../components/vetHospitalManage/DocumentReviewModal'
import DocViewerModal from '../components/vetHospitalManage/DocViewerModal'

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
  // Per-modal feedback message (shared - only one modal open at a time)
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

  const handleFileSelected = async (docType: DocType, file: File) => {
    const needsExpiry = EXPIRY_DOC_TYPES.includes(docType)
    const expiryDate = needsExpiry ? expiryDates[docType] || undefined : undefined
    if (needsExpiry && !expiryDate) {
      setDocError(p => ({ ...p, [docType]: 'Please enter the expiry date before uploading' }))
      return
    }
    await handleDocUpload(docType, file, expiryDate)
  }

  const handleExpiryChange = (docType: string, value: string) => {
    setExpiryDates(p => ({ ...p, [docType]: value }))
    setDocError(p => ({ ...p, [docType]: '' }))
  }

  const handleSetReviewForm = (docId: string, status: 'approved' | 'rejected') => setReviewForm({ docId, status, reason: '' })

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

      <VerificationBanner t={t} hospital={hospital} onManageDocuments={() => setActiveTab('documents')} />

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

      {activeTab === 'overview' && (
        <OverviewTab t={t} hospital={hospital} doctors={doctors} departments={departments} services={services} stats={stats}
          onQuickAddDoctor={() => { setActiveTab('doctors'); setShowAddDoctor(true) }}
          onQuickAddDept={() => { setActiveTab('departments'); setShowAddDept(true) }}
          onQuickAddService={() => { setActiveTab('services'); setShowAddService(true) }}
          onEditProfile={() => setActiveTab('settings')}
        />
      )}

      {activeTab === 'doctors' && (
        <DoctorsTab t={t} doctors={doctors} departments={departments} invites={invites} linkCopied={linkCopied}
          onInviteNew={() => { setModalMsg(null); setInviteLink(''); setLinkCopied(''); setInviteForm({ email: '', firstName: '', lastName: '', phone: '', hospitalRole: 'staff', departmentId: '' }); setShowInviteDoctor(true) }}
          onAddExisting={() => { setEditDoctor(null); setDoctorForm({ doctorId: '', hospitalRole: 'staff', employmentType: 'full_time', departmentId: '', title: '', consultationFee: '', isPrimaryHospital: false }); setShowAddDoctor(true) }}
          onRevokeInvite={handleRevokeInvite}
          onCopyInviteLink={(url, id) => { navigator.clipboard.writeText(url); setLinkCopied(id); setTimeout(() => setLinkCopied(''), 2000) }}
          onEditDoctor={openEditDoctor}
          onRemoveDoctor={handleRemoveDoctor}
        />
      )}

      {activeTab === 'departments' && (
        <DepartmentsTab t={t} departments={departments} doctors={doctors}
          onAddDept={() => { setEditDept(null); setDeptForm({ name: '', code: '', description: '', specializations: '', floorNumber: '', headDoctorId: '' }); setShowAddDept(true) }}
          onEditDept={openEditDept}
          onDeleteDept={handleDeleteDept}
        />
      )}

      {activeTab === 'services' && (
        <ServicesTab t={t} services={services} formatCurrency={formatCurrency}
          onAddService={() => { setEditService(null); setServiceForm({ serviceName: '', category: 'consultation', description: '', priceMin: '', priceMax: '', durationMinutes: '', requiresAppointment: false }); setShowAddService(true) }}
          onEditService={openEditService}
          onDeleteService={handleDeleteService}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab userRole={user?.role} documents={documents} docUploading={docUploading} docError={docError} expiryDates={expiryDates}
          fileInputRefs={fileInputRefs}
          onExpiryChange={handleExpiryChange}
          onFileSelected={handleFileSelected}
          onViewDoc={(url, name) => setDocViewModal({ url, name })}
          onSetReviewForm={handleSetReviewForm}
        />
      )}

      {activeTab === 'appointments' && (
        <AppointmentsTab t={t} bookings={bookings} bookingsLoading={bookingsLoading} bookingsTotal={bookingsTotal}
          bookingsPage={bookingsPage} bookingsStatusFilter={bookingsStatusFilter} formatSlotTime={formatSlotTime}
          onStatusFilterChange={v => { setBookingsStatusFilter(v); setBookingsPage(0) }}
          onRefresh={() => hospital && loadBookings(hospital.id, bookingsPage, bookingsStatusFilter)}
          onPrevPage={() => setBookingsPage(p => p - 1)}
          onNextPage={() => setBookingsPage(p => p + 1)}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab t={t} settingsForm={settingsForm} setSettingsForm={setSettingsForm} onSubmit={handleSettingsSave} />
      )}

      <InviteDoctorModal t={t} show={showInviteDoctor} onClose={() => setShowInviteDoctor(false)}
        inviteForm={inviteForm} setInviteForm={setInviteForm} departments={departments}
        modalMsg={modalMsg} inviteLink={inviteLink} linkCopied={linkCopied}
        onSubmit={handleInviteSubmit}
        onCopyLink={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied('modal'); setTimeout(() => setLinkCopied(''), 2000) }}
        onInviteAnother={() => { setInviteLink(''); setModalMsg(null); setLinkCopied('') }}
      />

      <AddEditDoctorModal t={t} show={showAddDoctor} editDoctor={editDoctor} doctorForm={doctorForm} setDoctorForm={setDoctorForm}
        modalMsg={modalMsg} vetSearch={vetSearch} setVetSearch={setVetSearch} allVets={allVets} vetSearchLoading={vetSearchLoading}
        selectedVetName={selectedVetName} setSelectedVetName={setSelectedVetName} specFilter={specFilter} setSpecFilter={setSpecFilter}
        filteredVets={filteredVets} allSpecializations={allSpecializations} existingDoctorIdsCount={existingDoctorIds.size}
        departments={departments} currency={settings.currency} onClose={closeDocModal} onSubmit={handleDoctorSubmit}
      />

      <AddEditDepartmentModal t={t} show={showAddDept} editDept={editDept} deptForm={deptForm} setDeptForm={setDeptForm}
        modalMsg={modalMsg} doctors={doctors} onClose={closeDeptModal} onSubmit={handleDeptSubmit}
      />

      <AddEditServiceModal t={t} show={showAddService} editService={editService} serviceForm={serviceForm} setServiceForm={setServiceForm}
        modalMsg={modalMsg} currency={settings.currency} onClose={closeServiceModal} onSubmit={handleServiceSubmit}
      />

      <DocumentReviewModal t={t} reviewForm={reviewForm} setReviewForm={setReviewForm} modalMsg={modalMsg}
        onClose={() => { setReviewForm(null); setModalMsg(null) }} onSubmit={handleAdminReview}
      />

      <DocViewerModal docViewModal={docViewModal} onClose={() => setDocViewModal(null)} />
    </div>
  )
}

export default VetHospitalManage

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import type { VetHospital, HospitalDepartment, HospitalDoctor, HospitalService, HospitalStats, HospitalDocument } from '../types'
import { DOC_LABELS, REQUIRED_DOC_TYPES, EXPIRY_DOC_TYPES } from '../types'
import './ModulePage.css'
import './VetHospitals.css'

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
  // Vet search autocomplete
  const [vetSearch, setVetSearch] = useState('')
  const [vetResults, setVetResults] = useState<any[]>([])
  const [vetSearchLoading, setVetSearchLoading] = useState(false)
  const [selectedVetName, setSelectedVetName] = useState('')
  const [showVetDropdown, setShowVetDropdown] = useState(false)
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
      vetHospitalApi.listInvites(hospital.id).then(data => { setInvites(data); setInvitesLoaded(true) }).catch(() => {})
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
      setModalMsg({ text: 'Invitation created! Share the link below with the doctor.', isError: false })
      setInviteForm({ email: '', firstName: '', lastName: '', phone: '', hospitalRole: 'staff', departmentId: '' })
      setInvitesLoaded(false)
    } catch (err: any) {
      setModalMsg({ text: err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to send invite', isError: true })
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!hospital) return
    try {
      await vetHospitalApi.revokeInvite(hospital.id, inviteId)
      setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: 'revoked' } : inv))
    } catch {}
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
      } catch { setError('Failed to load hospital data') }
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
      flash('Document uploaded successfully')
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

  // Debounced vet search for Add Doctor autocomplete
  useEffect(() => {
    if (!vetSearch.trim() || vetSearch.length < 2) { setVetResults([]); setShowVetDropdown(false); return }
    setVetSearchLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await apiService.listVets({ search: vetSearch, limit: 5 })
        const vets = res?.data?.vets || res?.vets || (Array.isArray(res?.data) ? res.data : [])
        setVetResults(vets)
        setShowVetDropdown(vets.length > 0)
      } catch { setVetResults([]); setShowVetDropdown(false) }
      finally { setVetSearchLoading(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [vetSearch])

  // ── Doctor ops ──────────────────────────────────────────────────────────
  const closeDocModal = () => {
    setShowAddDoctor(false); setEditDoctor(null)
    setVetSearch(''); setVetResults([]); setShowVetDropdown(false)
    setSelectedVetName(''); setDoctorForm({ doctorId: '', hospitalRole: 'staff', employmentType: 'full_time', departmentId: '', title: '', consultationFee: '', isPrimaryHospital: false })
    setModalMsg(null)
  }
  const closeDeptModal = () => { setShowAddDept(false); setEditDept(null); setModalMsg(null) }
  const closeServiceModal = () => { setShowAddService(false); setEditService(null); setModalMsg(null) }
  const mFlash = (text: string, isError = false) => setModalMsg({ text, isError })
  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital) return
    if (!editDoctor && !doctorForm.doctorId) { mFlash('Please select a veterinarian from the search results', true); return }
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
        flash('Doctor updated ✓')
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
        flash('Doctor added to hospital ✓')
        closeDocModal()
      }
      const docs = await vetHospitalApi.listDoctors(hospital.id); setDoctors(docs)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || 'Operation failed', true) }
  }

  const handleRemoveDoctor = async (doc: HospitalDoctor) => {
    if (!hospital || !window.confirm(`Remove ${doc.doctorName || doc.doctorId}?`)) return
    try {
      await vetHospitalApi.removeDoctor(hospital.id, doc.doctorId)
      flash('Doctor removed')
      setDoctors(prev => prev.filter(d => d.doctorId !== doc.doctorId))
    } catch { flash('Failed to remove doctor', true) }
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
        flash('Department updated ✓')
        closeDeptModal()
      } else {
        await vetHospitalApi.createDepartment(hospital.id, {
          name: deptForm.name, code: deptForm.code || undefined,
          description: deptForm.description || undefined,
          specializations: deptForm.specializations ? deptForm.specializations.split(',').map(s => s.trim()) : undefined,
          floorNumber: deptForm.floorNumber || undefined,
          headDoctorId: deptForm.headDoctorId || undefined,
        })
        flash('Department created ✓')
        closeDeptModal()
      }
      const depts = await vetHospitalApi.listDepartments(hospital.id); setDepartments(depts)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || 'Operation failed', true) }
  }

  const handleDeleteDept = async (dept: HospitalDepartment) => {
    if (!hospital || !window.confirm(`Delete department "${dept.name}"?`)) return
    try {
      await vetHospitalApi.deleteDepartment(hospital.id, dept.id)
      flash('Department deleted')
      setDepartments(prev => prev.filter(d => d.id !== dept.id))
    } catch { flash('Failed to delete department', true) }
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
        flash('Service updated ✓')
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
        flash('Service added ✓')
        closeServiceModal()
      }
      const svcs = await vetHospitalApi.listServices(hospital.id); setServices(svcs)
    } catch (err: any) { mFlash(err?.response?.data?.message || err?.response?.data?.error?.message || 'Operation failed', true) }
  }

  const handleDeleteService = async (svc: HospitalService) => {
    if (!hospital || !window.confirm(`Delete service "${svc.serviceName}"?`)) return
    try {
      await vetHospitalApi.deleteService(hospital.id, svc.id)
      flash('Service deleted')
      setServices(prev => prev.filter(s => s.id !== svc.id))
    } catch { flash('Failed to delete service', true) }
  }

  // ── Settings save ────────────────────────────────────────────────────────
  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospital) return
    try {
      const updated = await vetHospitalApi.updateHospital(hospital.id, settingsForm as any)
      setHospital(updated); flash('Hospital profile updated')
    } catch (err: any) { flash(err?.response?.data?.message || err?.response?.data?.error?.message || 'Update failed', true) }
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
  if (!hospital) return <div className="empty-state"><h3>No hospital found</h3><button className="btn-primary" onClick={() => navigate('/vet-hospitals')}>Browse Hospitals</button></div>

  return (
    <div className="module-page">
      {/* Header */}
      <div className="vh-manage-header">
        <div>
          <h1 className="module-title">🏥 {hospital.name}</h1>
          <p className="module-subtitle" style={{ margin: 0 }}>
            {HOSPITAL_TYPE_LABELS[hospital.hospitalType] || hospital.hospitalType}
            {hospital.isVerified && <span className="badge badge-verified" style={{ marginLeft: '.5rem' }}>✓ Verified</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {hospitals.length > 1 && (
            <select className="vh-select" value={hospital.id}
              onChange={async e => {
                const h = hospitals.find(x => x.id === e.target.value)
                if (h) { setLoading(true); await loadHospital(h); setLoading(false) }
              }}>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button className="btn-secondary" onClick={() => navigate(`/vet-hospitals/${hospital.id}`)}>View Public Profile</button>
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
              <button className="vstatus-action-btn" onClick={() => setActiveTab('documents')}>Manage Documents</button>
            )}
          </div>
        )
      })()}

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="success-message" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* Tabs */}
      <div className="vh-profile-tabs">
        {(['overview','doctors','departments','services','appointments','documents','settings'] as Tab[]).map(t => (
          <button key={t} className={`vh-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'overview' ? '📊 Overview' : t === 'doctors' ? `👨‍⚕️ Doctors (${doctors.length})` :
              t === 'departments' ? `🏢 Depts (${departments.length})` :
              t === 'services' ? `💊 Services (${services.length})` :
              t === 'appointments' ? '📅 Appointments' :
              t === 'documents' ? `📄 Documents (${documents.length}/${REQUIRED_DOC_TYPES.length})` :
              '⚙ Settings'}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div>
          <div className="vh-manage-stats">
            {[
              { label: 'Doctors', value: doctors.length, icon: '👨‍⚕️' },
              { label: 'Departments', value: departments.length, icon: '🏢' },
              { label: 'Services', value: services.length, icon: '💊' },
              { label: 'Avg Rating', value: hospital.rating > 0 ? Number(hospital.rating).toFixed(1) : '—', icon: '⭐' },
              { label: 'Total Reviews', value: hospital.totalReviews, icon: '💬' },
              { label: 'Status', value: hospital.isActive ? 'Active' : 'Inactive', icon: '🔘' },
            ].map(s => (
              <div key={s.label} className="vh-stat-card">
                <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
                <div className="vh-stat-value">{s.value}</div>
                <div className="vh-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          {stats && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Accepting Patients</h3>
              <p>{doctors.filter(d => d.isAcceptingPatients).length} of {doctors.length} doctors are accepting new patients</p>
            </div>
          )}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => { setActiveTab('doctors'); setShowAddDoctor(true) }}>+ Add Doctor</button>
              <button className="btn-secondary" onClick={() => { setActiveTab('departments'); setShowAddDept(true) }}>+ Add Department</button>
              <button className="btn-secondary" onClick={() => { setActiveTab('services'); setShowAddService(true) }}>+ Add Service</button>
              <button className="btn-secondary" onClick={() => setActiveTab('settings')}>Edit Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctors ── */}
      {activeTab === 'doctors' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
            <h3 style={{ margin: 0 }}>Staff ({doctors.length})</h3>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn-secondary" onClick={() => { setModalMsg(null); setInviteLink(''); setLinkCopied(''); setInviteForm({ email: '', firstName: '', lastName: '', phone: '', hospitalRole: 'staff', departmentId: '' }); setShowInviteDoctor(true) }}>✉ Invite New Doctor</button>
              <button className="btn-primary" onClick={() => { setEditDoctor(null); setDoctorForm({ doctorId: '', hospitalRole: 'staff', employmentType: 'full_time', departmentId: '', title: '', consultationFee: '', isPrimaryHospital: false }); setShowAddDoctor(true) }}>+ Add Existing</button>
            </div>
          </div>

          {/* Pending Invites */}
          {invites.filter(i => i.status === 'pending').length > 0 && (
            <div style={{ marginBottom: '1rem', background: '#fffbeb', borderRadius: 10, padding: '.75rem 1rem', border: '1px solid #fde68a' }}>
              <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.5rem' }}>📨 Pending Invitations ({invites.filter(i => i.status === 'pending').length})</div>
              {invites.filter(i => i.status === 'pending').map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.35rem 0', borderBottom: '1px solid #fef3c7', fontSize: '.88rem' }}>
                  <span style={{ flex: 1 }}>
                    <strong>{inv.first_name || ''} {inv.last_name || ''}</strong> · {inv.email} · <span style={{ textTransform: 'capitalize' }}>{(inv.hospital_role || 'staff').replace(/_/g, ' ')}</span>
                  </span>
                  <span style={{ fontSize: '.78rem', color: '#92400e' }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                  {inv.inviteUrl && <button type="button" className="btn-secondary" style={{ fontSize: '.72rem', padding: '.15rem .45rem' }} onClick={() => { navigator.clipboard.writeText(inv.inviteUrl); setLinkCopied(inv.id); setTimeout(() => setLinkCopied(''), 2000) }}>{linkCopied === inv.id ? '✓ Copied' : '📋 Copy Link'}</button>}
                  <button className="btn-danger" style={{ fontSize: '.75rem', padding: '.2rem .5rem' }} onClick={() => handleRevokeInvite(inv.id)}>Revoke</button>
                </div>
              ))}
            </div>
          )}
          {doctors.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">👨‍⚕️</div><p>No staff added yet</p></div>
            : <div className="vh-doctor-grid">
                {doctors.map(doc => (
                  <div key={doc.id} className="vh-doctor-card">
                    <div className="vh-doctor-name">{doc.doctorName || `Doctor ${doc.doctorId.slice(0,6)}`}</div>
                    <div className="vh-doctor-role">{doc.hospitalRole?.replace(/_/g,' ')}</div>
                    {doc.title && <div style={{ fontSize: '.82rem' }}>{doc.title}</div>}
                    {doc.departmentId && <div className="vh-doctor-dept">{departments.find(d => d.id === doc.departmentId)?.name || 'Dept'}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginTop: '.3rem' }}>
                      <span style={{ fontSize: '.75rem', color: doc.isAcceptingPatients ? '#059669' : '#dc2626' }}>
                        {doc.isAcceptingPatients ? '● Accepting' : '● Not Accepting'}
                      </span>
                    </div>
                    <div className="vh-doctor-actions">
                      <button className="btn-secondary" style={{ fontSize: '.78rem', padding: '.25rem .6rem' }} onClick={() => openEditDoctor(doc)}>Edit</button>
                      <button className="btn-danger" style={{ fontSize: '.78rem', padding: '.25rem .6rem' }} onClick={() => handleRemoveDoctor(doc)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* ── Departments ── */}
      {activeTab === 'departments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Departments ({departments.length})</h3>
            <button className="btn-primary" onClick={() => { setEditDept(null); setDeptForm({ name: '', code: '', description: '', specializations: '', floorNumber: '', headDoctorId: '' }); setShowAddDept(true) }}>+ Add Department</button>
          </div>
          {departments.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">🏢</div><p>No departments yet</p></div>
            : <div className="vh-dept-grid">
                {departments.map(dept => (
                  <div key={dept.id} className="vh-dept-card">
                    <div className="vh-dept-name">{dept.name}</div>
                    {dept.code && <div style={{ fontSize: '.75rem', color: 'var(--text-muted,#888)' }}>Code: {dept.code}</div>}
                    {dept.description && <div style={{ fontSize: '.83rem', margin: '.25rem 0' }}>{dept.description}</div>}
                    {dept.specializations && dept.specializations.length > 0 && (
                      <div className="hcard-chips" style={{ margin: '.4rem 0' }}>
                        {dept.specializations.map(s => <span key={s} className="chip">{s}</span>)}
                      </div>
                    )}
                    <div style={{ fontSize: '.8rem', color: 'var(--text-muted,#888)', marginBottom: '.5rem' }}>
                      {doctors.filter(d => d.departmentId === dept.id).length} doctors
                    </div>
                    <div style={{ display: 'flex', gap: '.4rem' }}>
                      <button className="btn-secondary" style={{ fontSize: '.78rem', padding: '.25rem .6rem' }} onClick={() => openEditDept(dept)}>Edit</button>
                      <button className="btn-danger" style={{ fontSize: '.78rem', padding: '.25rem .6rem' }} onClick={() => handleDeleteDept(dept)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* ── Services ── */}
      {activeTab === 'services' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Services ({services.length})</h3>
            <button className="btn-primary" onClick={() => { setEditService(null); setServiceForm({ serviceName: '', category: 'consultation', description: '', priceMin: '', priceMax: '', durationMinutes: '', requiresAppointment: false }); setShowAddService(true) }}>+ Add Service</button>
          </div>
          {services.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">💊</div><p>No services yet</p></div>
            : <div className="vh-services-grid">
                {services.map(svc => (
                  <div key={svc.id} className="vh-service-card">
                    <div className="vh-service-cat">{svc.category}</div>
                    <div className="vh-service-name">{svc.serviceName}</div>
                    {(svc.priceMin || svc.priceMax) && (
                      <div className="vh-service-price">
                        {svc.priceMin && svc.priceMax && svc.priceMin !== svc.priceMax
                          ? `₹${svc.priceMin}–₹${svc.priceMax}`
                          : `₹${svc.priceMin || svc.priceMax}`}
                      </div>
                    )}
                    {svc.durationMinutes && <div className="vh-service-duration">⏱ {svc.durationMinutes} min</div>}
                    <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
                      <button className="btn-secondary" style={{ fontSize: '.78rem', padding: '.25rem .6rem' }} onClick={() => openEditService(svc)}>Edit</button>
                      <button className="btn-danger" style={{ fontSize: '.78rem', padding: '.25rem .6rem' }} onClick={() => handleDeleteService(svc)}>Delete</button>
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
              <h3 style={{ margin: 0 }}>Compliance Documents</h3>
              <p style={{ margin: '.25rem 0 0', fontSize: '.86rem', color: 'var(--text-muted,#888)' }}>
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
                      <a href={existing.fileUrl} target="_blank" rel="noreferrer" className="doc-view-link">View</a>
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
                        <div className="form-group" style={{ marginBottom: '.5rem' }}>
                          <label style={{ fontSize: '.8rem' }}>Expiry Date</label>
                          <input
                            type="date"
                            id={`expiry-${dt}`}
                            className="doc-expiry-input"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        ref={el => { fileInputRefs.current[dt] = el }}
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const expiryInput = document.getElementById(`expiry-${dt}`) as HTMLInputElement
                          const expiryDate = needsExpiry ? expiryInput?.value || undefined : undefined
                          if (needsExpiry && !expiryDate) {
                            setDocError(p => ({ ...p, [dt]: 'Please enter the expiry date before uploading' }))
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
              <h4 style={{ marginTop: 0 }}>Admin Actions</h4>
              <p style={{ fontSize: '.86rem', color: 'var(--text-muted,#888)' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Hospital Appointments</h3>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <select className="vh-select" value={bookingsStatusFilter} onChange={e => { setBookingsStatusFilter(e.target.value); setBookingsPage(0) }}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="btn-secondary" onClick={() => hospital && loadBookings(hospital.id, bookingsPage, bookingsStatusFilter)}>↻ Refresh</button>
            </div>
          </div>
          {bookingsLoading ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem 0' }}>Loading appointments...</p>
          ) : bookings.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📅</div>
              <p>No appointments found{bookingsStatusFilter ? ` with status "${bookingsStatusFilter}"` : ''}</p>
            </div>
          ) : (
            <>
              <table className="vh-admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <tr key={b.id}>
                      <td>{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : '—'}</td>
                      <td>{b.timeSlotStart || '—'}{b.timeSlotEnd ? ` – ${b.timeSlotEnd}` : ''}</td>
                      <td>{b.patientName || b.ownerName || '—'}</td>
                      <td>{b.vetName || b.veterinarianName || '—'}</td>
                      <td><span className="chip">{(b.bookingType || 'in_person').replace(/_/g, ' ')}</span></td>
                      <td>
                        <span className={`badge badge-${b.status}`} style={{
                          background: b.status === 'confirmed' ? '#dcfce7' : b.status === 'pending' ? '#fef3c7' : b.status === 'completed' ? '#dbeafe' : '#fee2e2',
                          color: b.status === 'confirmed' ? '#166534' : b.status === 'pending' ? '#92400e' : b.status === 'completed' ? '#1e40af' : '#991b1b'
                        }}>{b.status}</span>
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.reasonForVisit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookingsTotal > 15 && (
                <div className="pagination" style={{ marginTop: '1rem' }}>
                  <button disabled={bookingsPage === 0} onClick={() => setBookingsPage(p => p - 1)}>← Prev</button>
                  <span style={{ padding: '.4rem .75rem', fontSize: '.88rem', color: '#666' }}>
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
          <h3 style={{ marginTop: 0 }}>Hospital Profile</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Hospital Name *</label>
              <input required value={settingsForm.name || ''} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={settingsForm.hospitalType || 'clinic'} onChange={e => setSettingsForm(f => ({ ...f, hospitalType: e.target.value as any }))}>
                {Object.entries(HOSPITAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Tagline</label>
            <input value={settingsForm.tagline || ''} onChange={e => setSettingsForm(f => ({ ...f, tagline: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={3} value={settingsForm.description || ''} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input value={settingsForm.city || ''} onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input value={settingsForm.state || ''} onChange={e => setSettingsForm(f => ({ ...f, state: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={settingsForm.phone || ''} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={settingsForm.email || ''} onChange={e => setSettingsForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Website</label>
              <input value={settingsForm.website || ''} onChange={e => setSettingsForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Full Address</label>
              <input value={settingsForm.address || ''} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', margin: '.6rem 0 1rem' }}>
            <label className="vh-toggle" style={{ marginBottom: '.75rem' }}>
              <input type="checkbox" checked={!!settingsForm.hasEmergency} onChange={e => setSettingsForm(f => ({ ...f, hasEmergency: e.target.checked }))} />
              Has Emergency Services
            </label>
            <label className="vh-toggle">
              <input type="checkbox" checked={!!settingsForm.is24Hours} onChange={e => setSettingsForm(f => ({ ...f, is24Hours: e.target.checked }))} />
              Open 24 Hours
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      )}

      {/* ── Invite Doctor Modal ── */}
      {showInviteDoctor && (
        <div className="modal-overlay" onClick={() => setShowInviteDoctor(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInviteDoctor(false)}>✕</button>
            <h2>✉ Invite New Doctor</h2>
            <p style={{ fontSize: '.88rem', color: '#666', margin: '-.25rem 0 1rem' }}>
              Create an invitation for a new doctor to join your hospital. Share the invite link with them to set up their account.
            </p>

            {inviteLink ? (
              /* ── Success: show the invite link ── */
              <div>
                <div className="modal-alert success">✅ Invitation created! Share this link with the doctor:</div>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', margin: '.75rem 0' }}>
                  <input readOnly value={inviteLink} style={{ flex: 1, fontSize: '.82rem', padding: '.5rem .75rem', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', color: '#1f2937' }} onClick={e => (e.target as HTMLInputElement).select()} />
                  <button type="button" className="btn-primary" style={{ whiteSpace: 'nowrap', fontSize: '.82rem' }} onClick={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied('modal'); setTimeout(() => setLinkCopied(''), 2000) }}>
                    {linkCopied === 'modal' ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <p style={{ fontSize: '.78rem', color: '#92400e', background: '#fffbeb', padding: '.5rem .75rem', borderRadius: 8, margin: '.5rem 0' }}>
                  ⚠️ This link expires in 7 days. The doctor will use it to create their account and join the hospital automatically.
                </p>
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowInviteDoctor(false)}>Close</button>
                  <button type="button" className="btn-primary" onClick={() => { setInviteLink(''); setModalMsg(null); setLinkCopied('') }}>Invite Another</button>
                </div>
              </div>
            ) : (
              /* ── Form: collect invite details ── */
              <form onSubmit={handleInviteSubmit} className="vh-form">
                {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
                <div className="form-group">
                  <label>Email Address *</label>
                  <input type="email" required value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@example.com" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} placeholder="(optional)" />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} placeholder="(optional)" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder="(optional)" />
                  </div>
                  <div className="form-group">
                    <label>Hospital Role</label>
                    <select value={inviteForm.hospitalRole} onChange={e => setInviteForm(f => ({ ...f, hospitalRole: e.target.value }))}>
                      {HOSPITAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                    </select>
                  </div>
                </div>
                {departments.length > 0 && (
                  <div className="form-group">
                    <label>Department</label>
                    <select value={inviteForm.departmentId} onChange={e => setInviteForm(f => ({ ...f, departmentId: e.target.value }))}>
                      <option value="">— None —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowInviteDoctor(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Create Invitation</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Add/Edit Doctor Modal ── */}
      {showAddDoctor && (
        <div className="modal-overlay" onClick={closeDocModal}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDocModal}>✕</button>
            <h2>{editDoctor ? 'Edit Staff Member' : 'Add Doctor'}</h2>
            <form onSubmit={handleDoctorSubmit} className="vh-form">
              {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
              {!editDoctor && (
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Search Veterinarian *</label>
                  {selectedVetName ? (
                    <div className="vet-selected-chip">
                      <span>👨‍⚕️ {selectedVetName}</span>
                      <button type="button" className="vet-chip-clear" onClick={() => {
                        setSelectedVetName(''); setDoctorForm(f => ({ ...f, doctorId: '' }))
                        setVetSearch(''); setVetResults([]); setShowVetDropdown(false)
                      }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={vetSearch}
                        onChange={e => setVetSearch(e.target.value)}
                        placeholder="Type name or email to search..."
                        autoComplete="off"
                        onFocus={() => vetResults.length > 0 && setShowVetDropdown(true)}
                      />
                      {vetSearchLoading && <div className="vet-search-spinner">Searching…</div>}
                      {showVetDropdown && vetResults.length > 0 && (
                        <ul className="vet-search-dropdown">
                          {vetResults.map((v: any) => (
                            <li key={v.userId} onMouseDown={() => {
                              setDoctorForm(f => ({ ...f, doctorId: v.userId }))
                              setSelectedVetName(`${v.firstName || ''} ${v.lastName || ''}`.trim() + (v.email ? ` (${v.email})` : ''))
                              setVetSearch(''); setVetResults([]); setShowVetDropdown(false)
                            }}>
                              <strong>{v.firstName} {v.lastName}</strong>
                              <span>{v.email}</span>
                              {v.specializations?.length > 0 && <em>{v.specializations.slice(0,2).join(', ')}</em>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!vetSearchLoading && vetSearch.length >= 2 && vetResults.length === 0 && !showVetDropdown && (
                        <div className="vet-search-empty">No veterinarians found</div>
                      )}
                    </>
                  )}
                  {/* hidden required input so form validation fires when no vet selected */}
                  <input type="hidden" required value={doctorForm.doctorId} />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Hospital Role</label>
                  <select value={doctorForm.hospitalRole} onChange={e => setDoctorForm(f => ({ ...f, hospitalRole: e.target.value }))}>
                    {HOSPITAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Employment Type</label>
                  <select value={doctorForm.employmentType} onChange={e => setDoctorForm(f => ({ ...f, employmentType: e.target.value }))}>
                    {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Title / Designation</label>
                  <input value={doctorForm.title} onChange={e => setDoctorForm(f => ({ ...f, title: e.target.value }))} placeholder="Dr., Prof., etc." />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select value={doctorForm.departmentId} onChange={e => setDoctorForm(f => ({ ...f, departmentId: e.target.value }))}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Consultation Fee (₹)</label>
                <input type="number" value={doctorForm.consultationFee} onChange={e => setDoctorForm(f => ({ ...f, consultationFee: e.target.value }))} placeholder="e.g. 500" min="0" />
              </div>
              <label className="vh-toggle" style={{ marginBottom: '.75rem' }}>
                <input type="checkbox" checked={doctorForm.isPrimaryHospital} onChange={e => setDoctorForm(f => ({ ...f, isPrimaryHospital: e.target.checked }))} />
                Primary hospital for this doctor
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeDocModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editDoctor ? 'Save Changes' : 'Add Doctor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Department Modal ── */}
      {showAddDept && (
        <div className="modal-overlay" onClick={closeDeptModal}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDeptModal}>✕</button>
            <h2>{editDept ? 'Edit Department' : 'Add Department'}</h2>
            <form onSubmit={handleDeptSubmit} className="vh-form">
              {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Department Name *</label>
                  <input required value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Code</label>
                  <input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CARDIO" />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Specializations (comma-separated)</label>
                <input value={deptForm.specializations} onChange={e => setDeptForm(f => ({ ...f, specializations: e.target.value }))} placeholder="Cardiology, Neurology" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Floor / Location</label>
                  <input value={deptForm.floorNumber} onChange={e => setDeptForm(f => ({ ...f, floorNumber: e.target.value }))} placeholder="Floor 2, Block A" />
                </div>
                <div className="form-group">
                  <label>Head Doctor</label>
                  <select value={deptForm.headDoctorId} onChange={e => setDeptForm(f => ({ ...f, headDoctorId: e.target.value }))}>
                    <option value="">— None —</option>
                    {doctors.map(d => <option key={d.doctorId} value={d.doctorId}>{d.doctorName || d.doctorId}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeDeptModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editDept ? 'Save Changes' : 'Create Department'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Service Modal ── */}
      {showAddService && (
        <div className="modal-overlay" onClick={closeServiceModal}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeServiceModal}>✕</button>
            <h2>{editService ? 'Edit Service' : 'Add Service'}</h2>
            <form onSubmit={handleServiceSubmit} className="vh-form">
              {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Service Name *</label>
                  <input required value={serviceForm.serviceName} onChange={e => setServiceForm(f => ({ ...f, serviceName: e.target.value }))} placeholder="e.g. Abdominal Ultrasound" />
                </div>
                <div className="form-group">
                  <label>Category</label>
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
                  <label>Min Price (₹)</label>
                  <input type="number" value={serviceForm.priceMin} onChange={e => setServiceForm(f => ({ ...f, priceMin: e.target.value }))} min="0" />
                </div>
                <div className="form-group">
                  <label>Max Price (₹)</label>
                  <input type="number" value={serviceForm.priceMax} onChange={e => setServiceForm(f => ({ ...f, priceMax: e.target.value }))} min="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" value={serviceForm.durationMinutes} onChange={e => setServiceForm(f => ({ ...f, durationMinutes: e.target.value }))} min="5" step="5" />
              </div>
              <label className="vh-toggle" style={{ marginBottom: '.75rem' }}>
                <input type="checkbox" checked={serviceForm.requiresAppointment} onChange={e => setServiceForm(f => ({ ...f, requiresAppointment: e.target.checked }))} />
                Requires appointment
              </label>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeServiceModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editService ? 'Save Changes' : 'Add Service'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin: Document Review Modal ── */}
      {reviewForm && (
        <div className="modal-overlay" onClick={() => { setReviewForm(null); setModalMsg(null) }}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setReviewForm(null); setModalMsg(null) }}>✕</button>
            <h2 style={{ marginTop: 0 }}>
              {reviewForm.status === 'approved' ? '✓ Approve Document' : '✗ Reject Document'}
            </h2>
            <p style={{ color: 'var(--text-muted,#888)', fontSize: '.9rem' }}>
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
              <button type="button" className="btn-secondary" onClick={() => { setReviewForm(null); setModalMsg(null) }}>Cancel</button>
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
    </div>
  )
}

export default VetHospitalManage

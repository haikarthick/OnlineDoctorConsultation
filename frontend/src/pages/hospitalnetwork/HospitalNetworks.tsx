import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import NetworkRoleMatrix from './NetworkRoleMatrix'
import '../ModulePage.css'
import './HospitalNetworks.css'

// ─── Types ────────────────────────────────────────────────────────────────────
interface HospitalNetwork {
  id: string
  name: string
  legalName?: string
  registrationNumber?: string
  taxId?: string
  networkType?: string
  country?: string
  headquartersCity?: string
  headquartersState?: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  isActive: boolean
  isApproved: boolean
  createdAt: string
  updatedAt?: string
  approvedByName?: string
  memberCount?: number
  hospitalCount?: number
  idPrefix?: string
}

interface NetworkMember {
  id: string
  networkId: string
  userId: string
  networkRole: string
  hospitalId?: string
  isActive: boolean
  grantedAt: string
  userName?: string
  userEmail?: string
  userRole?: string
  hospitalName?: string
}

interface NetworkDashboard {
  totalMembers: number
  totalHospitals: number
  totalPatients: number
  activeConsents: number
  recentAccessLogs?: any[]
  membersByRole?: Record<string, number>
}

interface NetworkHospital {
  id: string
  name: string
  city?: string
  state?: string
  hospitalType?: string
  contactEmail?: string
  contactPhone?: string
  isVerified?: boolean
  isNetworkBranch?: boolean
  specializations?: string[]
  staffCount?: number
}

interface AuditEntry {
  id: string
  accessedBy: string
  accessorName: string
  accessorEmail: string
  accessorRole: string
  animalId: string
  animalName: string
  animalUniqueId: string
  recordType: string
  accessType: string
  accessGranted: boolean
  denialReason: string
  consentId: string
  accessedAt: string
}

interface AuditStats {
  total: number
  granted: number
  denied: number
  last7days: number
}

interface PatientSearchResult {
  userId: string
  userName: string
  userEmail: string
  userPhone?: string
  animals: Array<{ id: string; name: string; species: string; uniqueId?: string; }>
}

interface EnrollmentRecord {
  id: string
  animalId: string
  enrollmentStatus: string
  networkPatientId?: string
  enrollmentRequestedAt: string
  enrollmentRespondedAt?: string
  animalName: string
  species: string
  ownerName: string
  ownerEmail: string
}

interface WalkInInviteForm {
  patientName: string
  patientEmail: string
  patientPhone: string
  animalName: string
  animalSpecies: string
  message: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NETWORK_TYPES = [
  { value: 'private', label: 'Private' },
  { value: 'government', label: 'Government' },
  { value: 'ngo', label: 'NGO' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'franchise', label: 'Franchise' },
]

const MEMBER_ROLES = [
  { value: 'corporate_admin', label: 'Corporate Admin' },
  { value: 'hospital_director', label: 'Hospital Director' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'hospital_staff', label: 'Hospital Staff' },
]

const AUDIT_RECORD_TYPE_LABELS: Record<string, string> = {
  animal_profile: 'Profile',
  consultations: 'Consultations',
  prescriptions: 'Prescriptions',
  vaccinations: 'Vaccinations',
}

const AUDIT_ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  veterinarian: { bg: '#dbeafe', color: '#1d4ed8' },
  admin: { bg: '#fee2e2', color: '#dc2626' },
  farmer: { bg: '#dcfce7', color: '#15803d' },
  pet_owner: { bg: '#f3e8ff', color: '#7e22ce' },
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────
interface RoleBadgeProps { role: string }
const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const label = MEMBER_ROLES.find(r => r.value === role)?.label ?? role
  return <span className={`hn-role-badge hn-role-badge-${role}`}>{label}</span>
}

// ─── NetworkTypeLabel ─────────────────────────────────────────────────────────
interface NetworkTypeLabelProps { type?: string }
const NetworkTypeLabel: React.FC<NetworkTypeLabelProps> = ({ type }) => {
  const label = NETWORK_TYPES.find(t => t.value === type)?.label ?? type ?? '—'
  return <span>{label}</span>
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────
interface NetworkModalProps {
  editing: HospitalNetwork | null
  onClose: () => void
  onSaved: (network: HospitalNetwork) => void
  t: (key: string) => string
}

const EMPTY_FORM = {
  name: '', legalName: '', registrationNumber: '', taxId: '',
  networkType: 'private', country: '', headquartersCity: '', headquartersState: '',
  contactEmail: '', contactPhone: '', website: '',
  dpoName: '', dpoEmail: '', dataResidencyRegion: '',
  idPrefix: '',
}

const NetworkModal: React.FC<NetworkModalProps> = ({ editing, onClose, onSaved, t }) => {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? '',
        legalName: editing.legalName ?? '',
        registrationNumber: editing.registrationNumber ?? '',
        taxId: editing.taxId ?? '',
        networkType: editing.networkType ?? 'private',
        country: editing.country ?? '',
        headquartersCity: editing.headquartersCity ?? '',
        headquartersState: editing.headquartersState ?? '',
        contactEmail: editing.contactEmail ?? '',
        contactPhone: editing.contactPhone ?? '',
        website: editing.website ?? '',
        dpoName: (editing as any).dpoName ?? '',
        dpoEmail: (editing as any).dpoEmail ?? '',
        dataResidencyRegion: (editing as any).dataResidencyRegion ?? '',
        idPrefix: editing.idPrefix ?? '',
      })
    } else {
      setForm({ ...EMPTY_FORM })
    }
  }, [editing])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Network name is required'); return }
    setSaving(true); setError('')
    try {
      let result: any
      if (editing) {
        result = await apiService.updateHospitalNetwork(editing.id, form)
      } else {
        result = await apiService.createHospitalNetwork(form)
      }
      onSaved(result.data ?? result)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>{editing ? t('hospitalNetworks.modal.editTitle') : t('hospitalNetworks.modal.createTitle')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hn-modal-body">
          {error && <div className="module-alert error">{error}</div>}
          <form className="module-form" onSubmit={handleSubmit}>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Network Name <span className="hn-required">*</span></label>
                <input className="module-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PawCare Group" />
              </div>
              <div className="module-form-group">
                <label className="module-label">Legal Name</label>
                <input className="module-input" value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder="Registered legal name" />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.form.idPrefix')}</label>
                <input className="module-input" value={(form as any).idPrefix} onChange={e => set('idPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="e.g. APOLLO, NH1, TNGOV" maxLength={10} />
                <small style={{color: '#666', fontSize: '12px'}}>{t('hospitalNetworks.form.idPrefixHint')}</small>
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Registration Number</label>
                <input className="module-input" value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Tax ID</label>
                <input className="module-input" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Network Type</label>
                <select className="module-input" value={form.networkType} onChange={e => set('networkType', e.target.value)}>
                  {NETWORK_TYPES.map(nt => <option key={nt.value} value={nt.value}>{nt.label}</option>)}
                </select>
              </div>
              <div className="module-form-group">
                <label className="module-label">Country</label>
                <input className="module-input" value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. India" />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Headquarters City</label>
                <input className="module-input" value={form.headquartersCity} onChange={e => set('headquartersCity', e.target.value)} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Headquarters State</label>
                <input className="module-input" value={form.headquartersState} onChange={e => set('headquartersState', e.target.value)} />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Contact Email</label>
                <input className="module-input" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Contact Phone</label>
                <input className="module-input" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
              </div>
            </div>
            <div className="module-form-group">
              <label className="module-label">Website</label>
              <input className="module-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
            </div>
            <div className="hn-section-title">Data Protection</div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">DPO Name</label>
                <input className="module-input" value={form.dpoName} onChange={e => set('dpoName', e.target.value)} placeholder="Data Protection Officer" />
              </div>
              <div className="module-form-group">
                <label className="module-label">DPO Email</label>
                <input className="module-input" type="email" value={form.dpoEmail} onChange={e => set('dpoEmail', e.target.value)} />
              </div>
            </div>
            <div className="module-form-group">
              <label className="module-label">Data Residency Region</label>
              <input className="module-input" value={form.dataResidencyRegion} onChange={e => set('dataResidencyRegion', e.target.value)} placeholder="e.g. Asia-South1" />
            </div>
            <div className="hn-modal-actions">
              <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className="module-btn primary" disabled={saving}>
                {saving ? t('common.saving') : (editing ? t('common.update') : t('common.create'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Create Branch Hospital Modal ─────────────────────────────────────────────
interface BranchHospitalFormData {
  name: string;
  hospitalType: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  description: string;
}

const CreateBranchHospitalModal: React.FC<{
  networkId: string;
  onSuccess: () => void;
  onClose: () => void;
  t: any;
}> = ({ networkId, onSuccess, onClose, t }) => {
  const [form, setForm] = useState<BranchHospitalFormData>({
    name: '', hospitalType: 'multi_specialty', address: '', city: '',
    state: '', country: 'IN', postalCode: '', phone: '', email: '', description: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Hospital name is required'); return }
    setSaving(true)
    setError('')
    try {
      await apiService.createBranchHospital(networkId, form)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create branch hospital')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="hn-modal-header">
          <h3>🏥 Create Branch Hospital</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
            {error && <div className="module-alert error" style={{ margin: '12px 0' }}>{error}</div>}
            <div className="module-form">
              <div className="module-form-group">
                <label className="module-label">Hospital Name <span style={{ color: 'red' }}>*</span></label>
                <input className="module-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chennai Branch - North" required />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Type</label>
                  <select className="module-input" value={form.hospitalType} onChange={e => setForm(f => ({ ...f, hospitalType: e.target.value }))}>
                    <option value="multi_specialty">Multi Specialty</option>
                    <option value="specialty">Specialty</option>
                    <option value="clinic">Clinic</option>
                    <option value="emergency">Emergency</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">Phone</label>
                  <input className="module-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 ..." />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Email</label>
                <input className="module-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="branch@hospital.com" />
              </div>
              <div className="module-form-group">
                <label className="module-label">Address</label>
                <input className="module-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">City</label>
                  <input className="module-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">State</label>
                  <input className="module-input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State" />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Country</label>
                  <input className="module-input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="IN" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">Postal Code</label>
                  <input className="module-input" value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="600001" />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Description <span style={{ color: '#888', fontSize: '0.85em' }}>(optional)</span></label>
                <textarea className="module-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this branch..." />
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', borderRadius: '0 0 12px 12px' }}>
            <p style={{ fontSize: '0.8em', color: '#888', margin: 0, flex: 1 }}>* Name required</p>
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || !form.name.trim()}>
              {saving ? '⏳ Creating...' : '🏥 Create Branch Hospital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Branch Hospital Modal ───────────────────────────────────────────────
const EditBranchHospitalModal: React.FC<{
  networkId: string;
  hospital: NetworkHospital;
  onSuccess: () => void;
  onClose: () => void;
  t: any;
}> = ({ networkId, hospital, onSuccess, onClose, t }) => {
  const [form, setForm] = useState<BranchHospitalFormData>({
    name: hospital.name || '',
    hospitalType: hospital.hospitalType || 'multi_specialty',
    address: '',
    city: hospital.city || '',
    state: hospital.state || '',
    country: 'IN',
    postalCode: '',
    phone: hospital.contactPhone || '',
    email: hospital.contactEmail || '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Hospital name is required'); return }
    setSaving(true); setError('')
    try {
      await apiService.updateBranchHospital(networkId, hospital.id, form)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update branch hospital')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="hn-modal-header">
          <h3>✏️ Edit Branch Hospital</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
            {error && <div className="module-alert error" style={{ margin: '12px 0' }}>{error}</div>}
            <div className="module-form">
              <div className="module-form-group">
                <label className="module-label">Hospital Name <span style={{ color: 'red' }}>*</span></label>
                <input className="module-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Type</label>
                  <select className="module-input" value={form.hospitalType} onChange={e => setForm(f => ({ ...f, hospitalType: e.target.value }))}>
                    <option value="multi_specialty">Multi Specialty</option>
                    <option value="specialty">Specialty</option>
                    <option value="clinic">Clinic</option>
                    <option value="emergency">Emergency</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">Phone</label>
                  <input className="module-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 ..." />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Email</label>
                <input className="module-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Address</label>
                <input className="module-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">City</label>
                  <input className="module-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">State</label>
                  <input className="module-input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Description <span style={{ color: '#888', fontSize: '0.85em' }}>(optional)</span></label>
                <textarea className="module-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 12, justifyContent: 'flex-end', borderRadius: '0 0 12px 12px' }}>
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || !form.name.trim()}>
              {saving ? '⏳ Saving...' : '✏️ Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
interface AddMemberModalProps {
  networkId: string
  networkHospitals: NetworkHospital[]
  onClose: () => void
  onAdded: () => void
  onInviteInstead: () => void
  t: (key: string) => string
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ networkId, networkHospitals, onClose, onAdded, onInviteInstead, t }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; role: string }>>([])
  const [selectedUser, setSelectedUser] = useState<{ id: string; firstName: string; lastName: string; email: string; role: string } | null>(null)
  const [searching, setSearching] = useState(false)
  const [networkRole, setNetworkRole] = useState('hospital_staff')
  const [hospitalId, setHospitalId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await apiService.searchNetworkUsers(searchQuery)
        setSearchResults(res.data?.data || [])
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleAdd = async () => {
    if (!selectedUser) { setError('Please search and select a user first'); return }
    setSaving(true); setError('')
    try {
      await apiService.addNetworkMember(networkId, {
        userId: selectedUser.id,
        networkRole,
        hospitalId: hospitalId || undefined,
        notes: notes || undefined,
      })
      onAdded()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to add member')
    } finally { setSaving(false) }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>➕ {t('hospitalNetworks.detail.addMember')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hn-modal-body">
          {error && <div className="module-alert error">{error}</div>}

          <div className="module-form-group">
            <label className="module-label">Search User <span style={{ color: 'red' }}>*</span></label>
            <input
              className="module-input"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedUser(null) }}
              placeholder="Type name or email to search..."
              autoFocus
            />
            {searching && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>🔍 Searching...</p>}

            {searchResults.length > 0 && !selectedUser && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {searchResults.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setSearchQuery(`${u.firstName} ${u.lastName} (${u.email})`) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{u.firstName} {u.lastName}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{u.email} • {u.role}</span>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedUser && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 6 }}>
                <p style={{ fontSize: 13, color: '#92400e', margin: '0 0 6px' }}>No registered users found for "{searchQuery}".</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>This person may not have a VetCare account yet.</p>
                <button
                  type="button"
                  onClick={onInviteInstead}
                  style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                >
                  ✉️ Invite them by email instead →
                </button>
              </div>
            )}

            {selectedUser && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>✅ {selectedUser.firstName} {selectedUser.lastName}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{selectedUser.email}</span>
                </div>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }} onClick={() => { setSelectedUser(null); setSearchQuery('') }}>✕</button>
              </div>
            )}
          </div>

          <div className="module-form-group">
            <label className="module-label">Network Role</label>
            <select className="module-input" value={networkRole} onChange={e => setNetworkRole(e.target.value)}>
              {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {networkHospitals.length > 0 && (
            <div className="module-form-group">
              <label className="module-label">Assign to Branch Hospital <span style={{ color: '#888', fontSize: '0.85em' }}>(optional)</span></label>
              <select className="module-input" value={hospitalId} onChange={e => setHospitalId(e.target.value)}>
                <option value="">— Not assigned to specific hospital —</option>
                {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          )}

          <div className="module-form-group">
            <label className="module-label">Notes <span style={{ color: '#888', fontSize: '0.85em' }}>(optional)</span></label>
            <input className="module-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Head of Cardiology" />
          </div>

          {!selectedUser && (
            <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>⚠️ Required: Search and select a user above to enable adding</p>
          )}
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>* Required field. User must already have a VetCare account.</p>
        </div>

        <div className="hn-modal-actions" style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', background: '#fff', borderRadius: '0 0 12px 12px' }}>
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="module-btn primary" disabled={saving || !selectedUser} onClick={handleAdd}>
            {saving ? '⏳ Adding...' : `➕ ${t('hospitalNetworks.detail.addMember')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const HospitalNetworks: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()

  const [activeTab, setActiveTab] = useState<'networks' | 'detail' | 'audit' | 'patients' | 'referrals' | 'leave' | 'roleMatrix' | 'analytics'>('networks')
  const [selectedNetwork, setSelectedNetwork] = useState<HospitalNetwork | null>(null)

  const [networks, setNetworks] = useState<HospitalNetwork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all')
  const [approveState, setApproveState] = useState<Record<string, 'idle' | 'confirming'>>({})

  // P6-APPROVAL state
  const [approvalHistory, setApprovalHistory] = useState<any[]>([])
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState<null | 'info_requested' | 'approved' | 'rejected' | 'suspended' | 'reactivated'>(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [approvalSaving, setApprovalSaving] = useState(false)

  // P6-BRANDING state
  const [brandingForm, setBrandingForm] = useState({
    logoUrl: '', contactEmail: '', contactPhone: '', websiteUrl: '',
    operatingHours: {} as Record<string, {open: string; close: string; closed: boolean}>,
    specializations: [] as string[], emergencyServices: false
  })
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingSaved, setBrandingSaved] = useState(false)
  const [showBrandingPanel, setShowBrandingPanel] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingNetwork, setEditingNetwork] = useState<HospitalNetwork | null>(null)

  const [dashboard, setDashboard] = useState<NetworkDashboard | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [networkHospitals, setNetworkHospitals] = useState<NetworkHospital[]>([])
  const [networkMembers, setNetworkMembers] = useState<NetworkMember[]>([])
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [editingBranch, setEditingBranch] = useState<NetworkHospital | null>(null)
  const [deletingBranch, setDeletingBranch] = useState<NetworkHospital | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [editingMember, setEditingMember] = useState<NetworkMember | null>(null)
  const [editMemberForm, setEditMemberForm] = useState({ networkRole: '', hospitalId: '' })
  const [editMemberLoading, setEditMemberLoading] = useState(false)
  const [showInviteStaff, setShowInviteStaff] = useState(false)
  const [inviteStaffForm, setInviteStaffForm] = useState({ email: '', name: '', position: 'receptionist', hospitalId: '' })
  const [inviteStaffLoading, setInviteStaffLoading] = useState(false)
  const [inviteStaffSuccess, setInviteStaffSuccess] = useState('')
  const [inviteStaffError, setInviteStaffError] = useState('')
  const [inviteLink, setInviteLink] = useState('')

  // ─── Audit State ──────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditRecordTypeFilter, setAuditRecordTypeFilter] = useState('')
  const [auditGrantedFilter, setAuditGrantedFilter] = useState<'all' | 'granted' | 'denied'>('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditStats, setAuditStats] = useState<AuditStats>({ total: 0, granted: 0, denied: 0, last7days: 0 })

  // ─── Patients Tab State ────────────────────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([])
  const [patientSearchLoading, setPatientSearchLoading] = useState(false)
  const [allEnrollments, setAllEnrollments] = useState<EnrollmentRecord[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [enrollmentFilter, setEnrollmentFilter] = useState<'all' | 'pending_consent' | 'active' | 'declined'>('all')
  const [requestingEnrollment, setRequestingEnrollment] = useState<string | null>(null)
  const [enrollmentSuccessIds, setEnrollmentSuccessIds] = useState<Set<string>>(new Set())
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState<WalkInInviteForm>({ patientName: '', patientEmail: '', patientPhone: '', animalName: '', animalSpecies: '', message: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [showWalkInRegModal, setShowWalkInRegModal] = useState(false)
  const [walkInForm, setWalkInForm] = useState({ patientName: '', patientPhone: '', patientEmail: '', animalName: '', animalSpecies: '', animalBreed: '', reasonForVisit: '', hospitalId: '', consentCollected: false })
  const [walkInLoading, setWalkInLoading] = useState(false)
  const [walkInSuccess, setWalkInSuccess] = useState('')

  // ─── Referrals Tab State ───────────────────────────────────────────────────
  const [referrals, setReferrals] = useState<any[]>([])
  const [referralsLoading, setReferralsLoading] = useState(false)
  const [referralDirection, setReferralDirection] = useState<'incoming' | 'outgoing' | 'all'>('incoming')
  const [showCreateReferralModal, setShowCreateReferralModal] = useState(false)
  const [referralForm, setReferralForm] = useState({
    networkId: '', fromHospitalId: '', toHospitalId: '', toVetId: '',
    animalId: '', reason: '', priority: 'normal', clinicalNotes: ''
  })
  const [referralNetworkHospitals, setReferralNetworkHospitals] = useState<any[]>([])
  const [referralSubmitting, setReferralSubmitting] = useState(false)
  const [referralSuccess, setReferralSuccess] = useState('')
  const [referralError, setReferralError] = useState('')
  const [responseModal, setResponseModal] = useState<{ referral: any; action: 'accepted' | 'rejected' } | null>(null)
  const [responseNotes, setResponseNotes] = useState('')
  const [respondingSubmitting, setRespondingSubmitting] = useState(false)

  // ─── Analytics State ───────────────────────────────────────────────────────
  const [analyticsData, setAnalyticsData] = useState<Record<string, any> | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')

  // ─── Compliance Export State ───────────────────────────────────────────────
  const [showComplianceModal, setShowComplianceModal] = useState(false)
  const [complianceFrom, setComplianceFrom] = useState('')
  const [complianceTo, setComplianceTo] = useState('')
  const [complianceGenerating, setComplianceGenerating] = useState(false)
  const [complianceError, setComplianceError] = useState('')

  // ─── Financial / Leave / Transfers State ────────────────────────────────────
  const [financialData, setFinancialData] = useState<any>(null)
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [transfers, setTransfers] = useState<any[]>([])

  const loadNetworks = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await apiService.listHospitalNetworks()
      setNetworks(result.data ?? result ?? [])
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load networks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNetworks() }, [loadNetworks])

  useEffect(() => {
    if (!successMsg) return
    const timer = setTimeout(() => setSuccessMsg(''), 3000)
    return () => clearTimeout(timer)
  }, [successMsg])

  const loadDetail = useCallback(async (network: HospitalNetwork) => {
    setDetailLoading(true)
    try {
      const [dashRes, hospRes, memRes] = await Promise.all([
        apiService.getNetworkDashboard(network.id).catch(() => ({ data: null })),
        apiService.listNetworkHospitals(network.id).catch(() => ({ data: [] })),
        apiService.listNetworkMembers(network.id).catch(() => ({ data: [] })),
      ])
      setDashboard(dashRes.data ?? dashRes ?? null)
      const rawHospitals = hospRes?.data?.hospitals ?? hospRes?.hospitals ?? hospRes?.data ?? hospRes ?? []
      setNetworkHospitals(Array.isArray(rawHospitals) ? rawHospitals : [])
      setNetworkMembers(memRes.data ?? memRes ?? [])
      // Load financial summary
      apiService.getNetworkFinancialSummary(network.id).then((res: any) => {
        setFinancialData(res.data?.data || res.data || null)
      }).catch(() => setFinancialData(null))
      // P6-APPROVAL: load approval history (admin + corporate_admin)
      loadApprovalHistory(network.id)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadApprovalHistory = useCallback(async (networkId: string) => {
    setApprovalLoading(true)
    try {
      const res = await apiService.getNetworkApprovalHistory(networkId)
      setApprovalHistory(res.data?.data ?? res.data ?? [])
    } catch {
      setApprovalHistory([])
    } finally {
      setApprovalLoading(false)
    }
  }, [])

  const handleApprovalAction = async () => {
    if (!selectedNetwork || !showApprovalModal) return
    setApprovalSaving(true)
    try {
      await apiService.addNetworkApprovalEvent(selectedNetwork.id, showApprovalModal, approvalNotes || undefined)
      setShowApprovalModal(null)
      setApprovalNotes('')
      setSuccessMsg(`Action recorded: ${showApprovalModal}`)
      await loadNetworks()
      await loadApprovalHistory(selectedNetwork.id)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to record action')
    } finally {
      setApprovalSaving(false)
    }
  }

  const handleBrandingSubmit = async () => {
    if (!selectedNetwork) return
    setBrandingSaving(true)
    setBrandingSaved(false)
    try {
      await apiService.updateNetworkBranding(selectedNetwork.id, {
        logoUrl: brandingForm.logoUrl || undefined,
        contactEmail: brandingForm.contactEmail || undefined,
        contactPhone: brandingForm.contactPhone || undefined,
        websiteUrl: brandingForm.websiteUrl || undefined,
        operatingHours: Object.keys(brandingForm.operatingHours).length > 0 ? brandingForm.operatingHours : undefined,
        specializations: brandingForm.specializations.length > 0 ? brandingForm.specializations : undefined,
        emergencyServices: brandingForm.emergencyServices,
      })
      setBrandingSaved(true)
      setTimeout(() => setBrandingSaved(false), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to save settings')
    } finally {
      setBrandingSaving(false)
    }
  }

  const initBrandingForm = useCallback((network: HospitalNetwork) => {
    const n = network as any
    setBrandingForm({
      logoUrl: n.logoUrl ?? '',
      contactEmail: n.contactEmail ?? '',
      contactPhone: n.contactPhone ?? '',
      websiteUrl: n.websiteUrl ?? n.website ?? '',
      operatingHours: n.operatingHours ?? {},
      specializations: n.specializations ?? [],
      emergencyServices: n.emergencyServices ?? false,
    })
  }, [])

  const loadAuditLogs = useCallback(async (
    networkId: string,
    page: number,
    recordType: string,
    grantedFilter: 'all' | 'granted' | 'denied',
  ) => {
    setAuditLoading(true)
    try {
      const filters: { page: number; limit: number; recordType?: string; accessGranted?: boolean } = { page, limit: 50 }
      if (recordType) filters.recordType = recordType
      if (grantedFilter === 'granted') filters.accessGranted = true
      else if (grantedFilter === 'denied') filters.accessGranted = false
      const res = await apiService.getNetworkAuditLogs(networkId, filters)
      const rows: AuditEntry[] = res?.data?.rows ?? (res as any)?.rows ?? []
      setAuditLogs(rows)
      setAuditTotal(res?.data?.total ?? (res as any)?.total ?? rows.length)
    } catch {
      setAuditLogs([])
    } finally {
      setAuditLoading(false)
    }
  }, [])

  const loadAuditStats = useCallback(async (networkId: string) => {
    try {
      const res = await apiService.getNetworkAuditLogs(networkId, { page: 1, limit: 500 })
      const rows: AuditEntry[] = res?.data?.rows ?? (res as any)?.rows ?? []
      const total = res?.data?.total ?? (res as any)?.total ?? rows.length
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      setAuditStats({
        total,
        granted: rows.filter(r => r.accessGranted).length,
        denied: rows.filter(r => !r.accessGranted).length,
        last7days: rows.filter(r => new Date(r.accessedAt).getTime() > sevenDaysAgo).length,
      })
    } catch { /* silent */ }
  }, [])

  // Load stats once when switching to audit tab or selecting a new network
  useEffect(() => {
    if (activeTab !== 'audit' || !selectedNetwork) return
    loadAuditStats(selectedNetwork.id)
    setAuditPage(1)
    setAuditSearch('')
  }, [activeTab, selectedNetwork?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload paginated table whenever tab/network/page/filter changes
  useEffect(() => {
    if (activeTab !== 'audit' || !selectedNetwork) return
    loadAuditLogs(selectedNetwork.id, auditPage, auditRecordTypeFilter, auditGrantedFilter)
  }, [activeTab, selectedNetwork?.id, auditPage, auditRecordTypeFilter, auditGrantedFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAllEnrollments = React.useCallback(async (networkId: string) => {
    setEnrollmentsLoading(true)
    try {
      const result = await apiService.getAllEnrollments(networkId)
      setAllEnrollments(result ?? [])
    } catch { setAllEnrollments([]) }
    finally { setEnrollmentsLoading(false) }
  }, [])

  // Debounced patient search
  React.useEffect(() => {
    if (patientSearch.length < 2 || !selectedNetwork) { setPatientResults([]); return }
    setPatientSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const result = await apiService.searchNetworkPatients(selectedNetwork.id, patientSearch)
        setPatientResults(result ?? [])
      } catch { setPatientResults([]) }
      finally { setPatientSearchLoading(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [patientSearch, selectedNetwork])

  React.useEffect(() => {
    if (activeTab === 'patients' && selectedNetwork) {
      loadAllEnrollments(selectedNetwork.id)
    }
  }, [activeTab, selectedNetwork?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Referrals logic ──────────────────────────────────────────────────────
  const loadReferrals = useCallback(async (direction: 'incoming' | 'outgoing' | 'all' = referralDirection) => {
    if (!selectedNetwork) return
    setReferralsLoading(true)
    try {
      const result = await apiService.listNetworkReferrals({ networkId: selectedNetwork.id, direction })
      setReferrals(result.referrals || result.data || [])
    } catch (err: any) {
      setReferralError(err?.response?.data?.message || err?.message || t('networkReferrals.error'))
    } finally {
      setReferralsLoading(false)
    }
  }, [selectedNetwork, referralDirection, t]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'referrals') loadReferrals(referralDirection)
    if (activeTab === 'leave') loadLeaveRequests()
    if (activeTab === 'analytics' && selectedNetwork) loadAnalytics(selectedNetwork.id)
  }, [activeTab, selectedNetwork, referralDirection]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAnalytics = async (networkId: string) => {
    setAnalyticsLoading(true); setAnalyticsError('')
    try {
      const res = await apiService.getNetworkAnalytics(networkId)
      setAnalyticsData(res.data?.data ?? res.data ?? null)
    } catch (err: any) {
      setAnalyticsError(err?.response?.data?.message || err?.message || 'Failed to load analytics')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleExportCompliance = async () => {
    if (!selectedNetwork || !complianceFrom || !complianceTo) return
    setComplianceGenerating(true); setComplianceError('')
    try {
      const res = await apiService.getNetworkComplianceReport(selectedNetwork.id, complianceFrom, complianceTo)
      const report = res.data?.data ?? res.data
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compliance-report-${selectedNetwork.id}-${complianceFrom}-${complianceTo}.json`
      a.click()
      URL.revokeObjectURL(url)
      setShowComplianceModal(false)
    } catch (err: any) {
      setComplianceError(err?.response?.data?.message || err?.message || 'Failed to generate report')
    } finally {
      setComplianceGenerating(false)
    }
  }

  // ─── Leave Management logic ─────────────────────────────────────────────────
  const loadLeaveRequests = async () => {
    if (!selectedNetwork) return
    try {
      const res = await apiService.listLeaveRequests(selectedNetwork.id)
      setLeaveRequests(res.data?.data?.rows || res.data?.rows || res.data?.data || [])
    } catch (err: any) {
      console.error('Failed to load leave requests:', err?.message)
    }
  }

  // ─── Patient Transfers logic ────────────────────────────────────────────────
  const loadTransfers = async () => {
    if (!selectedNetwork) return
    try {
      const res = await apiService.listPatientTransfers(selectedNetwork.id)
      setTransfers(res.data?.data || res.data || [])
    } catch (err: any) {
      console.error('Failed to load transfers:', err?.message)
    }
  }

  useEffect(() => {
    if (activeTab === 'referrals' && selectedNetwork) loadTransfers()
  }, [activeTab, selectedNetwork]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showCreateReferralModal && selectedNetwork) {
      ;(apiService as any).client
        .get(`/hospital-networks/${selectedNetwork.id}/hospitals`)
        .then((res: any) => setReferralNetworkHospitals(res.data?.hospitals || res.data || []))
        .catch(() => {})
    }
  }, [showCreateReferralModal, selectedNetwork])

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!referralForm.reason || !referralForm.toHospitalId || !referralForm.animalId) {
      setReferralError(t('common.fillRequired', 'Please fill all required fields'))
      return
    }
    setReferralSubmitting(true)
    setReferralError('')
    try {
      await apiService.createNetworkReferral({
        ...referralForm,
        networkId: selectedNetwork?.id || referralForm.networkId,
        fromHospitalId: referralForm.fromHospitalId,
      })
      setReferralSuccess(t('networkReferrals.sent'))
      setShowCreateReferralModal(false)
      setReferralForm({ networkId: '', fromHospitalId: '', toHospitalId: '', toVetId: '', animalId: '', reason: '', priority: 'normal', clinicalNotes: '' })
      loadReferrals(referralDirection)
      setTimeout(() => setReferralSuccess(''), 4000)
    } catch (err: any) {
      setReferralError(err?.response?.data?.message || err?.message || t('networkReferrals.error'))
    } finally {
      setReferralSubmitting(false)
    }
  }

  const handleReferralResponse = async () => {
    if (!responseModal) return
    setRespondingSubmitting(true)
    try {
      await apiService.updateNetworkReferralStatus(responseModal.referral.id, responseModal.action, responseNotes)
      setReferralSuccess(responseModal.action === 'accepted' ? t('networkReferrals.accepted') : t('networkReferrals.rejected'))
      setResponseModal(null)
      setResponseNotes('')
      loadReferrals(referralDirection)
      setTimeout(() => setReferralSuccess(''), 4000)
    } catch (err: any) {
      setReferralError(err?.response?.data?.message || err?.message || t('networkReferrals.error'))
    } finally {
      setRespondingSubmitting(false)
    }
  }

  const handleRequestEnrollment = async (animalId: string) => {
    if (!selectedNetwork) return
    setRequestingEnrollment(animalId)
    try {
      await apiService.enrollAnimalInNetwork(selectedNetwork.id, { animalId })
      setEnrollmentSuccessIds(s => new Set(s).add(animalId))
      loadAllEnrollments(selectedNetwork.id)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to request enrollment')
    } finally { setRequestingEnrollment(null) }
  }

  const handleInviteWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNetwork) return
    setInviteLoading(true)
    try {
      await apiService.inviteWalkInPatient(selectedNetwork.id, {
        patientName: inviteForm.patientName,
        patientEmail: inviteForm.patientEmail,
        patientPhone: inviteForm.patientPhone || undefined,
        animalName: inviteForm.animalName || undefined,
        animalSpecies: inviteForm.animalSpecies || undefined,
        message: inviteForm.message || undefined,
      })
      setInviteSuccess(true)
      setTimeout(() => { setShowInviteModal(false); setInviteSuccess(false); setInviteForm({ patientName: '', patientEmail: '', patientPhone: '', animalName: '', animalSpecies: '', message: '' }) }, 2000)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to send invite')
    } finally { setInviteLoading(false) }
  }

  const handleRegisterWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNetwork) return
    setWalkInLoading(true); setError('')
    try {
      const result = await apiService.registerWalkInPatientDirect(selectedNetwork.id, {
        hospitalId: walkInForm.hospitalId,
        patientName: walkInForm.patientName,
        patientPhone: walkInForm.patientPhone || undefined,
        patientEmail: walkInForm.patientEmail || undefined,
        animalName: walkInForm.animalName,
        animalSpecies: walkInForm.animalSpecies,
        animalBreed: walkInForm.animalBreed || undefined,
        reasonForVisit: walkInForm.reasonForVisit || undefined,
        consentCollected: walkInForm.consentCollected,
        consentMethod: walkInForm.consentCollected ? 'verbal' : undefined,
      })
      setWalkInSuccess(result?.data?.networkPatientId || 'Registered')
      loadAllEnrollments(selectedNetwork.id)
      setTimeout(() => {
        setShowWalkInRegModal(false); setWalkInSuccess('')
        setWalkInForm({ patientName: '', patientPhone: '', patientEmail: '', animalName: '', animalSpecies: '', animalBreed: '', reasonForVisit: '', hospitalId: '', consentCollected: false })
      }, 2500)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Walk-in registration failed')
    } finally { setWalkInLoading(false) }
  }

  const handleView = (network: HospitalNetwork) => {
    setSelectedNetwork(network)
    setActiveTab('detail')
    loadDetail(network)
    initBrandingForm(network)
  }

  const handleApproveClick = (network: HospitalNetwork) => {
    setApproveState(s => ({ ...s, [network.id]: 'confirming' }))
  }

  const handleApproveConfirm = async (network: HospitalNetwork) => {
    try {
      await apiService.approveHospitalNetwork(network.id)
      setSuccessMsg(`"${network.name}" approved successfully.`)
      setApproveState(s => ({ ...s, [network.id]: 'idle' }))
      await loadNetworks()
      if (selectedNetwork?.id === network.id) {
        setSelectedNetwork(prev => prev ? { ...prev, isApproved: true } : prev)
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Approval failed')
      setApproveState(s => ({ ...s, [network.id]: 'idle' }))
    }
  }

  const handleNetworkSaved = async (network: HospitalNetwork) => {
    setShowCreateModal(false)
    setEditingNetwork(null)
    setSuccessMsg(`Network "${network.name}" saved.`)
    await loadNetworks()
  }

  const handleRemoveMember = async (member: NetworkMember) => {
    if (!selectedNetwork) return
    if (!window.confirm(`Remove ${member.userName ?? 'this member'} from the network?`)) return
    try {
      await apiService.removeNetworkMember(selectedNetwork.id, member.userId)
      setSuccessMsg('Member removed.')
      loadDetail(selectedNetwork)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to remove member')
    }
  }

  const handleEditMember = (member: NetworkMember) => {
    setEditingMember(member)
    setEditMemberForm({ networkRole: member.networkRole, hospitalId: member.hospitalId || '' })
  }

  const handleUpdateMember = async () => {
    if (!selectedNetwork || !editingMember) return
    setEditMemberLoading(true)
    try {
      await apiService.updateNetworkMember(selectedNetwork.id, editingMember.userId, {
        networkRole: editMemberForm.networkRole,
        hospitalId: editMemberForm.hospitalId || undefined,
      })
      setSuccessMsg('Member updated successfully.')
      setEditingMember(null)
      loadDetail(selectedNetwork)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update member')
    } finally {
      setEditMemberLoading(false)
    }
  }

  const handleDeactivateNetwork = async (networkId: string) => {
    if (!window.confirm(t('hospitalNetworks.deactivateConfirm'))) return
    try {
      await apiService.deactivateNetwork(networkId)
      setSuccessMsg(t('hospitalNetworks.deactivated'))
      loadNetworks()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to deactivate network')
    }
  }

  const filteredNetworks = networks.filter(n => {
    const matchesSearch = !searchTerm || n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.headquartersCity ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'approved' && n.isApproved) ||
      (statusFilter === 'pending' && !n.isApproved)
    return matchesSearch && matchesStatus
  })

  const userNetworkRole = networkMembers.find(m => m.userId === user?.id)?.networkRole

  const stats = {
    total: networks.length,
    approved: networks.filter(n => n.isApproved).length,
    pending: networks.filter(n => !n.isApproved).length,
    hospitals: networks.reduce((sum, n) => sum + (n.hospitalCount ?? 0), 0),
  }

  const filteredAuditLogs = auditLogs.filter(e => {
    if (!auditSearch) return true
    const q = auditSearch.toLowerCase()
    return (e.accessorName ?? '').toLowerCase().includes(q) ||
      (e.animalName ?? '').toLowerCase().includes(q)
  })

  const exportAuditCsv = async () => {
    if (selectedNetwork) {
      try {
        const res = await apiService.exportAuditLogs(selectedNetwork.id)
        const blob = new Blob([res.data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
        return
      } catch {
        // Fall back to client-side export
      }
    }
    const headers = ['Accessor', 'Email', 'Role', 'Animal', 'Animal ID', 'Record Type', 'Access Type', 'Result', 'Denial Reason', 'Date']
    const rows = filteredAuditLogs.map(e => [
      e.accessorName, e.accessorEmail, e.accessorRole,
      e.animalName, e.animalUniqueId, e.recordType, e.accessType,
      e.accessGranted ? 'Granted' : 'Denied',
      e.denialReason ?? '',
      e.accessedAt,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${selectedNetwork?.name ?? 'network'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="module-page hn-page">
      <div className="module-header">
        <div>
          <h1>{t('hospitalNetworks.title')}</h1>
          <p className="hn-subtitle">Manage enterprise hospital groups, members, and compliance.</p>
        </div>
        <div className="hn-header-actions">
          {activeTab === 'networks' && (
            <button className="module-btn primary" onClick={() => setShowCreateModal(true)}>
              + {t('hospitalNetworks.createNetwork')}
            </button>
          )}
          {activeTab === 'detail' && selectedNetwork && (
            <button className="module-btn" onClick={() => setActiveTab('networks')}>
              ← {t('hospitalNetworks.tabs.networks')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="module-alert error">
          {error}
          <button className="hn-alert-close" onClick={() => setError('')}>✕</button>
        </div>
      )}
      {successMsg && <div className="module-alert success">{successMsg}</div>}

      <div className="module-tabs">
        <button
          className={`module-tab${activeTab === 'networks' ? ' active' : ''}`}
          onClick={() => setActiveTab('networks')}
        >
          🏢 {t('hospitalNetworks.tabs.networks')}
        </button>
        <button
          className={`module-tab${activeTab === 'detail' ? ' active' : ''}`}
          onClick={() => setActiveTab('detail')}
          disabled={!selectedNetwork}
        >
          📋 {t('hospitalNetworks.tabs.detail')}{selectedNetwork ? `: ${selectedNetwork.name}` : ''}
        </button>
        <button
          className={`module-tab${activeTab === 'audit' ? ' active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          🔐 {t('hospitalNetworks.tabs.audit')}
        </button>
        <button
          className={`module-tab${activeTab === 'patients' ? ' active' : ''}`}
          onClick={() => setActiveTab('patients')}
          disabled={!selectedNetwork}
        >
          👥 {t('hospitalNetworks.patients.tab')}
          {selectedNetwork && allEnrollments.filter(e => e.enrollmentStatus === 'pending_consent').length > 0 && (
            <span style={{ marginLeft: 6, background: '#ffc107', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {allEnrollments.filter(e => e.enrollmentStatus === 'pending_consent').length}
            </span>
          )}
        </button>
        {selectedNetwork && (
          <button
            className={`module-tab${activeTab === 'referrals' ? ' active' : ''}`}
            onClick={() => setActiveTab('referrals')}
          >
            🔄 {t('networkReferrals.tab')}
          </button>
        )}
        {selectedNetwork && (
          <button
            className={`module-tab${activeTab === 'leave' ? ' active' : ''}`}
            onClick={() => setActiveTab('leave')}
          >
            🏖️ {t('hospitalNetworks.leave.tab')}
          </button>
        )}
        {selectedNetwork && (
        <button
          className={`module-tab${activeTab === 'roleMatrix' ? ' active' : ''}`}
          onClick={() => setActiveTab('roleMatrix')}
        >
          🔑 {t('networkRoleMatrix.tabLabel')}
        </button>
        )}
        {selectedNetwork && (
          <button
            className={`module-tab${activeTab === 'analytics' ? ' active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 {t('networkAnalytics.title')}
          </button>
        )}
      </div>

      {/* ════ TAB 1: NETWORKS ════ */}
      {activeTab === 'networks' && (
        <div className="hn-tab-content">
          <div className="hn-stats-row">
            <div className="hn-stat-card hn-stat-blue">
              <div className="hn-stat-value">{stats.total}</div>
              <div className="hn-stat-label">{t('hospitalNetworks.stats.total')}</div>
            </div>
            <div className="hn-stat-card hn-stat-green">
              <div className="hn-stat-value">{stats.approved}</div>
              <div className="hn-stat-label">{t('hospitalNetworks.stats.approved')}</div>
            </div>
            <div className="hn-stat-card hn-stat-orange">
              <div className="hn-stat-value">{stats.pending}</div>
              <div className="hn-stat-label">{t('hospitalNetworks.stats.pending')}</div>
            </div>
            <div className="hn-stat-card hn-stat-purple">
              <div className="hn-stat-value">{stats.hospitals}</div>
              <div className="hn-stat-label">{t('hospitalNetworks.stats.hospitals')}</div>
            </div>
          </div>

          <div className="hn-filter-bar">
            <div className="hn-filter-toggle">
              {(['all', 'approved', 'pending'] as const).map(f => (
                <button
                  key={f}
                  className={`module-btn small${statusFilter === f ? ' primary' : ''}`}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === 'all' ? t('common.all') : f === 'approved' ? t('hospitalNetworks.stats.approved') : t('hospitalNetworks.stats.pending')}
                </button>
              ))}
            </div>
            <input
              className="module-input hn-search-input"
              placeholder={`🔍 ${t('common.search')} networks…`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="hn-loading">⏳ {t('common.loading')}</div>
          ) : filteredNetworks.length === 0 ? (
            <div className="hn-empty-state">
              <div className="hn-empty-icon">🏢</div>
              <div className="hn-empty-title">No networks found</div>
              <div className="hn-empty-desc">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Create the first hospital network to get started.'}
              </div>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>{t('hospitalNetworks.table.name')}</th>
                    <th>{t('hospitalNetworks.table.type')}</th>
                    <th>{t('hospitalNetworks.table.headquarters')}</th>
                    <th>{t('hospitalNetworks.table.members')}</th>
                    <th>{t('hospitalNetworks.table.hospitals')}</th>
                    <th>{t('hospitalNetworks.table.status')}</th>
                    <th>{t('hospitalNetworks.table.created')}</th>
                    <th>{t('hospitalNetworks.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNetworks.map(network => (
                    <tr key={network.id}>
                      <td>
                        <div className="hn-network-name">{network.name}</div>
                        {network.legalName && <div className="hn-network-legal">{network.legalName}</div>}
                        {network.idPrefix && <span className="module-badge" style={{backgroundColor: '#e3f2fd', color: '#1565c0', fontSize: '11px'}}>{network.idPrefix}-*</span>}
                      </td>
                      <td><NetworkTypeLabel type={network.networkType} /></td>
                      <td>
                        {[network.headquartersCity, network.headquartersState, network.country]
                          .filter(Boolean).join(', ') || '—'}
                      </td>
                      <td>{network.memberCount ?? '—'}</td>
                      <td>{network.hospitalCount ?? '—'}</td>
                      <td>
                        {network.isApproved
                          ? <span className="badge badge-success">{t('hospitalNetworks.status.approved')}</span>
                          : <span className="badge badge-pending">{t('hospitalNetworks.status.pending')}</span>
                        }
                      </td>
                      <td>{formatDate(network.createdAt)}</td>
                      <td>
                        <div className="hn-actions">
                          <button className="module-btn small" onClick={() => handleView(network)}>
                            {t('hospitalNetworks.actions.view')}
                          </button>
                          <button className="module-btn small" onClick={() => setEditingNetwork(network)}>
                            {t('hospitalNetworks.actions.edit')}
                          </button>
                          {!network.isApproved && user?.role === 'admin' && (
                            approveState[network.id] === 'confirming' ? (
                              <div className="hn-confirm-row">
                                <span className="hn-confirm-label">Sure?</span>
                                <button type="button" className="module-btn small primary" onClick={() => handleApproveConfirm(network)}>Yes</button>
                                <button type="button" className="module-btn small" onClick={() => setApproveState(s => ({ ...s, [network.id]: 'idle' }))}>No</button>
                              </div>
                            ) : (
                              <button type="button" className="module-btn small hn-btn-approve" onClick={() => handleApproveClick(network)}>
                                {t('hospitalNetworks.actions.approve')}
                              </button>
                            )
                          )}
                          {/* Pending badge for non-admin users */}
                          {!network.isApproved && user?.role !== 'admin' && (
                            <span className="module-badge badge-pending" title="Awaiting platform admin approval">⏳ Pending Admin Approval</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════ TAB 2: NETWORK DETAIL ════ */}
      {activeTab === 'detail' && (
        <div className="hn-tab-content">
          {!selectedNetwork ? (
            <div className="hn-empty-state">
              <div className="hn-empty-icon">🔍</div>
              <div className="hn-empty-title">{t('hospitalNetworks.selectNetwork')}</div>
            </div>
          ) : detailLoading ? (
            <div className="hn-loading">⏳ {t('common.loading')}</div>
          ) : (
            <>
              <div className="hn-detail-header module-card">
                <div className="hn-detail-title-row">
                  <h2 className="hn-detail-name">{selectedNetwork.name}</h2>
                  <div className="hn-detail-badges">
                    {selectedNetwork.isApproved
                      ? <span className="badge badge-success">{t('hospitalNetworks.status.approved')}</span>
                      : <span className="badge badge-pending">{t('hospitalNetworks.status.pending')}</span>
                    }
                  </div>
                  <button className="module-btn small" onClick={() => setEditingNetwork(selectedNetwork)}>
                    ✏ {t('hospitalNetworks.actions.edit')}
                  </button>
                  {userNetworkRole === 'corporate_admin' && (
                    <button
                      className="module-btn small"
                      style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                      onClick={() => handleDeactivateNetwork(selectedNetwork.id)}
                    >
                      ⚠️ {t('hospitalNetworks.deactivate')}
                    </button>
                  )}
                </div>
                <div className="hn-detail-meta">
                  {selectedNetwork.networkType && (
                    <span className="hn-detail-meta-item">
                      🏷 <NetworkTypeLabel type={selectedNetwork.networkType} />
                    </span>
                  )}
                  {selectedNetwork.contactEmail && (
                    <span className="hn-detail-meta-item">✉ {selectedNetwork.contactEmail}</span>
                  )}
                  {selectedNetwork.contactPhone && (
                    <span className="hn-detail-meta-item">📞 {selectedNetwork.contactPhone}</span>
                  )}
                  {selectedNetwork.website && (
                    <a href={selectedNetwork.website} target="_blank" rel="noopener noreferrer" className="hn-detail-meta-item hn-website-link">
                      🌐 Website
                    </a>
                  )}
                  {selectedNetwork.country && (
                    <span className="hn-detail-meta-item">
                      📍 {[selectedNetwork.headquartersCity, selectedNetwork.headquartersState, selectedNetwork.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {dashboard && (
                <div className="hn-stats-row">
                  <div className="hn-stat-card hn-stat-blue">
                    <div className="hn-stat-value">{dashboard.totalMembers ?? 0}</div>
                    <div className="hn-stat-label">Members</div>
                  </div>
                  <div className="hn-stat-card hn-stat-green">
                    <div className="hn-stat-value">{dashboard.totalHospitals ?? 0}</div>
                    <div className="hn-stat-label">Hospitals</div>
                  </div>
                  <div className="hn-stat-card hn-stat-purple">
                    <div className="hn-stat-value">{dashboard.totalPatients ?? 0}</div>
                    <div className="hn-stat-label">Patients</div>
                  </div>
                  <div className="hn-stat-card hn-stat-teal">
                    <div className="hn-stat-value">{dashboard.activeConsents ?? 0}</div>
                    <div className="hn-stat-label">Active Consents</div>
                  </div>
                </div>
              )}

              {financialData && (
                <div className="module-card hn-financial-card">
                  <div className="card-header">
                    <h3>📊 {t('hospitalNetworks.financial.title')}</h3>
                  </div>
                  <div className="card-body">
                    <div className="module-stats">
                      <div className="stat-card">
                        <div className="stat-icon">📋</div>
                        <div className="stat-value">{financialData.totalConsultations || 0}</div>
                        <div className="stat-label">{t('hospitalNetworks.financial.consultations')}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon">📅</div>
                        <div className="stat-value">{financialData.totalBookings || 0}</div>
                        <div className="stat-label">{t('hospitalNetworks.financial.bookings')}</div>
                      </div>
                    </div>
                    {financialData.hospitalBreakdown?.length > 0 && (
                      <div className="data-table-container hn-financial-table">
                        <table className="module-table">
                          <thead>
                            <tr>
                              <th>{t('hospitalNetworks.financial.hospital')}</th>
                              <th>{t('hospitalNetworks.financial.bookings')}</th>
                              <th>{t('hospitalNetworks.financial.queueVisits')}</th>
                              <th>{t('hospitalNetworks.financial.inpatients')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialData.hospitalBreakdown.map((h: any) => (
                              <tr key={h.id}>
                                <td>{h.name}</td>
                                <td>{h.bookings}</td>
                                <td>{h.queueVisits}</td>
                                <td>{h.inpatients}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="hn-detail-panels">
                <div className="module-card">
                  <div className="hn-panel-header">
                    <h3>{t('hospitalNetworks.detail.hospitals')}</h3>
                    <button type="button" className="module-btn small primary" onClick={() => setShowCreateBranch(true)}>
                      + Add Branch Hospital
                    </button>
                  </div>
                  <div className="card-body">
                    {networkHospitals.length === 0 ? (
                      <div className="hn-panel-empty">🏥 {t('hospitalNetworks.detail.noHospitals')}</div>
                    ) : (
                      <div className="hn-hospital-list">
                        {networkHospitals.map(h => (
                          <div key={h.id} className="hn-hospital-item" style={{ alignItems: 'flex-start' }}>
                            <span className="hn-hospital-icon">🏥</span>
                            <div className="hn-hospital-info" style={{ flex: 1 }}>
                              <div className="hn-hospital-name">
                                {h.name}
                                {h.isNetworkBranch && <span style={{ marginLeft: 6, fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>Branch</span>}
                                {h.isVerified && <span style={{ marginLeft: 4, fontSize: 11, background: '#dcfce7', color: '#15803d', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>✓ Verified</span>}
                              </div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {h.city && <span>📍 {h.city}{h.state ? `, ${h.state}` : ''}</span>}
                                {h.hospitalType && <span>🏷️ {h.hospitalType.replace(/_/g, ' ')}</span>}
                                {h.staffCount != null && <span>👥 {h.staffCount} staff</span>}
                                {h.contactPhone && <span>📞 {h.contactPhone}</span>}
                              </div>
                            </div>
                            {h.isNetworkBranch && (
                              <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                                <button
                                  type="button"
                                  title="Edit branch hospital"
                                  onClick={() => setEditingBranch(h)}
                                  style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}
                                >✏️</button>
                                <button
                                  type="button"
                                  title="Remove branch hospital"
                                  onClick={() => setDeletingBranch(h)}
                                  style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}
                                >🗑️</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* P6-APPROVAL: Approval Workflow Panel */}
                {(['admin', 'corporate_admin', 'compliance_officer'] as string[]).includes(user?.role ?? '') && (
                  <div className="module-card">
                    <div className="hn-panel-header">
                      <h3>📋 {t('networkApproval.title')}</h3>
                      {user?.role === 'admin' && !selectedNetwork.isApproved && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="module-btn small" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d' }} onClick={() => setShowApprovalModal('info_requested')}>
                            ❓ {t('networkApproval.requestInfo')}
                          </button>
                          <button className="module-btn small primary" onClick={() => setShowApprovalModal('approved')}>
                            ✅ {t('networkApproval.approveNetwork')}
                          </button>
                          <button className="module-btn small" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={() => setShowApprovalModal('rejected')}>
                            ❌ {t('networkApproval.rejectNetwork')}
                          </button>
                        </div>
                      )}
                      {user?.role === 'admin' && selectedNetwork.isApproved && (
                        <button className="module-btn small" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }} onClick={() => setShowApprovalModal('suspended')}>
                          ⏸ Suspend Network
                        </button>
                      )}
                    </div>
                    <div className="card-body">
                      {approvalLoading ? (
                        <div className="hn-loading">⏳ {t('common.loading')}</div>
                      ) : approvalHistory.length === 0 ? (
                        <div className="hn-panel-empty">📋 {t('networkApproval.noHistory')}</div>
                      ) : (
                        <div className="hn-approval-timeline">
                          {approvalHistory.map((ev, idx) => {
                            const icons: Record<string, string> = {
                              submitted: '📨', under_review: '🔍', info_requested: '❓',
                              info_provided: '📝', approved: '✅', rejected: '❌',
                              suspended: '⏸', reactivated: '🔄',
                            }
                            return (
                              <div key={ev.id} className={`hn-approval-event ${idx === 0 ? 'hn-approval-event-latest' : ''}`}>
                                <div className="hn-approval-event-icon">{icons[ev.eventType] ?? '📋'}</div>
                                <div className="hn-approval-event-body">
                                  <div className="hn-approval-event-type">{t(`networkApproval.${ev.eventType}` as any) || ev.eventType}</div>
                                  <div className="hn-approval-event-meta">
                                    {t('networkApproval.actedBy', { name: ev.actorName })} · {formatDate(ev.createdAt)}
                                  </div>
                                  {ev.notes && <div className="hn-approval-event-notes">"{ev.notes}"</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* P6-BRANDING: Settings Panel */}
                {(userNetworkRole === 'corporate_admin' || user?.role === 'admin') && (
                  <div className="module-card">
                    <div className="hn-panel-header">
                      <h3>⚙️ {t('networkSettings.title')}</h3>
                      <button className="module-btn small" onClick={() => setShowBrandingPanel(p => !p)}>
                        {showBrandingPanel ? '▲ Collapse' : '▼ Expand'}
                      </button>
                    </div>
                    {showBrandingPanel && (
                      <div className="card-body">
                        {brandingSaved && <div className="module-alert success">✅ {t('networkSettings.settingsSaved')}</div>}
                        <div className="hn-branding-section-title">{t('networkSettings.branding')}</div>
                        <div className="module-form-group">
                          <label className="module-label">{t('networkSettings.logoUpload')}</label>
                          {brandingForm.logoUrl && (
                            <div style={{ marginBottom: 8 }}>
                              <img src={brandingForm.logoUrl} alt="Network Logo" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6, padding: 4 }} />
                            </div>
                          )}
                          <input type="file" accept="image/*" className="module-input"
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = ev => setBrandingForm(f => ({ ...f, logoUrl: (ev.target?.result as string) ?? '' }))
                              reader.readAsDataURL(file)
                            }}
                          />
                        </div>
                        <div className="hn-branding-section-title">{t('networkSettings.contactInfo')}</div>
                        <div className="module-form-row">
                          <div className="module-form-group">
                            <label className="module-label">{t('networkSettings.contactEmail')}</label>
                            <input className="module-input" type="email" value={brandingForm.contactEmail}
                              onChange={e => setBrandingForm(f => ({ ...f, contactEmail: e.target.value }))} />
                          </div>
                          <div className="module-form-group">
                            <label className="module-label">{t('networkSettings.contactPhone')}</label>
                            <input className="module-input" value={brandingForm.contactPhone}
                              onChange={e => setBrandingForm(f => ({ ...f, contactPhone: e.target.value }))} />
                          </div>
                        </div>
                        <div className="module-form-group">
                          <label className="module-label">{t('networkSettings.website')}</label>
                          <input className="module-input" placeholder="https://" value={brandingForm.websiteUrl}
                            onChange={e => setBrandingForm(f => ({ ...f, websiteUrl: e.target.value }))} />
                        </div>
                        <div className="hn-branding-section-title">{t('networkSettings.specializations')}</div>
                        <div className="hn-spec-chips">
                          {['Cardiology','Oncology','Orthopedics','Neurology','Dermatology','Ophthalmology','Dentistry','Surgery'].map(spec => (
                            <button key={spec} type="button"
                              className={`hn-spec-chip${brandingForm.specializations.includes(spec) ? ' active' : ''}`}
                              onClick={() => setBrandingForm(f => ({
                                ...f,
                                specializations: f.specializations.includes(spec)
                                  ? f.specializations.filter(s => s !== spec)
                                  : [...f.specializations, spec]
                              }))}>
                              {spec}
                            </button>
                          ))}
                        </div>
                        <div className="module-form-group" style={{ marginTop: 12 }}>
                          <label className="module-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={brandingForm.emergencyServices}
                              onChange={e => setBrandingForm(f => ({ ...f, emergencyServices: e.target.checked }))} />
                            {t('networkSettings.emergencyServices')}
                          </label>
                        </div>
                        <div className="hn-branding-section-title">{t('networkSettings.operatingHours')}</div>
                        <div className="hn-hours-grid">
                          {['mon','tue','wed','thu','fri','sat','sun'].map(day => {
                            const h = brandingForm.operatingHours[day] ?? { open: '09:00', close: '18:00', closed: false }
                            return (
                              <div key={day} className="hn-hours-row">
                                <span className="hn-hours-day">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                                <label className="hn-hours-closed-label">
                                  <input type="checkbox" checked={!!h.closed}
                                    onChange={e => setBrandingForm(f => ({ ...f, operatingHours: { ...f.operatingHours, [day]: { ...h, closed: e.target.checked } } }))} />
                                  {t('networkSettings.closed')}
                                </label>
                                {!h.closed && (
                                  <>
                                    <input type="time" className="hn-hours-input" value={h.open}
                                      onChange={e => setBrandingForm(f => ({ ...f, operatingHours: { ...f.operatingHours, [day]: { ...h, open: e.target.value } } }))} />
                                    <span>–</span>
                                    <input type="time" className="hn-hours-input" value={h.close}
                                      onChange={e => setBrandingForm(f => ({ ...f, operatingHours: { ...f.operatingHours, [day]: { ...h, close: e.target.value } } }))} />
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="hn-modal-actions" style={{ marginTop: 16 }}>
                          <button className="module-btn primary" disabled={brandingSaving} onClick={handleBrandingSubmit}>
                            {brandingSaving ? `⏳ ${t('common.saving')}` : t('networkSettings.saveSettings')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="module-card">
                  <div className="hn-panel-header">
                    <h3>{t('hospitalNetworks.detail.staff')}</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="module-btn small" onClick={() => { setShowInviteStaff(true); setInviteStaffError('') }}>
                        ✉️ {t('hospitalNetworks.detail.inviteStaff')}
                      </button>
                      <button className="module-btn small primary" onClick={() => setShowAddMember(true)}>
                        + {t('hospitalNetworks.detail.addMember')}
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    {networkMembers.length === 0 ? (
                      <div className="hn-panel-empty">👥 {t('hospitalNetworks.detail.noMembers')}</div>
                    ) : (
                      <div className="hn-member-list">
                        {networkMembers.map(m => (
                          <div key={m.id} className="hn-member-item">
                            <div className="hn-member-avatar">{(m.userName ?? 'U').charAt(0).toUpperCase()}</div>
                            <div className="hn-member-info">
                              <div className="hn-member-name">{m.userName ?? m.userEmail ?? 'Unknown'}</div>
                              {m.hospitalName && <div className="hn-member-hospital">{m.hospitalName}</div>}
                            </div>
                            <RoleBadge role={m.networkRole} />
                            <button
                              className="hn-edit-btn"
                              title="Edit member"
                              onClick={() => handleEditMember(m)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6366f1', padding: '2px 6px' }}
                            >✏️</button>
                            <button
                              className="hn-remove-btn"
                              title="Remove member"
                              onClick={() => handleRemoveMember(m)}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════ TAB 3: AUDIT ════ */}
      {activeTab === 'audit' && (
        <div className="hn-tab-content">
          {!selectedNetwork ? (
            <div className="hn-empty-state">
              <div className="hn-empty-icon">🔐</div>
              <div className="hn-empty-title">{t('hospitalNetworks.audit.selectNetwork')}</div>
              <button className="module-btn primary" onClick={() => setActiveTab('networks')}>
                {t('hospitalNetworks.audit.goToNetworks')}
              </button>
            </div>
          ) : (
            <>
              <div className="hn-audit-header">
                <h2 className="hn-audit-section-title">{t('hospitalNetworks.audit.title')}</h2>
                <p className="hn-subtitle">{t('hospitalNetworks.audit.subtitle')}</p>
              </div>

              {/* Stats */}
              <div className="hn-audit-stats">
                <div className="hn-stat-card hn-stat-blue">
                  <div className="hn-stat-value">{auditStats.total}</div>
                  <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.total')}</div>
                </div>
                <div className="hn-stat-card hn-stat-green">
                  <div className="hn-stat-value">{auditStats.granted}</div>
                  <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.granted')}</div>
                </div>
                <div className="hn-stat-card hn-stat-orange">
                  <div className="hn-stat-value">{auditStats.denied}</div>
                  <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.denied')}</div>
                </div>
                <div className="hn-stat-card hn-stat-teal">
                  <div className="hn-stat-value">{auditStats.last7days}</div>
                  <div className="hn-stat-label">{t('hospitalNetworks.audit.stats.last7days')}</div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="hn-audit-filter-bar">
                <select
                  className="module-input hn-audit-filter-select"
                  value={auditRecordTypeFilter}
                  onChange={e => { setAuditRecordTypeFilter(e.target.value); setAuditPage(1) }}
                >
                  <option value="">{t('hospitalNetworks.audit.filters.allTypes')}</option>
                  <option value="animal_profile">Animal Profile</option>
                  <option value="consultations">Consultations</option>
                  <option value="prescriptions">Prescriptions</option>
                  <option value="vaccinations">Vaccinations</option>
                </select>
                <div className="hn-filter-toggle">
                  {(['all', 'granted', 'denied'] as const).map(v => (
                    <button
                      key={v}
                      className={`module-btn${auditGrantedFilter === v ? ' primary' : ''} small`}
                      onClick={() => { setAuditGrantedFilter(v); setAuditPage(1) }}
                    >
                      {t(`hospitalNetworks.audit.filters.${v === 'all' ? 'allResults' : v}`)}
                    </button>
                  ))}
                </div>
                <input
                  className="module-input hn-search-input"
                  placeholder={t('hospitalNetworks.audit.filters.search')}
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
                <button className="module-btn" onClick={exportAuditCsv}>
                  {t('hospitalNetworks.audit.exportCsv')}
                </button>
                <button className="module-btn primary" onClick={() => setShowComplianceModal(true)}>
                  📋 {t('complianceExport.exportReport')}
                </button>
              </div>

              {/* Table */}
              {auditLoading ? (
                <div className="hn-loading">⏳ Loading audit logs…</div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="hn-empty-state">
                  <div className="hn-empty-icon">🔐</div>
                  <div className="hn-empty-title">{t('hospitalNetworks.audit.noLogs')}</div>
                  <div className="hn-empty-desc">{t('hospitalNetworks.audit.noLogsDesc')}</div>
                </div>
              ) : (
                <div className="module-card">
                  <div className="hn-audit-table-wrapper data-table-container">
                    <table className="module-table">
                      <thead>
                        <tr>
                          <th>{t('hospitalNetworks.audit.table.accessor')}</th>
                          <th>{t('hospitalNetworks.audit.table.role')}</th>
                          <th>{t('hospitalNetworks.audit.table.animal')}</th>
                          <th>{t('hospitalNetworks.audit.table.recordType')}</th>
                          <th>{t('hospitalNetworks.audit.table.accessType')}</th>
                          <th>{t('hospitalNetworks.audit.table.result')}</th>
                          <th>{t('hospitalNetworks.audit.table.dateTime')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAuditLogs.map(entry => {
                          const roleStyle = AUDIT_ROLE_STYLES[entry.accessorRole] ?? { bg: '#f3f4f6', color: '#6b7280' }
                          return (
                            <tr key={entry.id}>
                              <td>
                                <div className="hn-accessor-cell">
                                  <div className="hn-avatar-circle">
                                    {(entry.accessorName ?? '?')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="hn-accessor-name">{entry.accessorName}</div>
                                    <div className="hn-accessor-email">{entry.accessorEmail}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className="hn-role-badge"
                                  style={{ background: roleStyle.bg, color: roleStyle.color }}
                                >
                                  {entry.accessorRole}
                                </span>
                              </td>
                              <td>
                                <div className="hn-animal-name">{entry.animalName || '—'}</div>
                                {entry.animalUniqueId && (
                                  <div className="hn-animal-uid">{entry.animalUniqueId}</div>
                                )}
                              </td>
                              <td>
                                <span className="hn-record-type-badge">
                                  {AUDIT_RECORD_TYPE_LABELS[entry.recordType] ?? entry.recordType}
                                </span>
                              </td>
                              <td>
                                <code className="hn-access-type">{entry.accessType}</code>
                              </td>
                              <td>
                                {entry.accessGranted ? (
                                  <span className="hn-result-badge-granted">
                                    ✓ {t('hospitalNetworks.audit.filters.granted')}
                                  </span>
                                ) : (
                                  <span
                                    className="hn-result-badge-denied hn-denied-tooltip"
                                    title={entry.denialReason || ''}
                                  >
                                    ✗ {t('hospitalNetworks.audit.filters.denied')}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="hn-audit-date">{formatDate(entry.accessedAt)}</div>
                                <div className="hn-audit-time">
                                  {new Date(entry.accessedAt).toLocaleTimeString()}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {auditTotal > 50 && (
                    <div className="hn-audit-pagination">
                      <button
                        className="module-btn small"
                        onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                        disabled={auditPage === 1}
                      >
                        ← Previous
                      </button>
                      <span className="hn-page-info">
                        {t('hospitalNetworks.audit.pageOf', {
                          page: auditPage,
                          total: Math.ceil(auditTotal / 50),
                        })}
                      </span>
                      <button
                        className="module-btn small"
                        onClick={() => setAuditPage(p => p + 1)}
                        disabled={auditPage >= Math.ceil(auditTotal / 50)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}


      {/* ════ TAB 4: PATIENTS ════ */}
      {activeTab === 'patients' && (
        <div className="hn-tab-content">
          {!selectedNetwork ? (
            <div className="hn-empty-state">
              <div className="hn-empty-icon">👥</div>
              <div className="hn-empty-title">{t('hospitalNetworks.selectNetwork')}</div>
            </div>
          ) : (
            <>
              {/* Section A: Smart Patient Search */}
              <div className="module-card" style={{ marginBottom: 24 }}>
                <div className="hn-panel-header">
                  <h3>{t('hospitalNetworks.patients.searchTitle')}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="module-btn small primary" onClick={() => setShowWalkInRegModal(true)}>
                      + {t('hospitalNetworks.patients.registerWalkIn', 'Register Walk-In')}
                    </button>
                    <button className="module-btn small" onClick={() => setShowInviteModal(true)}>
                      ✉️ {t('hospitalNetworks.patients.inviteForOnlineAccess', 'Invite for Online Access')}
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <p className="module-form-helper" style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
                    {t('hospitalNetworks.patients.searchHelper')}
                  </p>
                  <div className="module-form-group">
                    <input
                      className="module-input"
                      placeholder={t('hospitalNetworks.patients.searchPlaceholder')}
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                    />
                  </div>
                  {patientSearch.length > 0 && patientSearch.length < 2 && (
                    <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0 0' }}>{t('hospitalNetworks.patients.searchMinChars')}</p>
                  )}
                  {patientSearchLoading && <div className="hn-loading">⏳ {t('common.loading')}</div>}
                  {!patientSearchLoading && patientSearch.length >= 2 && patientResults.length === 0 && (
                    <p style={{ color: '#999', fontSize: 14, marginTop: 8 }}>{t('hospitalNetworks.patients.noResults')}</p>
                  )}
                  {patientResults.map(patient => (
                    <div key={patient.userId} className="hn-member-item" style={{ marginBottom: 12, alignItems: 'flex-start', flexDirection: 'column', padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                        <div className="hn-member-avatar">{(patient.userName ?? 'P').charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="hn-member-name">{patient.userName}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>{patient.userEmail}</div>
                          {patient.userPhone && <div style={{ fontSize: 12, color: '#999' }}>{patient.userPhone}</div>}
                        </div>
                      </div>
                      <div style={{ marginTop: 10, width: '100%' }}>
                        {(patient.animals ?? []).length === 0 ? (
                          <p style={{ fontSize: 12, color: '#999' }}>No animals registered</p>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {(patient.animals ?? []).map(animal => (
                              <div key={animal.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f5', borderRadius: 8, padding: '6px 10px' }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{animal.name}</span>
                                <span style={{ fontSize: 11, color: '#666' }}>{animal.species}</span>
                                {animal.uniqueId && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#999' }}>{animal.uniqueId}</span>}
                                {((animal as any).enrollmentStatus === 'active' || (animal as any).isEnrolled) && (
                                  <span style={{
                                    background: '#dcfce7', color: '#166534', padding: '2px 8px',
                                    borderRadius: 12, fontSize: 11, fontWeight: 600, marginLeft: 8
                                  }}>
                                    ✓ Already Enrolled
                                  </span>
                                )}
                                {enrollmentSuccessIds.has(animal.id) ? (
                                  <span style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>✓ {t('hospitalNetworks.patients.enrollmentRequested')}</span>
                                ) : (
                                  <button
                                    className="module-btn small primary"
                                    style={{ fontSize: 11, padding: '3px 8px' }}
                                    disabled={requestingEnrollment === animal.id}
                                    onClick={() => handleRequestEnrollment(animal.id)}
                                  >
                                    {requestingEnrollment === animal.id ? '⏳' : t('hospitalNetworks.patients.requestEnrollment')}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section C: All Enrollments */}
              <div className="module-card">
                <div className="hn-panel-header">
                  <h3>{t('hospitalNetworks.patients.allEnrollments')}</h3>
                  <div className="hn-filter-toggle">
                    {(['all', 'pending_consent', 'active', 'declined'] as const).map(f => (
                      <button
                        key={f}
                        className={`module-btn small${enrollmentFilter === f ? ' primary' : ''}`}
                        onClick={() => setEnrollmentFilter(f)}
                      >
                        {f === 'all' ? t('hospitalNetworks.patients.filterAll')
                          : f === 'pending_consent' ? t('hospitalNetworks.patients.filterPending')
                          : f === 'active' ? t('hospitalNetworks.patients.filterActive')
                          : t('hospitalNetworks.patients.filterDeclined')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-body">
                  {enrollmentsLoading ? (
                    <div className="hn-loading">⏳ {t('common.loading')}</div>
                  ) : (
                    (() => {
                      const filtered = allEnrollments.filter(e => enrollmentFilter === 'all' || e.enrollmentStatus === enrollmentFilter)
                      if (filtered.length === 0) {
                        return <div className="hn-panel-empty">{t('hospitalNetworks.patients.noEnrollments')}</div>
                      }
                      return (
                        <div className="data-table-container">
                          <table className="module-table">
                            <thead>
                              <tr>
                                <th>{t('hospitalNetworks.patients.colAnimal')}</th>
                                <th>{t('hospitalNetworks.patients.colOwner')}</th>
                                <th>{t('hospitalNetworks.patients.colNetworkId')}</th>
                                <th>{t('hospitalNetworks.patients.colStatus')}</th>
                                <th>{t('hospitalNetworks.patients.colRequested')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map(e => (
                                <tr key={e.id}>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{e.animalName}</div>
                                    <div style={{ fontSize: 12, color: '#666' }}>{e.species}</div>
                                  </td>
                                  <td>
                                    <div>{e.ownerName}</div>
                                    <div style={{ fontSize: 12, color: '#999' }}>{e.ownerEmail}</div>
                                  </td>
                                  <td>
                                    {e.networkPatientId
                                      ? <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f0f7ff', padding: '2px 6px', borderRadius: 4 }}>{e.networkPatientId}</span>
                                      : '—'}
                                  </td>
                                  <td>
                                    <span className={`badge badge-${e.enrollmentStatus === 'active' ? 'success' : e.enrollmentStatus === 'pending_consent' ? 'pending' : 'error'}`}>
                                      {e.enrollmentStatus === 'pending_consent' ? t('hospitalNetworks.patients.statusPending')
                                        : e.enrollmentStatus === 'active' ? t('hospitalNetworks.patients.statusActive')
                                        : e.enrollmentStatus === 'declined' ? t('hospitalNetworks.patients.statusDeclined')
                                        : t('hospitalNetworks.patients.statusRevoked')}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 12, color: '#666' }}>{formatDate(e.enrollmentRequestedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {(showCreateModal || editingNetwork) && (
        <NetworkModal
          editing={editingNetwork}
          onClose={() => { setShowCreateModal(false); setEditingNetwork(null) }}
          onSaved={handleNetworkSaved}
          t={t}
        />
      )}
      {showCreateBranch && selectedNetwork && (
        <CreateBranchHospitalModal
          networkId={selectedNetwork.id}
          onSuccess={() => {
            setSuccessMsg('Branch hospital created successfully.')
            loadDetail(selectedNetwork)
          }}
          onClose={() => setShowCreateBranch(false)}
          t={t}
        />
      )}

      {editingBranch && selectedNetwork && (
        <EditBranchHospitalModal
          networkId={selectedNetwork.id}
          hospital={editingBranch}
          onSuccess={() => {
            setSuccessMsg('Branch hospital updated successfully.')
            setEditingBranch(null)
            loadDetail(selectedNetwork)
          }}
          onClose={() => setEditingBranch(null)}
          t={t}
        />
      )}

      {deletingBranch && selectedNetwork && (
        <div className="hn-modal-overlay" onClick={() => setDeletingBranch(null)}>
          <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="hn-modal-header">
              <h3>🗑️ Remove Branch Hospital</h3>
              <button type="button" className="hn-modal-close" onClick={() => setDeletingBranch(null)}>✕</button>
            </div>
            <div className="hn-modal-body">
              <p>Are you sure you want to remove <strong>{deletingBranch.name}</strong> from this network?</p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>The hospital record will be deactivated and removed from the network. This cannot be undone.</p>
            </div>
            <div className="hn-modal-actions">
              <button type="button" className="module-btn" onClick={() => setDeletingBranch(null)}>{t('common.cancel')}</button>
              <button
                type="button"
                className="module-btn primary"
                style={{ background: '#ef4444' }}
                onClick={async () => {
                  try {
                    await apiService.deleteBranchHospital(selectedNetwork.id, deletingBranch.id)
                    setSuccessMsg('Branch hospital removed.')
                    setDeletingBranch(null)
                    loadDetail(selectedNetwork)
                  } catch (err: any) {
                    setError(err?.response?.data?.message || 'Failed to remove hospital')
                    setDeletingBranch(null)
                  }
                }}
              >
                🗑️ Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Member Modal */}
      {editingMember && selectedNetwork && (
        <div className="hn-modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="hn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="hn-modal-header">
              <h2>✏️ {t('hospitalNetworks.detail.editMember', 'Edit Member')}</h2>
              <button type="button" className="hn-modal-close" onClick={() => setEditingMember(null)}>✕</button>
            </div>
            <div className="hn-modal-body">
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.memberName', 'Member')}</label>
                <input className="module-input" value={editingMember.userName || editingMember.userEmail || 'Unknown'} disabled />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.detail.memberEmail', 'Email')}</label>
                <input className="module-input" value={editingMember.userEmail || '—'} disabled />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.detail.networkRole', 'Role')} <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="module-input" value={editMemberForm.networkRole} onChange={e => setEditMemberForm(p => ({ ...p, networkRole: e.target.value }))}>
                  {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.detail.hospital', 'Assigned Hospital')}</label>
                <select className="module-input" value={editMemberForm.hospitalId} onChange={e => setEditMemberForm(p => ({ ...p, hospitalId: e.target.value }))}>
                  <option value="">{t('common.none', '— None (Corporate Level) —')}</option>
                  {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>
            <div className="hn-modal-footer">
              <button type="button" className="module-btn" onClick={() => setEditingMember(null)}>{t('common.cancel', 'Cancel')}</button>
              <button type="button" className="module-btn primary" disabled={editMemberLoading} onClick={handleUpdateMember}>
                {editMemberLoading ? '⏳ ' + t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && selectedNetwork && (
        <AddMemberModal
          networkId={selectedNetwork.id}
          networkHospitals={networkHospitals}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false)
            setSuccessMsg('Member added successfully.')
            loadDetail(selectedNetwork)
          }}
          onInviteInstead={() => {
            setShowAddMember(false)
            setShowInviteStaff(true)
            setInviteStaffError('')
          }}
          t={t}
        />
      )}

      {/* Invite Hospital Staff Modal */}
      {showInviteStaff && selectedNetwork && (
        <div className="hn-modal-overlay" onClick={() => { setShowInviteStaff(false); setInviteStaffSuccess(''); setInviteStaffError(''); setInviteLink('') }}>
          <div className="hn-modal" onClick={e => e.stopPropagation()}>
            <div className="hn-modal-header">
              <h2>✉️ {t('hospitalNetworks.detail.inviteStaff')}</h2>
              <button type="button" className="hn-modal-close" onClick={() => { setShowInviteStaff(false); setInviteStaffSuccess(''); setInviteStaffError(''); setInviteLink('') }}>✕</button>
            </div>
            {inviteStaffSuccess ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
                <p style={{ fontWeight: 600 }}>{inviteStaffSuccess}</p>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>{t('hospitalStaff.inviteSentHint')}</p>
                {inviteLink && (
                  <div style={{ marginTop: 16, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, textAlign: 'left' }}>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#0369a1' }}>📋 Share this invite link if email is not configured:</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input readOnly value={inviteLink} style={{ flex: 1, padding: '8px 12px', border: '1px solid #bae6fd', borderRadius: 6, fontSize: 12, background: '#fff' }} />
                      <button type="button" style={{ padding: '8px 12px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                        onClick={() => { navigator.clipboard.writeText(inviteLink) }}>Copy</button>
                    </div>
                  </div>
                )}
                <button className="module-btn primary" style={{ marginTop: '1.5rem' }} onClick={() => { setShowInviteStaff(false); setInviteStaffSuccess(''); setInviteLink('') }}>
                  {t('common.close')}
                </button>
              </div>
            ) : (
              <div className="hn-modal-body">
                {inviteStaffError && <div className="module-alert error" style={{ marginBottom: 12 }}>{inviteStaffError}</div>}
                <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  {t('hospitalNetworks.detail.inviteStaffDesc')}
                </p>
                <div className="module-form">
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalStaff.inviteeEmail')} *</label>
                      <input type="email" className="module-input" value={inviteStaffForm.email}
                        onChange={e => setInviteStaffForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalStaff.inviteeName')}</label>
                      <input type="text" className="module-input" value={inviteStaffForm.name}
                        onChange={e => setInviteStaffForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalStaff.staffPosition')} *</label>
                      <select className="module-input" value={inviteStaffForm.position}
                        onChange={e => setInviteStaffForm(f => ({ ...f, position: e.target.value }))}>
                        <option value="nurse">Nurse</option>
                        <option value="technician">Technician</option>
                        <option value="receptionist">Receptionist</option>
                        <option value="lab_tech">Lab Technician</option>
                        <option value="radiologist">Radiologist</option>
                        <option value="anesthesiologist">Anesthesiologist</option>
                        <option value="pharmacist">Pharmacist</option>
                        <option value="intern">Intern</option>
                        <option value="admin_staff">Admin Staff</option>
                      </select>
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.detail.hospital')}</label>
                      <select className="module-input" value={inviteStaffForm.hospitalId}
                        onChange={e => setInviteStaffForm(f => ({ ...f, hospitalId: e.target.value }))}>
                        <option value="">{t('common.select')}...</option>
                        {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="module-btn primary" disabled={inviteStaffLoading || !inviteStaffForm.email || !inviteStaffForm.position}
                    onClick={async () => {
                      setInviteStaffLoading(true)
                      try {
                        const res = await apiService.inviteHospitalStaff(selectedNetwork.id, {
                          inviteeEmail: inviteStaffForm.email,
                          inviteeName: inviteStaffForm.name,
                          staffPosition: inviteStaffForm.position,
                          hospitalId: inviteStaffForm.hospitalId || undefined,
                        })
                        if (res.success) {
                          setInviteStaffSuccess(t('hospitalNetworks.staff.inviteSent'))
                          const token = res.data?.inviteToken || res.data?.token
                          setInviteLink(res.data?.inviteUrl || (token ? `${window.location.origin}/accept-staff-invite?token=${token}` : ''))
                          setInviteStaffForm({ email: '', name: '', position: 'receptionist', hospitalId: '' })
                        } else {
                          setInviteStaffError(res.message || 'Failed to send invite')
                        }
                      } catch (e: any) {
                        setInviteStaffError(e.response?.data?.message || e.message)
                      } finally {
                        setInviteStaffLoading(false)
                      }
                    }}>
                    {inviteStaffLoading ? t('common.saving') : t('hospitalStaff.sendInvite')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Walk-in Patient Invite Modal */}
      {showInviteModal && selectedNetwork && (
        <div className="hn-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="hn-modal-header">
              <h2>{t('hospitalNetworks.patients.inviteTitle')}</h2>
              <button type="button" className="hn-modal-close" onClick={() => setShowInviteModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="hn-modal-body">
              {inviteSuccess ? (
                <div className="module-alert success">{t('hospitalNetworks.patients.inviteSuccess')}</div>
              ) : (
                <form onSubmit={handleInviteWalkIn}>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.patients.invitePatientName')} <span className="hn-required">*</span></label>
                    <input className="module-input" required value={inviteForm.patientName} onChange={e => setInviteForm(f => ({ ...f, patientName: e.target.value }))} />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.patients.inviteEmail')} <span className="hn-required">*</span></label>
                    <input className="module-input" type="email" required value={inviteForm.patientEmail} onChange={e => setInviteForm(f => ({ ...f, patientEmail: e.target.value }))} />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.patients.invitePhone')}</label>
                    <input className="module-input" value={inviteForm.patientPhone} onChange={e => setInviteForm(f => ({ ...f, patientPhone: e.target.value }))} />
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.inviteAnimalName')}</label>
                      <input className="module-input" value={inviteForm.animalName} onChange={e => setInviteForm(f => ({ ...f, animalName: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.inviteSpecies')}</label>
                      <select className="module-input" value={inviteForm.animalSpecies} onChange={e => setInviteForm(f => ({ ...f, animalSpecies: e.target.value }))}>
                        <option value="">—</option>
                        <option value="dog">Dog</option>
                        <option value="cat">Cat</option>
                        <option value="cattle">Cattle</option>
                        <option value="horse">Horse</option>
                        <option value="bird">Bird</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.patients.inviteMessage')}</label>
                    <textarea className="module-input" rows={3} value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="hn-modal-actions">
                    <button type="button" className="module-btn" onClick={() => setShowInviteModal(false)}>{t('common.cancel')}</button>
                    <button type="submit" className="module-btn primary" disabled={inviteLoading}>
                      {inviteLoading ? t('common.saving') : t('hospitalNetworks.patients.inviteSend')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Walk-In Direct Registration Modal */}
      {showWalkInRegModal && selectedNetwork && (
        <div className="hn-modal-overlay" onClick={() => setShowWalkInRegModal(false)}>
          <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="hn-modal-header">
              <h2>🏥 {t('hospitalNetworks.patients.registerWalkInTitle', 'Register Walk-In Patient')}</h2>
              <button type="button" className="hn-modal-close" onClick={() => setShowWalkInRegModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="hn-modal-body">
              {walkInSuccess ? (
                <div className="module-alert success">✅ {t('hospitalNetworks.patients.walkInSuccess', 'Patient registered!')} ID: {walkInSuccess}</div>
              ) : (
                <form onSubmit={handleRegisterWalkIn}>
                  <p className="module-form-helper" style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
                    {t('hospitalNetworks.patients.walkInHelperText', 'Register a walk-in patient for immediate treatment. No invite or account needed — patient can be given online access later.')}
                  </p>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.patients.invitePatientName', 'Patient Name')} <span className="hn-required">*</span></label>
                    <input className="module-input" required value={walkInForm.patientName} onChange={e => setWalkInForm(f => ({ ...f, patientName: e.target.value }))} />
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.invitePhone', 'Phone')}</label>
                      <input className="module-input" value={walkInForm.patientPhone} onChange={e => setWalkInForm(f => ({ ...f, patientPhone: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.inviteEmail', 'Email')} ({t('common.optional', 'optional')})</label>
                      <input className="module-input" type="email" value={walkInForm.patientEmail} onChange={e => setWalkInForm(f => ({ ...f, patientEmail: e.target.value }))} />
                    </div>
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.inviteAnimalName', 'Animal Name')} <span className="hn-required">*</span></label>
                      <input className="module-input" required value={walkInForm.animalName} onChange={e => setWalkInForm(f => ({ ...f, animalName: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.inviteSpecies', 'Species')} <span className="hn-required">*</span></label>
                      <select className="module-input" required value={walkInForm.animalSpecies} onChange={e => setWalkInForm(f => ({ ...f, animalSpecies: e.target.value }))}>
                        <option value="">{t('common.select', '— Select —')}</option>
                        <option value="dog">Dog</option><option value="cat">Cat</option>
                        <option value="cattle">Cattle</option><option value="horse">Horse</option>
                        <option value="bird">Bird</option><option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.patients.breed', 'Breed')} ({t('common.optional', 'optional')})</label>
                      <input className="module-input" value={walkInForm.animalBreed} onChange={e => setWalkInForm(f => ({ ...f, animalBreed: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.detail.hospital', 'Hospital')} <span className="hn-required">*</span></label>
                      <select className="module-input" required value={walkInForm.hospitalId} onChange={e => setWalkInForm(f => ({ ...f, hospitalId: e.target.value }))}>
                        <option value="">{t('common.select', '— Select —')}</option>
                        {networkHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.patients.reasonForVisit', 'Reason for Visit')}</label>
                    <textarea className="module-input" rows={2} value={walkInForm.reasonForVisit} onChange={e => setWalkInForm(f => ({ ...f, reasonForVisit: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="module-form-group" style={{ marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={walkInForm.consentCollected}
                        onChange={e => setWalkInForm(f => ({ ...f, consentCollected: e.target.checked }))}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {t('hospitalNetworks.patients.consentCollected', 'Patient consent has been collected in person')}
                        <span style={{ marginLeft: 6, fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
                          ({t('hospitalNetworks.patients.consentCollectedHint', 'Check if owner signed consent form or gave verbal consent')})
                        </span>
                      </span>
                    </label>
                    {!walkInForm.consentCollected && (
                      <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
                        ⚠️ {t('hospitalNetworks.patients.consentPendingWarning', 'Without consent, the animal will be registered as "Pending Consent" and the owner must accept before full access is granted.')}
                      </p>
                    )}
                  </div>
                  <div className="hn-modal-actions">
                    <button type="button" className="module-btn" onClick={() => setShowWalkInRegModal(false)}>{t('common.cancel', 'Cancel')}</button>
                    <button type="submit" className="module-btn primary" disabled={walkInLoading}>
                      {walkInLoading ? '⏳ ' + t('common.saving', 'Saving...') : t('hospitalNetworks.patients.registerNow', 'Register & Start Treatment')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ TAB 5: REFERRALS ════ */}
      {activeTab === 'referrals' && selectedNetwork && (
        <div className="hn-tab-content">
          {/* Header */}
          <div className="module-header" style={{ marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0 }}>{t('networkReferrals.title')}</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{selectedNetwork.name}</p>
            </div>
            <button className="module-btn primary" onClick={() => setShowCreateReferralModal(true)}>
              + {t('networkReferrals.create')}
            </button>
          </div>

          {/* Alerts */}
          {referralSuccess && <div className="module-alert success" style={{ marginBottom: 16 }}>{referralSuccess}</div>}
          {referralError && <div className="module-alert error" style={{ marginBottom: 16 }}>{referralError}</div>}

          {/* Direction sub-tabs */}
          <div className="module-tabs" style={{ marginBottom: 20 }}>
            {(['incoming', 'outgoing', 'all'] as const).map(dir => (
              <button
                key={dir}
                className={`module-tab${referralDirection === dir ? ' active' : ''}`}
                onClick={() => { setReferralDirection(dir); loadReferrals(dir) }}
              >
                {dir === 'incoming' ? `📥 ${t('networkReferrals.incoming')}` :
                 dir === 'outgoing' ? `📤 ${t('networkReferrals.outgoing')}` :
                 `📋 ${t('networkReferrals.all')}`}
              </button>
            ))}
          </div>

          {/* Table or empty state */}
          {referralsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ {t('common.loading')}</div>
          ) : referrals.length === 0 ? (
            <div className="module-card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48 }}>🔄</div>
              <p style={{ color: '#64748b', marginTop: 12 }}>
                {referralDirection === 'incoming' ? t('networkReferrals.noIncoming') :
                 referralDirection === 'outgoing' ? t('networkReferrals.noOutgoing') :
                 t('networkReferrals.noReferrals')}
              </p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>{t('networkReferrals.animal')}</th>
                    <th>{t('networkReferrals.fromHospital')}</th>
                    <th>{t('networkReferrals.toHospitalLabel')}</th>
                    <th>{t('networkReferrals.reason')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('networkReferrals.date')}</th>
                    <th>{t('networkReferrals.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(ref => (
                    <tr key={ref.id}>
                      <td>
                        <strong>{ref.animalName}</strong><br />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{ref.animalSpecies}</span>
                      </td>
                      <td>
                        {ref.fromHospitalName}<br />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{ref.fromVetName}</span>
                      </td>
                      <td>
                        {ref.toHospitalName}<br />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{ref.toVetName || '—'}</span>
                      </td>
                      <td style={{ maxWidth: 200 }}>{ref.reason}</td>
                      <td>
                        <span className={`module-badge ${
                          ref.status === 'accepted' ? 'badge-success' :
                          ref.status === 'rejected' ? 'badge-error' :
                          ref.status === 'completed' ? 'badge-success' : 'badge-pending'
                        }`}>
                          {String(t(`networkReferrals.status.${ref.status}` as any, ref.status))}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{new Date(ref.created_at || ref.createdAt).toLocaleDateString()}</td>
                      <td>
                        {ref.status === 'pending' && referralDirection !== 'outgoing' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="module-btn small"
                              style={{ background: '#dcfce7', color: '#166534' }}
                              onClick={() => setResponseModal({ referral: ref, action: 'accepted' })}
                            >
                              ✓ {t('networkReferrals.accept')}
                            </button>
                            <button
                              className="module-btn small"
                              style={{ background: '#fee2e2', color: '#dc2626' }}
                              onClick={() => setResponseModal({ referral: ref, action: 'rejected' })}
                            >
                              ✗ {t('networkReferrals.reject')}
                            </button>
                          </div>
                        )}
                        {ref.consultationId && (
                          <button
                            className="module-btn small"
                            style={{ marginTop: 4 }}
                            onClick={() => window.open(`/consultation/${ref.consultationId}`, '_blank')}
                          >
                            🔗 {t('networkReferrals.viewConsultation')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Patient Transfers Section ── */}
          <div className="module-card hn-transfers-card">
            <div className="card-header">
              <h3>🔄 {t('hospitalNetworks.transfers.title')}</h3>
            </div>
            <div className="card-body">
              {transfers.length === 0 ? (
                <p className="hn-panel-empty">{t('hospitalNetworks.transfers.noTransfers')}</p>
              ) : (
                <div className="data-table-container">
                  <table className="module-table">
                    <thead>
                      <tr>
                        <th>{t('hospitalNetworks.transfers.patient')}</th>
                        <th>{t('hospitalNetworks.transfers.from')}</th>
                        <th>{t('hospitalNetworks.transfers.to')}</th>
                        <th>{t('hospitalNetworks.transfers.reason')}</th>
                        <th>{t('hospitalNetworks.transfers.status')}</th>
                        <th>{t('hospitalNetworks.transfers.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((t_item: any) => (
                        <tr key={t_item.id}>
                          <td>{t_item.animalName} ({t_item.animalSpecies})</td>
                          <td>{t_item.fromHospitalName}</td>
                          <td>{t_item.toHospitalName}</td>
                          <td>{t_item.reason}</td>
                          <td>
                            <span className={`module-badge ${t_item.status === 'completed' ? 'badge-success' : 'badge-pending'}`}>
                              {t_item.status}
                            </span>
                          </td>
                          <td>
                            {t_item.status === 'accepted' && (
                              <button className="module-btn small" onClick={async () => {
                                try {
                                  await apiService.completePatientTransfer(selectedNetwork!.id, t_item.id)
                                  loadTransfers()
                                } catch (err: any) { console.error(err) }
                              }}>
                                ✅ {t('hospitalNetworks.transfers.complete')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Create Referral Modal */}
          {showCreateReferralModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowCreateReferralModal(false)}
            >
              <div
                style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>{t('networkReferrals.createTitle')}</h3>
                  <button type="button" onClick={() => setShowCreateReferralModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
                {referralError && <div className="module-alert error" style={{ marginBottom: 12 }}>{referralError}</div>}
                <form onSubmit={handleCreateReferral}>
                  <div className="module-form-group">
                    <label className="module-label">{t('networkReferrals.toHospital')}</label>
                    <select
                      className="module-input"
                      required
                      value={referralForm.toHospitalId}
                      onChange={e => setReferralForm(f => ({ ...f, toHospitalId: e.target.value }))}
                    >
                      <option value="">{t('networkReferrals.selectHospital')}</option>
                      {referralNetworkHospitals.map((h: any) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">
                      {t('networkReferrals.reason')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <textarea
                      className="module-input"
                      required
                      rows={3}
                      placeholder={t('networkReferrals.reasonPlaceholder')}
                      value={referralForm.reason}
                      onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('networkReferrals.priority')}</label>
                      <select
                        className="module-input"
                        value={referralForm.priority}
                        onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))}
                      >
                        {(['low', 'normal', 'high', 'emergency'] as const).map(p => (
                          <option key={p} value={p}>{t(`networkReferrals.priority_levels.${p}`, p)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('networkReferrals.clinicalNotes')}</label>
                    <textarea
                      className="module-input"
                      rows={4}
                      placeholder={t('networkReferrals.clinicalNotesPlaceholder')}
                      value={referralForm.clinicalNotes}
                      onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))}
                    />
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>* {t('common.requiredField', 'Required field')}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button type="button" className="module-btn" onClick={() => setShowCreateReferralModal(false)}>
                      {t('common.cancel')}
                    </button>
                    <button type="submit" className="module-btn primary" disabled={referralSubmitting}>
                      {referralSubmitting ? `⏳ ${t('networkReferrals.sending')}` : `🔄 ${t('networkReferrals.send')}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Accept / Reject Response Modal */}
          {responseModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setResponseModal(null)}
            >
              <div
                style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460 }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 16px' }}>
                  {responseModal.action === 'accepted' ? `✓ ${t('networkReferrals.accept')}` : `✗ ${t('networkReferrals.reject')}`}
                </h3>
                <p style={{ color: '#64748b', marginBottom: 16 }}>
                  {responseModal.action === 'accepted' ? t('networkReferrals.confirmAccept') : t('networkReferrals.confirmReject')}
                </p>
                <div className="module-form-group">
                  <label className="module-label">{t('networkReferrals.responseNotes')}</label>
                  <textarea
                    className="module-input"
                    rows={3}
                    placeholder={t('networkReferrals.responseNotesPlaceholder')}
                    value={responseNotes}
                    onChange={e => setResponseNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button className="module-btn" onClick={() => setResponseModal(null)}>{t('common.cancel')}</button>
                  <button
                    className="module-btn primary"
                    disabled={respondingSubmitting}
                    style={responseModal.action === 'rejected' ? { background: '#dc2626' } : {}}
                    onClick={handleReferralResponse}
                  >
                    {respondingSubmitting ? `⏳ ${t('common.saving')}` :
                     responseModal.action === 'accepted' ? `✓ ${t('networkReferrals.accept')}` : `✗ ${t('networkReferrals.reject')}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ TAB 6: LEAVE MANAGEMENT ════ */}
      {activeTab === 'leave' && selectedNetwork && (
        <div className="hn-tab-content">
          <div className="hn-audit-header">
            <div>
              <h2 className="hn-audit-section-title">🏖️ {t('hospitalNetworks.leave.title')}</h2>
            </div>
            <button className="module-btn primary" onClick={() => setShowLeaveModal(true)}>
              + {t('hospitalNetworks.leave.requestLeave')}
            </button>
          </div>
          {leaveRequests.length === 0 ? (
            <div className="hn-empty-state">
              <div className="hn-empty-icon">🏖️</div>
              <div className="hn-empty-title">{t('hospitalNetworks.leave.noRequests')}</div>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>{t('hospitalNetworks.leave.staffName')}</th>
                    <th>{t('hospitalNetworks.leave.type')}</th>
                    <th>{t('hospitalNetworks.leave.dates')}</th>
                    <th>{t('hospitalNetworks.leave.status')}</th>
                    <th>{t('hospitalNetworks.leave.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((lr: any) => (
                    <tr key={lr.id}>
                      <td>{lr.userName || '—'}</td>
                      <td><span className="module-badge">{lr.leave_type}</span></td>
                      <td>{new Date(lr.start_date).toLocaleDateString()} – {new Date(lr.end_date).toLocaleDateString()}</td>
                      <td>
                        <span className={`module-badge ${lr.status === 'approved' ? 'badge-success' : lr.status === 'rejected' ? 'badge-error' : 'badge-pending'}`}>
                          {lr.status}
                        </span>
                      </td>
                      <td>
                        {lr.status === 'pending' && (
                          <div className="hn-leave-actions">
                            <button className="module-btn small" onClick={async () => {
                              try {
                                await apiService.updateLeaveRequest(selectedNetwork!.id, lr.id, { status: 'approved' })
                                loadLeaveRequests()
                              } catch (err: any) { console.error(err) }
                            }}>✅</button>
                            <button className="module-btn small" onClick={async () => {
                              try {
                                await apiService.updateLeaveRequest(selectedNetwork!.id, lr.id, { status: 'rejected', rejectionReason: 'Declined by admin' })
                                loadLeaveRequests()
                              } catch (err: any) { console.error(err) }
                            }}>❌</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Leave Request Modal */}
          {showLeaveModal && (
            <div
              className="hn-modal-overlay"
              onClick={() => setShowLeaveModal(false)}
            >
              <div className="hn-modal-content" onClick={e => e.stopPropagation()}>
                <div className="hn-modal-header">
                  <h3>🏖️ {t('hospitalNetworks.leave.requestLeave')}</h3>
                  <button type="button" className="hn-modal-close" onClick={() => setShowLeaveModal(false)}>✕</button>
                </div>
                <form onSubmit={async (ev) => {
                  ev.preventDefault()
                  const fd = new FormData(ev.currentTarget)
                  try {
                    await apiService.createLeaveRequest(selectedNetwork!.id, {
                      leave_type: fd.get('leave_type'),
                      start_date: fd.get('start_date'),
                      end_date: fd.get('end_date'),
                      reason: fd.get('reason'),
                    })
                    setShowLeaveModal(false)
                    loadLeaveRequests()
                  } catch (err: any) { console.error(err) }
                }}>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.leave.type')} *</label>
                    <select name="leave_type" className="module-input" required>
                      <option value="annual">Annual</option>
                      <option value="sick">Sick</option>
                      <option value="personal">Personal</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('hospitalNetworks.leave.dates')} *</label>
                      <input type="date" name="start_date" className="module-input" required />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">&nbsp;</label>
                      <input type="date" name="end_date" className="module-input" required />
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('hospitalNetworks.transfers.reason')}</label>
                    <textarea name="reason" className="module-input" rows={3} />
                  </div>
                  <div className="hn-modal-actions">
                    <button type="button" className="module-btn" onClick={() => setShowLeaveModal(false)}>{t('common.cancel', 'Cancel')}</button>
                    <button type="submit" className="module-btn primary">{t('hospitalNetworks.leave.requestLeave')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ TAB 7: ROLE MATRIX ════ */}
      {activeTab === 'roleMatrix' && selectedNetwork && (
        <div className="hn-tab-content">
          <NetworkRoleMatrix
            networkId={selectedNetwork.id}
            networkName={selectedNetwork.name}
            adminMode={true}
          />
        </div>
      )}

      {/* ════ TAB 8: ANALYTICS ════ */}
      {activeTab === 'analytics' && selectedNetwork && (
        <div className="hn-tab-content">
          <div className="hn-audit-header">
            <h2 className="hn-audit-section-title">📊 {t('networkAnalytics.title')}</h2>
          </div>
          {analyticsLoading && <div className="hn-loading">⏳ {t('common.loading')}</div>}
          {analyticsError && <div className="module-alert error">{analyticsError}</div>}
          {!analyticsLoading && !analyticsError && analyticsData && (
            <>
              <div className="hn-analytics-grid">
                <div className="hn-stat-card hn-stat-blue">
                  <div className="hn-stat-value">{analyticsData.totalMembers ?? 0}</div>
                  <div className="hn-stat-label">👤 {t('networkAnalytics.totalMembers')}</div>
                </div>
                <div className="hn-stat-card hn-stat-green">
                  <div className="hn-stat-value">{analyticsData.totalHospitals ?? 0}</div>
                  <div className="hn-stat-label">🏥 {t('networkAnalytics.totalHospitals')}</div>
                </div>
                <div className="hn-stat-card hn-stat-teal">
                  <div className="hn-stat-value">{analyticsData.totalPatients ?? 0}</div>
                  <div className="hn-stat-label">🐾 {t('networkAnalytics.activePatients')}</div>
                </div>
                <div className="hn-stat-card hn-stat-orange">
                  <div className="hn-stat-value">{analyticsData.activeConsultations ?? 0}</div>
                  <div className="hn-stat-label">🩺 {t('networkAnalytics.consultations30d')}</div>
                </div>
                <div className="hn-stat-card hn-stat-purple">
                  <div className="hn-stat-value">{analyticsData.referrals30d ?? 0}</div>
                  <div className="hn-stat-label">🔄 {t('networkAnalytics.referrals30d')}</div>
                </div>
                <div className="hn-stat-card hn-stat-red">
                  <div className="hn-stat-value">{analyticsData.auditEvents7d ?? 0}</div>
                  <div className="hn-stat-label">🛡️ {t('networkAnalytics.auditEvents7d')}</div>
                </div>
              </div>

              {/* Enrollment Trend */}
              {Array.isArray(analyticsData.enrollmentTrend) && analyticsData.enrollmentTrend.length > 0 && (
                <div className="module-card" style={{ marginTop: 24 }}>
                  <div className="hn-panel-header">
                    <h3>{t('networkAnalytics.enrollmentTrend')}</h3>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{t('networkAnalytics.lastNMonths', { n: 6 })}</span>
                  </div>
                  <div className="card-body">
                    {[...analyticsData.enrollmentTrend].reverse().map((item: any, i: number) => {
                      const month = item.month ? new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'
                      const count = parseInt(item.count ?? 0)
                      const max = Math.max(...analyticsData.enrollmentTrend.map((r: any) => parseInt(r.count ?? 0)), 1)
                      return (
                        <div key={i} className="hn-trend-row">
                          <span className="hn-trend-month">{month}</span>
                          <div className="hn-trend-bar-wrap">
                            <div className="hn-trend-bar" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="hn-trend-count">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          {!analyticsLoading && !analyticsError && !analyticsData && (
            <div className="hn-empty-state">
              <div className="hn-empty-icon">📊</div>
              <div className="hn-empty-title">{t('networkAnalytics.noData')}</div>
            </div>
          )}
        </div>
      )}

      {/* Compliance Export Modal */}
      {showComplianceModal && selectedNetwork && (
        <div className="hn-modal-overlay" onClick={() => setShowComplianceModal(false)}>
          <div className="hn-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="hn-modal-header">
              <h2>📋 {t('complianceExport.exportDateRange')}</h2>
              <button type="button" className="hn-modal-close" onClick={() => setShowComplianceModal(false)}>✕</button>
            </div>
            <div className="hn-modal-body">
              {complianceError && <div className="module-alert error">{complianceError}</div>}
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('complianceExport.exportFrom')} <span className="hn-required">*</span></label>
                  <input type="date" className="module-input" value={complianceFrom} onChange={e => setComplianceFrom(e.target.value)} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('complianceExport.exportTo')} <span className="hn-required">*</span></label>
                  <input type="date" className="module-input" value={complianceTo} onChange={e => setComplianceTo(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="hn-modal-actions">
              <button type="button" className="module-btn" onClick={() => setShowComplianceModal(false)}>{t('common.cancel')}</button>
              <button
                type="button"
                className="module-btn primary"
                disabled={!complianceFrom || !complianceTo || complianceGenerating}
                onClick={handleExportCompliance}
              >
                {complianceGenerating ? `⏳ ${t('complianceExport.generating')}` : `⬇️ ${t('complianceExport.downloadReport')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P6-APPROVAL: Approval Action Modal */}
      {showApprovalModal && (
        <div className="hn-modal-overlay" onClick={() => { setShowApprovalModal(null); setApprovalNotes('') }}>
          <div className="hn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="hn-modal-header">
              <h3>
                {showApprovalModal === 'info_requested' && ('❓ ' + t('networkApproval.requestInfo'))}
                {showApprovalModal === 'approved' && ('✅ ' + t('networkApproval.approveNetwork'))}
                {showApprovalModal === 'rejected' && ('❌ ' + t('networkApproval.rejectNetwork'))}
                {showApprovalModal === 'suspended' && '⏸ Suspend Network'}
                {showApprovalModal === 'reactivated' && '🔄 Reactivate Network'}
              </h3>
              <button type="button" className="hn-modal-close" onClick={() => { setShowApprovalModal(null); setApprovalNotes('') }}>✕</button>
            </div>
            <div className="hn-modal-body">
              <div className="module-form-group">
                <label className="module-label">{t('networkApproval.addNotes')}</label>
                <textarea className="module-input" rows={4} value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  placeholder="Describe the reason or required changes..." />
              </div>
              <div className="hn-modal-actions">
                <button type="button" className="module-btn" onClick={() => { setShowApprovalModal(null); setApprovalNotes('') }}>{t('common.cancel')}</button>
                <button type="button" className="module-btn primary" disabled={approvalSaving} onClick={handleApprovalAction}>
                  {approvalSaving ? ('⏳ ' + t('common.saving')) : t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HospitalNetworks
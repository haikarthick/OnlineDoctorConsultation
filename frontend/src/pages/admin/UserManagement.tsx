import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  createdAt: string
}

interface VetProfileData {
  consultationFee: string
  bio: string
  specializations: string
  qualifications: string
  languages: string
  clinicName: string
  clinicAddress: string
  licenseNumber: string
  yearsOfExperience: string
  availableDays: string
  availableHoursStart: string
  availableHoursEnd: string
  isAvailable: boolean
  acceptsEmergency: boolean
  profileImage: string
}

const EMPTY_VET_FORM: VetProfileData = {
  consultationFee: '', bio: '', specializations: '', qualifications: '', languages: '',
  clinicName: '', clinicAddress: '', licenseNumber: '', yearsOfExperience: '',
  availableDays: '', availableHoursStart: '', availableHoursEnd: '',
  isAvailable: true, acceptsEmergency: false, profileImage: '',
}

interface UserManagementProps {
  onNavigate: (path: string) => void
}

const UserManagement: React.FC<UserManagementProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatDate, formatCurrency } = useSettings()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [showRoleModal, setShowRoleModal] = useState<User | null>(null)
  const [newRole, setNewRole] = useState('')

  // Vet Profile Modal
  const [showVetModal, setShowVetModal] = useState<User | null>(null)
  const [vetForm, setVetForm] = useState<VetProfileData>(EMPTY_VET_FORM)
  const [vetLoading, setVetLoading] = useState(false)
  const [vetSaving, setVetSaving] = useState(false)
  const [vetSaved, setVetSaved] = useState(false)

  // Role Change Requests tab
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users')
  const [roleRequests, setRoleRequests] = useState<any[]>([])
  const [requestsFilter, setRequestsFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [requestProcessing, setRequestProcessing] = useState<string | null>(null)
  const [requestMsg, setRequestMsg] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    loadUsers()
  }, [search, roleFilter])

  useEffect(() => {
    if (activeTab === 'requests') loadRoleRequests()
  }, [activeTab, requestsFilter])

  const loadRoleRequests = async () => {
    try {
      setRequestsLoading(true)
      setRequestMsg('')
      setActionError('')
      const result = await apiService.adminListRoleChangeRequests(requestsFilter)
      setRoleRequests(result.data || [])
    } catch (err: any) {
      console.error('Failed to load role requests:', err?.message)
      setActionError(err?.response?.data?.message || err?.message || 'Failed to load role change requests')
    } finally {
      setRequestsLoading(false)
    }
  }

  const handleApproveRequest = async (id: string) => {
    try {
      setRequestProcessing(id)
      await apiService.adminApproveRoleChangeRequest(id)
      setRequestMsg(t('adminRoleRequests.approveSuccess'))
      loadRoleRequests()
    } catch (err: any) {
      console.error('Failed to approve request:', err?.message)
      setActionError(err?.response?.data?.message || err?.message || 'Failed to approve request')
    } finally {
      setRequestProcessing(null)
    }
  }

  const handleRejectRequest = async () => {
    if (!showRejectModal || !rejectionReason.trim()) return
    try {
      setRequestProcessing(showRejectModal)
      await apiService.adminRejectRoleChangeRequest(showRejectModal, rejectionReason)
      setRequestMsg(t('adminRoleRequests.rejectSuccess'))
      setShowRejectModal(null)
      setRejectionReason('')
      loadRoleRequests()
    } catch (err: any) {
      console.error('Failed to reject request:', err?.message)
      setActionError(err?.response?.data?.message || err?.message || 'Failed to reject request')
    } finally {
      setRequestProcessing(null)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminListUsers({ search, role: roleFilter || undefined })
      setUsers(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err: any) {
      console.error('Failed to load users:', err?.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (userId: string) => {
    try {
      setProcessing(userId)
      await apiService.adminToggleUserStatus(userId, !users.find(u => u.id === userId)?.isActive)
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u))
    } catch (err: any) {
      console.error('Failed to toggle user status:', err?.message)
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update user status')
    } finally {
      setProcessing(null)
    }
  }

  const handleChangeRole = async () => {
    if (!showRoleModal || !newRole) return
    try {
      setProcessing(showRoleModal.id)
      await apiService.adminChangeUserRole(showRoleModal.id, newRole)
      setUsers(users.map(u => u.id === showRoleModal.id ? { ...u, role: newRole } : u))
      setShowRoleModal(null)
    } catch (err: any) {
      console.error('Failed to change role:', err?.message)
      setActionError(err?.response?.data?.message || err?.message || 'Failed to change user role')
    } finally {
      setProcessing(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = { admin: 'danger', veterinarian: 'active', pet_owner: 'pending', farmer: 'inactive', corporate_admin: 'info' }
    return <span className={`badge badge-${map[role] || 'inactive'}`}>{role.replace('_', ' ')}</span>
  }

  const openVetProfile = async (user: User) => {
    setShowVetModal(user)
    setVetForm(EMPTY_VET_FORM)
    setVetSaved(false)
    setVetLoading(true)
    try {
      const result = await apiService.adminGetVetProfile(user.id)
      const p = result.data
      setVetForm({
        consultationFee: p.consultationFee?.toString() || '',
        bio: p.bio || '',
        specializations: (p.specializations || []).join(', '),
        qualifications: (p.qualifications || []).join(', '),
        languages: (p.languages || []).join(', '),
        clinicName: p.clinicName || '',
        clinicAddress: p.clinicAddress || '',
        licenseNumber: p.licenseNumber || '',
        yearsOfExperience: p.yearsOfExperience?.toString() || '',
        availableDays: p.availableDays || '',
        availableHoursStart: p.availableHoursStart || '',
        availableHoursEnd: p.availableHoursEnd || '',
        isAvailable: p.isAvailable ?? true,
        acceptsEmergency: p.acceptsEmergency ?? false,
        profileImage: p.profileImage || '',
      })
    } catch {
      // No vet profile — form stays empty
    } finally {
      setVetLoading(false)
    }
  }

  const handleVetFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setVetForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setVetForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSaveVetProfile = async () => {
    if (!showVetModal) return
    try {
      setVetSaving(true)
      const payload: Record<string, unknown> = {
        consultationFee: parseFloat(vetForm.consultationFee) || 0,
        bio: vetForm.bio,
        specializations: vetForm.specializations.split(',').map(s => s.trim()).filter(Boolean),
        qualifications: vetForm.qualifications.split(',').map(s => s.trim()).filter(Boolean),
        languages: vetForm.languages.split(',').map(s => s.trim()).filter(Boolean),
        clinicName: vetForm.clinicName,
        clinicAddress: vetForm.clinicAddress,
        licenseNumber: vetForm.licenseNumber,
        yearsOfExperience: parseInt(vetForm.yearsOfExperience) || 0,
        availableDays: vetForm.availableDays,
        availableHoursStart: vetForm.availableHoursStart,
        availableHoursEnd: vetForm.availableHoursEnd,
        isAvailable: vetForm.isAvailable,
        acceptsEmergency: vetForm.acceptsEmergency,
        profileImage: vetForm.profileImage,
      }
      await apiService.adminUpdateVetProfile(showVetModal.id, payload)
      setVetSaved(true)
      setTimeout(() => setVetSaved(false), 3000)
    } catch {
      alert(t('userManagement.failedUpdateVet'))
    } finally {
      setVetSaving(false)
    }
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('userManagement.title')}</h1>
          <p className="page-subtitle">{t('userManagement.subtitle', { count: users.length })}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('userManagement.dashboard')}</button>
        </div>
      </div>

      {actionError && (
        <div className="module-alert error" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {actionError}</span>
          <button type="button" onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', marginLeft: 8 }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="module-tabs" style={{ marginBottom: 24 }}>
        <button className={`module-tab${activeTab === 'users' ? ' active' : ''}`} onClick={() => setActiveTab('users')}>
          👥 Users
        </button>
        <button className={`module-tab${activeTab === 'requests' ? ' active' : ''}`} onClick={() => setActiveTab('requests')}>
          🔄 {t('adminRoleRequests.title')}
        </button>
      </div>

      {/* ── Role Change Requests Tab ── */}
      {activeTab === 'requests' && (
        <div>
          {requestMsg && <div className="module-alert success" style={{ marginBottom: 16 }}>{requestMsg}</div>}
          <div className="module-tabs" style={{ marginBottom: 16 }}>
            {(['pending', 'approved', 'rejected'] as const).map(s => (
              <button key={s} className={`module-tab${requestsFilter === s ? ' active' : ''}`} onClick={() => setRequestsFilter(s)}>
                {t(`adminRoleRequests.tabs.${s}`)}
              </button>
            ))}
          </div>
          {requestsLoading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : roleRequests.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 40 }}>🔄</div>
              <p>{t('adminRoleRequests.noRequests', { status: requestsFilter })}</p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('adminRoleRequests.table.user')}</th>
                    <th>{t('adminRoleRequests.table.currentRole')}</th>
                    <th>{t('adminRoleRequests.table.requestedRole')}</th>
                    <th>{t('adminRoleRequests.table.reason')}</th>
                    <th>{t('adminRoleRequests.table.requestedAt')}</th>
                    {requestsFilter === 'pending' && <th>{t('adminRoleRequests.table.actions')}</th>}
                    {requestsFilter !== 'pending' && <th>Review</th>}
                  </tr>
                </thead>
                <tbody>
                  {roleRequests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div>
                          <strong>{r.userName}</strong>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.userEmail}</div>
                          {r.uniqueId && <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.uniqueId}</div>}
                        </div>
                      </td>
                      <td>{getRoleBadge(r.currentRole)}</td>
                      <td>{getRoleBadge(r.requestedRole)}</td>
                      <td style={{ maxWidth: 200, fontSize: 13 }}>{r.reason}</td>
                      <td style={{ fontSize: 13 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      {requestsFilter === 'pending' ? (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={requestProcessing === r.id}
                              onClick={() => handleApproveRequest(r.id)}
                            >
                              {requestProcessing === r.id ? '...' : t('adminRoleRequests.approve')}
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              disabled={requestProcessing === r.id}
                              onClick={() => { setShowRejectModal(r.id); setRejectionReason('') }}
                            >
                              {t('adminRoleRequests.reject')}
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td style={{ fontSize: 12 }}>
                          {r.reviewedBy && <div>{t('adminRoleRequests.reviewedBy', { name: r.reviewedBy })}</div>}
                          {r.rejectionReason && <div style={{ color: '#ef4444' }}>{t('adminRoleRequests.rejectedReason', { reason: r.rejectionReason })}</div>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reject Modal */}
          {showRejectModal && (
            <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                  <h2>{t('adminRoleRequests.rejectModal.title')}</h2>
                  <button className="modal-close" onClick={() => setShowRejectModal(null)}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">{t('adminRoleRequests.rejectModal.reasonLabel')}</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder={t('adminRoleRequests.rejectModal.reasonPlaceholder')}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn btn-outline" onClick={() => setShowRejectModal(null)}>
                      {t('adminRoleRequests.rejectModal.cancelBtn')}
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={!rejectionReason.trim() || requestProcessing === showRejectModal}
                      onClick={handleRejectRequest}
                    >
                      {requestProcessing === showRejectModal ? t('adminRoleRequests.rejecting') : t('adminRoleRequests.rejectModal.confirmBtn')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (<>
      <div className="search-filter-bar" style={{ marginBottom: 24 }}>
        <input
          className="form-input"
          placeholder={t('userManagement.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select className="form-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">{t('userManagement.allRoles')}</option>
          <option value="pet_owner">{t('userManagement.petOwners')}</option>
          <option value="veterinarian">{t('userManagement.veterinarians')}</option>
          <option value="farmer">Farmers</option>
          <option value="corporate_admin">Hospital Network</option>
          <option value="admin">{t('userManagement.admins')}</option>
        </select>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>{t('userManagement.changeRole')}</h2>
              <button className="modal-close" onClick={() => setShowRoleModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>{t('userManagement.changeRoleFor')} <strong>{showRoleModal.firstName} {showRoleModal.lastName}</strong></p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>{t('userManagement.currentRole')}: {showRoleModal.role}</p>
              <div className="form-group">
                <label className="form-label">{t('userManagement.newRole')}</label>
                <select className="form-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="">{t('userManagement.selectRole')}</option>
                  <option value="pet_owner">{t('userManagement.petOwner')}</option>
                  <option value="veterinarian">{t('userManagement.veterinarian')}</option>
                  <option value="farmer">Farmer</option>
                  <option value="corporate_admin">Hospital Network Admin</option>
                  <option value="admin">{t('userManagement.admin')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setShowRoleModal(null)}>{t('userManagement.cancel')}</button>
                <button className="btn btn-primary" disabled={!newRole || processing === showRoleModal.id} onClick={handleChangeRole}>
                  {processing === showRoleModal.id ? t('userManagement.saving') : t('userManagement.changeRole')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>👥</div>
          <h3>{t('userManagement.noUsers')}</h3>
          <p>{t('userManagement.adjustSearch')}</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('userManagement.user')}</th>
                <th>{t('userManagement.email')}</th>
                <th>{t('userManagement.role')}</th>
                <th>{t('userManagement.status')}</th>
                <th>{t('userManagement.joined')}</th>
                <th>{t('userManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 600, color: '#4f46e5', fontSize: 14
                      }}>
                        {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                      </div>
                      <span>{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>{getRoleBadge(u.role)}</td>
                  <td>
                    <span className={`badge badge-${u.isActive ? 'active' : 'danger'}`}>
                      {u.isActive ? t('userManagement.activeStatus') : t('userManagement.inactiveStatus')}
                    </span>
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={`btn btn-sm ${u.isActive ? 'btn-warning' : 'btn-success'}`}
                        disabled={processing === u.id}
                        onClick={() => handleToggleStatus(u.id)}
                      >
                        {u.isActive ? t('userManagement.deactivate') : t('userManagement.activate')}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => { setShowRoleModal(u); setNewRole('') }}
                      >
                        {t('userManagement.role')}
                      </button>
                      {(u.role === 'veterinarian') && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openVetProfile(u)}
                        >
                          🩺 Profile
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vet Profile Modal */}
      {showVetModal && (
        <div className="modal-overlay" onClick={() => setShowVetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>🩺 {t('userManagement.vetProfile')} — {showVetModal.firstName} {showVetModal.lastName}</h2>
              <button className="modal-close" onClick={() => setShowVetModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {vetLoading ? (
                <div className="loading-container"><div className="loading-spinner" /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">{t('userManagement.licenseNumber')}</label>
                      <input className="form-input" name="licenseNumber" value={vetForm.licenseNumber} onChange={handleVetFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('userManagement.yearsExperience')}</label>
                      <input className="form-input" type="number" name="yearsOfExperience" value={vetForm.yearsOfExperience} onChange={handleVetFormChange} min="0" max="80" />
                    </div>
                  </div>
                  <div className="form-group">
                      <label className="form-label">{t('userManagement.bio')}</label>
                    <textarea className="form-input" name="bio" value={vetForm.bio} onChange={handleVetFormChange} rows={3} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                      <label className="form-label">{t('userManagement.consultationFee')}</label>
                    <input className="form-input" type="number" name="consultationFee" value={vetForm.consultationFee} onChange={handleVetFormChange} min="0" step="0.01" />
                    {vetForm.consultationFee && <span style={{ fontSize: 12, color: '#6b7280' }}>Preview: {formatCurrency(parseFloat(vetForm.consultationFee) || 0)}</span>}
                  </div>
                  <div className="form-group">
                      <label className="form-label">{t('userManagement.specializations')}</label>
                    <input className="form-input" name="specializations" value={vetForm.specializations} onChange={handleVetFormChange} placeholder="Dermatology, Orthopedics" />
                  </div>
                  <div className="form-group">
                      <label className="form-label">{t('userManagement.qualifications')}</label>
                    <input className="form-input" name="qualifications" value={vetForm.qualifications} onChange={handleVetFormChange} placeholder="BVSc, MVSc" />
                  </div>
                  <div className="form-group">
                      <label className="form-label">{t('userManagement.languages')}</label>
                    <input className="form-input" name="languages" value={vetForm.languages} onChange={handleVetFormChange} placeholder="English, Hindi" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">{t('userManagement.clinicName')}</label>
                      <input className="form-input" name="clinicName" value={vetForm.clinicName} onChange={handleVetFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('userManagement.clinicAddress')}</label>
                      <input className="form-input" name="clinicAddress" value={vetForm.clinicAddress} onChange={handleVetFormChange} />
                    </div>
                  </div>
                  <div className="form-group">
                      <label className="form-label">{t('userManagement.availableDays')}</label>
                    <input className="form-input" name="availableDays" value={vetForm.availableDays} onChange={handleVetFormChange} placeholder="Mon-Fri" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">{t('userManagement.hoursStart')}</label>
                      <input className="form-input" type="time" name="availableHoursStart" value={vetForm.availableHoursStart} onChange={handleVetFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('userManagement.hoursEnd')}</label>
                      <input className="form-input" type="time" name="availableHoursEnd" value={vetForm.availableHoursEnd} onChange={handleVetFormChange} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, padding: '4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" name="isAvailable" checked={vetForm.isAvailable} onChange={handleVetFormChange} />
                      <span>{t('userManagement.available')}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" name="acceptsEmergency" checked={vetForm.acceptsEmergency} onChange={handleVetFormChange} />
                      <span>{t('userManagement.acceptEmergencies')}</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-outline" onClick={() => setShowVetModal(null)}>{t('userManagement.cancel')}</button>
                    <button className="btn btn-primary" disabled={vetSaving} onClick={handleSaveVetProfile}>
                      {vetSaving ? t('userManagement.saving') : t('userManagement.saveVetProfile')}
                    </button>
                    {vetSaved && <span style={{ color: '#16a34a', alignSelf: 'center', fontSize: 13 }}>✓ {t('userManagement.saved')}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}

export default UserManagement

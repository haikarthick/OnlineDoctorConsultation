import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    loadUsers()
  }, [search, roleFilter])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminListUsers({ search, role: roleFilter || undefined })
      setUsers(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (userId: string) => {
    try {
      setProcessing(userId)
      await apiService.adminToggleUserStatus(userId, !users.find(u => u.id === userId)?.isActive)
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u))
    } catch (err) {
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
    } catch (err) {
} finally {
      setProcessing(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = { admin: 'danger', vet: 'active', pet_owner: 'pending' }
    return <span className={`badge badge-${map[role] || 'inactive'}`}>{role}</span>
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
      alert('Failed to update vet profile')
    } finally {
      setVetSaving(false)
    }
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p className="page-subtitle">{users.length} users total</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar" style={{ marginBottom: 24 }}>
        <input
          className="form-input"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select className="form-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">All Roles</option>
          <option value="pet_owner">Pet Owners</option>
          <option value="vet">Veterinarians</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Change Role</h2>
              <button className="modal-close" onClick={() => setShowRoleModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Change role for <strong>{showRoleModal.firstName} {showRoleModal.lastName}</strong></p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Current role: {showRoleModal.role}</p>
              <div className="form-group">
                <label className="form-label">New Role</label>
                <select className="form-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="">Select role...</option>
                  <option value="pet_owner">Pet Owner</option>
                  <option value="vet">Veterinarian</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setShowRoleModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!newRole || processing === showRoleModal.id} onClick={handleChangeRole}>
                  {processing === showRoleModal.id ? 'Saving...' : 'Change Role'}
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
          <h3>No users found</h3>
          <p>Try adjusting your search</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
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
                      {u.isActive ? 'Active' : 'Inactive'}
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
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => { setShowRoleModal(u); setNewRole('') }}
                      >
                        Role
                      </button>
                      {(u.role === 'vet' || u.role === 'veterinarian') && (
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
              <h2>🩺 Vet Profile — {showVetModal.firstName} {showVetModal.lastName}</h2>
              <button className="modal-close" onClick={() => setShowVetModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {vetLoading ? (
                <div className="loading-container"><div className="loading-spinner" /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">License Number</label>
                      <input className="form-input" name="licenseNumber" value={vetForm.licenseNumber} onChange={handleVetFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Years of Experience</label>
                      <input className="form-input" type="number" name="yearsOfExperience" value={vetForm.yearsOfExperience} onChange={handleVetFormChange} min="0" max="80" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bio</label>
                    <textarea className="form-input" name="bio" value={vetForm.bio} onChange={handleVetFormChange} rows={3} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consultation Fee</label>
                    <input className="form-input" type="number" name="consultationFee" value={vetForm.consultationFee} onChange={handleVetFormChange} min="0" step="0.01" />
                    {vetForm.consultationFee && <span style={{ fontSize: 12, color: '#6b7280' }}>Preview: {formatCurrency(parseFloat(vetForm.consultationFee) || 0)}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specializations (comma-separated)</label>
                    <input className="form-input" name="specializations" value={vetForm.specializations} onChange={handleVetFormChange} placeholder="Dermatology, Orthopedics" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualifications (comma-separated)</label>
                    <input className="form-input" name="qualifications" value={vetForm.qualifications} onChange={handleVetFormChange} placeholder="BVSc, MVSc" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Languages (comma-separated)</label>
                    <input className="form-input" name="languages" value={vetForm.languages} onChange={handleVetFormChange} placeholder="English, Hindi" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Clinic Name</label>
                      <input className="form-input" name="clinicName" value={vetForm.clinicName} onChange={handleVetFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Clinic Address</label>
                      <input className="form-input" name="clinicAddress" value={vetForm.clinicAddress} onChange={handleVetFormChange} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Available Days</label>
                    <input className="form-input" name="availableDays" value={vetForm.availableDays} onChange={handleVetFormChange} placeholder="Mon-Fri" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Hours Start</label>
                      <input className="form-input" type="time" name="availableHoursStart" value={vetForm.availableHoursStart} onChange={handleVetFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hours End</label>
                      <input className="form-input" type="time" name="availableHoursEnd" value={vetForm.availableHoursEnd} onChange={handleVetFormChange} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, padding: '4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" name="isAvailable" checked={vetForm.isAvailable} onChange={handleVetFormChange} />
                      <span>Available</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" name="acceptsEmergency" checked={vetForm.acceptsEmergency} onChange={handleVetFormChange} />
                      <span>Accept Emergencies</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-outline" onClick={() => setShowVetModal(null)}>Cancel</button>
                    <button className="btn btn-primary" disabled={vetSaving} onClick={handleSaveVetProfile}>
                      {vetSaving ? 'Saving...' : 'Save Vet Profile'}
                    </button>
                    {vetSaved && <span style={{ color: '#16a34a', alignSelf: 'center', fontSize: 13 }}>✓ Saved</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement

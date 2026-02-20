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

interface UserManagementProps {
  onNavigate: (path: string) => void
}

const UserManagement: React.FC<UserManagementProps> = ({ onNavigate }) => {
  const { formatDate } = useSettings()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [showRoleModal, setShowRoleModal] = useState<User | null>(null)
  const [newRole, setNewRole] = useState('')

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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default UserManagement

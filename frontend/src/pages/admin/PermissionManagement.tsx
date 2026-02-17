import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface PermissionManagementProps {
  onNavigate: (path: string) => void
}

interface PermissionMetadata {
  categories: Record<string, { label: string; permissions: string[] }>
  labels: Record<string, string>
  allPermissions: string[]
  roles: string[]
  roleLabels: Record<string, string>
}

const PermissionManagement: React.FC<PermissionManagementProps> = ({ onNavigate: _onNavigate }) => {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [metadata, setMetadata] = useState<PermissionMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('veterinarian')
  const [searchQuery, setSearchQuery] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => { loadPermissions() }, [])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await apiService.adminGetPermissions()
      setMatrix(result.data?.matrix || {})
      setMetadata(result.data?.metadata || null)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (role: string, permission: string) => {
    const currentValue = matrix[role]?.[permission] ?? false
    const newValue = !currentValue

    // Optimistic update
    setMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [permission]: newValue }
    }))

    try {
      setSaving(`${role}.${permission}`)
      await apiService.adminUpdatePermission(role, permission, newValue)
      setSuccess(`Updated: ${metadata?.roleLabels[role] || role} → ${metadata?.labels[permission] || permission} = ${newValue ? 'Enabled' : 'Disabled'}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      // Revert on error
      setMatrix(prev => ({
        ...prev,
        [role]: { ...prev[role], [permission]: currentValue }
      }))
      setError(err?.response?.data?.error?.message || 'Failed to update permission')
    } finally {
      setSaving(null)
    }
  }

  const handleResetDefaults = async () => {
    if (!window.confirm(`Reset all permissions for "${metadata?.roleLabels[selectedRole] || selectedRole}" to defaults? This cannot be undone.`)) return
    try {
      setResetting(true)
      setError('')
      const result = await apiService.adminResetPermissions(selectedRole)
      setMatrix(result.data?.matrix || matrix)
      setSuccess(`Permissions reset to defaults for ${metadata?.roleLabels[selectedRole] || selectedRole}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset permissions')
    } finally {
      setResetting(false)
    }
  }

  const handleEnableAll = async (category: string) => {
    const perms = metadata?.categories[category]?.permissions || []
    const updates: Record<string, boolean> = {}
    perms.forEach(p => { updates[p] = true })

    // Optimistic update
    setMatrix(prev => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], ...updates }
    }))

    try {
      setSaving(category)
      await apiService.adminBulkUpdatePermissions(selectedRole, updates)
      setSuccess(`Enabled all ${metadata?.categories[category]?.label || category} permissions for ${metadata?.roleLabels[selectedRole]}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      loadPermissions() // reload on error
      setError(err?.response?.data?.error?.message || 'Failed to update')
    } finally {
      setSaving(null)
    }
  }

  const handleDisableAll = async (category: string) => {
    const perms = metadata?.categories[category]?.permissions || []
    const updates: Record<string, boolean> = {}
    perms.forEach(p => { updates[p] = false })

    setMatrix(prev => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], ...updates }
    }))

    try {
      setSaving(category)
      await apiService.adminBulkUpdatePermissions(selectedRole, updates)
      setSuccess(`Disabled all ${metadata?.categories[category]?.label || category} permissions for ${metadata?.roleLabels[selectedRole]}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      loadPermissions()
      setError(err?.response?.data?.error?.message || 'Failed to update')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading permissions...</p>
        </div>
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p>No permission data available.</p>
          <button className="btn btn-primary" onClick={loadPermissions}>Retry</button>
        </div>
      </div>
    )
  }

  const rolePerms = matrix[selectedRole] || {}
  const enabledCount = Object.values(rolePerms).filter(Boolean).length
  const totalCount = metadata.allPermissions.length

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>🔐 Permission Management</h1>
          <p className="page-subtitle">Configure role-based access control — what each role can see and do</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button style={{ marginLeft: 12, padding: '4px 12px', border: '1px solid #dc2626', borderRadius: 4, background: 'white', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ padding: '14px 18px', background: '#f0fdf4', color: '#16a34a', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ✅ {success}
        </div>
      )}

      {/* Role Selector Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {metadata.roles.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            style={{
              padding: '10px 20px',
              border: selectedRole === role ? '2px solid #667eea' : '2px solid #e5e7eb',
              borderRadius: 8,
              background: selectedRole === role ? '#667eea' : 'white',
              color: selectedRole === role ? 'white' : '#374151',
              fontWeight: selectedRole === role ? 600 : 400,
              cursor: 'pointer',
              fontSize: 14,
              transition: 'all 0.2s'
            }}
          >
            {metadata.roleLabels[role] || role}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, width: 200 }}
          />
          <button
            onClick={handleResetDefaults}
            disabled={resetting}
            style={{ padding: '8px 16px', border: '1px solid #dc2626', borderRadius: 6, background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}
          >
            {resetting ? 'Resetting...' : '↻ Reset to Defaults'}
          </button>
        </div>
      </div>

      {/* Role Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#667eea' }}>{enabledCount}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Enabled Permissions</div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#9ca3af' }}>{totalCount - enabledCount}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Disabled Permissions</div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{totalCount}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Total Permissions</div>
        </div>
      </div>

      {/* Permission Categories */}
      {Object.entries(metadata.categories).map(([catKey, category]) => {
        const filteredPerms = category.permissions.filter(p => {
          if (!searchQuery) return true
          const label = metadata.labels[p] || p
          return label.toLowerCase().includes(searchQuery.toLowerCase()) || p.toLowerCase().includes(searchQuery.toLowerCase())
        })

        if (filteredPerms.length === 0) return null

        const catEnabledCount = filteredPerms.filter(p => rolePerms[p]).length

        return (
          <div key={catKey} style={{ background: 'white', borderRadius: 12, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {/* Category Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{category.label}</h3>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{catEnabledCount}/{filteredPerms.length} enabled</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleEnableAll(catKey)}
                  disabled={saving === catKey}
                  style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #16a34a', borderRadius: 4, background: 'white', color: '#16a34a', cursor: 'pointer' }}
                >
                  Enable All
                </button>
                <button
                  onClick={() => handleDisableAll(catKey)}
                  disabled={saving === catKey}
                  style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #dc2626', borderRadius: 4, background: 'white', color: '#dc2626', cursor: 'pointer' }}
                >
                  Disable All
                </button>
              </div>
            </div>

            {/* Permission Rows */}
            <div style={{ padding: '8px 0' }}>
              {filteredPerms.map(permission => {
                const isEnabled = rolePerms[permission] ?? false
                const isSaving = saving === `${selectedRole}.${permission}`

                return (
                  <div
                    key={permission}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 20px',
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>
                        {metadata.labels[permission] || permission}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
                        {permission}
                      </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, cursor: isSaving ? 'wait' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggle(selectedRole, permission)}
                        disabled={isSaving}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: isEnabled ? '#667eea' : '#d1d5db',
                        borderRadius: 26,
                        transition: 'background-color 0.3s',
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: 20,
                          width: 20,
                          left: isEnabled ? 24 : 3,
                          bottom: 3,
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: 'left 0.3s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </span>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Permission Matrix View */}
      <div style={{ background: 'white', borderRadius: 12, marginTop: 24, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📊 Role Comparison Matrix</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', position: 'sticky', left: 0 }}>Permission</th>
                {metadata.roles.map(role => (
                  <th key={role} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', minWidth: 100 }}>
                    {metadata.roleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metadata.allPermissions.filter(p => {
                if (!searchQuery) return true
                const label = metadata.labels[p] || p
                return label.toLowerCase().includes(searchQuery.toLowerCase())
              }).map(perm => (
                <tr key={perm}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 500, position: 'sticky', left: 0, background: 'white' }}>
                    {metadata.labels[perm] || perm}
                  </td>
                  {metadata.roles.map(role => (
                    <td key={role} style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{
                        display: 'inline-block',
                        width: 20, height: 20,
                        borderRadius: '50%',
                        background: matrix[role]?.[perm] ? '#16a34a' : '#e5e7eb',
                        lineHeight: '20px', fontSize: 11, color: 'white', fontWeight: 600
                      }}>
                        {matrix[role]?.[perm] ? '✓' : ''}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PermissionManagement

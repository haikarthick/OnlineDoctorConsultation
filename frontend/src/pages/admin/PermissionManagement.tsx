import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import NetworkRoleMatrix from '../hospitalnetwork/NetworkRoleMatrix'
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
  const { t } = useTranslation()
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [metadata, setMetadata] = useState<PermissionMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('veterinarian')
  const [searchQuery, setSearchQuery] = useState('')
  const [resetting, setResetting] = useState(false)
  const [viewMode, setViewMode] = useState<'systemRoles' | 'networkRoles'>('systemRoles')

  useEffect(() => { loadPermissions() }, [])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await apiService.adminGetPermissions()
      setMatrix(result.data?.matrix || {})
      setMetadata(result.data?.metadata || null)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('permissionManagement.failedToLoad'))
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
      setError(err?.response?.data?.error?.message || t('permissionManagement.failedToUpdate'))
    } finally {
      setSaving(null)
    }
  }

  const handleResetDefaults = async () => {
    if (!window.confirm(t('permissionManagement.resetConfirm', { role: metadata?.roleLabels[selectedRole] || selectedRole }))) return
    try {
      setResetting(true)
      setError('')
      const result = await apiService.adminResetPermissions(selectedRole)
      setMatrix(result.data?.matrix || matrix)
      setSuccess(`Permissions reset to defaults for ${metadata?.roleLabels[selectedRole] || selectedRole}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('permissionManagement.failedToReset'))
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
      setError(err?.response?.data?.error?.message || t('permissionManagement.failedToUpdate'))
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
          <p>{t('permissionManagement.loading')}</p>
        </div>
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className="module-page">
        <div className="si-86638a30">
          <p>{t('permissionManagement.noData')}</p>
          <button className="btn btn-primary" onClick={loadPermissions}>{t('permissionManagement.retry')}</button>
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
          <h1>🔐 {t('permissionManagement.title')}</h1>
          <p className="page-subtitle">{t('permissionManagement.subtitle')}</p>
        </div>
      </div>

      {/* Page-level content */}
      {error && (
        <div className="si-9bc53e01">
          ⚠️ {error}
          <button className="si-53b56f1c" onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="si-d059a7aa">
          ✅ {success}
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="si-1bfe228c">
        <button
          onClick={() => setViewMode('systemRoles')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            background: viewMode === 'systemRoles' ? 'white' : 'transparent',
            color: viewMode === 'systemRoles' ? '#667eea' : '#6b7280',
            boxShadow: viewMode === 'systemRoles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          🔐 {t('permissionManagement.tabSystemRoles')}
        </button>
        <button
          onClick={() => setViewMode('networkRoles')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            background: viewMode === 'networkRoles' ? 'white' : 'transparent',
            color: viewMode === 'networkRoles' ? '#667eea' : '#6b7280',
            boxShadow: viewMode === 'networkRoles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          🏥 {t('permissionManagement.tabNetworkRoles')}
        </button>
      </div>

      {viewMode === 'networkRoles' && (
        <NetworkRoleMatrix networkId="" adminMode={false} />
      )}

      {viewMode === 'systemRoles' && (<>
      {/* Role Selector Tabs */}
      <div className="si-1c568433">
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

        <div className="si-f869b5ad">
          <input
            type="text"
            placeholder={t('permissionManagement.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="si-41de0833"
          />
          <button
            onClick={handleResetDefaults}
            disabled={resetting}
            className="si-b9fdedc2"
          >
            {resetting ? t('permissionManagement.resetting') : t('permissionManagement.resetToDefaults')}
          </button>
        </div>
      </div>

      {/* Role Summary */}
      <div className="si-c36935e5">
        <div className="si-3b741829">
          <div className="si-ad9b823b">{enabledCount}</div>
          <div className="si-c3b93ebb">{t('permissionManagement.enabledPermissions')}</div>
        </div>
        <div className="si-3b741829">
          <div className="si-3ceb7b8f">{totalCount - enabledCount}</div>
          <div className="si-c3b93ebb">{t('permissionManagement.disabledPermissions')}</div>
        </div>
        <div className="si-3b741829">
          <div className="si-ad25aaa8">{totalCount}</div>
          <div className="si-c3b93ebb">{t('permissionManagement.totalPermissions')}</div>
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
          <div key={catKey} className="si-5ef1c116">
            {/* Category Header */}
            <div className="si-569a8b5c">
              <div>
                <h3 className="si-44e3b5bb">{category.label}</h3>
                <span className="si-48a0b045">{catEnabledCount}/{filteredPerms.length} enabled</span>
              </div>
              <div className="si-d223efb3">
                <button
                  onClick={() => handleEnableAll(catKey)}
                  disabled={saving === catKey}
                  className="si-136113f8"
                >
                  {t('permissionManagement.enableAll')}
                </button>
                <button
                  onClick={() => handleDisableAll(catKey)}
                  disabled={saving === catKey}
                  className="si-8c7aa0c3"
                >
                  {t('permissionManagement.disableAll')}
                </button>
              </div>
            </div>

            {/* Permission Rows */}
            <div className="si-147db73d">
              {filteredPerms.map(permission => {
                const isEnabled = rolePerms[permission] ?? false
                const isSaving = saving === `${selectedRole}.${permission}`

                return (
                  <div
                    key={permission}
                    className="si-aab105d1"
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div className="si-4904507d">
                        {metadata.labels[permission] || permission}
                      </div>
                      <div className="si-a78c767f">
                        {permission}
                      </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, cursor: isSaving ? 'wait' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggle(selectedRole, permission)}
                        disabled={isSaving}
                        className="si-f3060c35"
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
      <div className="si-d0887729">
        <h3 className="si-2f312154">📊 {t('permissionManagement.roleComparisonMatrix')}</h3>
        <div className="si-9aa6c55f">
          <table className="si-ec76dd85">
            <thead>
              <tr>
                <th className="si-dfddaa19">{t('permissionManagement.permission')}</th>
                {metadata.roles.map(role => (
                  <th key={role} className="si-5e7911ce">
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
                  <td className="si-3e3648be">
                    {metadata.labels[perm] || perm}
                  </td>
                  {metadata.roles.map(role => (
                    <td key={role} className="si-71024195">
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
      </>)}
      
    </div>
  )
}

export default PermissionManagement

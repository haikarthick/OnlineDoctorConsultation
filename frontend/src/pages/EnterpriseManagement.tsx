import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useScrollToForm } from '../hooks/useScrollToForm'
import { Enterprise, ENTERPRISE_TYPE_LABELS, EnterpriseType, EnterpriseStats, EnterpriseMember } from '../types'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../context/MasterDataContext'
import { EnterpriseMapOverview } from '../components/enterprise/EnterpriseMapOverview'
import { EnterpriseCard } from '../components/enterprise/EnterpriseCard'
import { EnterpriseStatsPanel } from '../components/enterprise/EnterpriseStatsPanel'
import { EnterpriseMembersPanel } from '../components/enterprise/EnterpriseMembersPanel'
import { myFarmRole, rolesIMayAssign } from '../utils/farmRoles'
import { InviteMemberModal } from '../components/enterprise/InviteMemberModal'
import { FarmInvitationsPanel } from '../components/enterprise/FarmInvitationsPanel'
import { EnterpriseFormModal, EnterpriseFormData } from '../components/enterprise/EnterpriseFormModal'

import { userMessage } from '../utils/userMessage'
const EMPTY_FORM: EnterpriseFormData = {
  name: '', enterpriseType: '' as EnterpriseType, description: '',
  address: '', city: '', state: '', country: 'US', postalCode: '',
  totalArea: '', areaUnit: 'acres', licenseNumber: '', regulatoryId: '',
  taxId: '', phone: '', email: '', website: '',
  gpsLatitude: '', gpsLongitude: ''
}

const EnterpriseManagement: React.FC = () => {
  const { t } = useTranslation()
  const { speciesLabel } = useMasterData()

  const { user } = useAuth()
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const formRef = useScrollToForm(showForm)
  const [editingEnterprise, setEditingEnterprise] = useState<Enterprise | null>(null)
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null)
  const [stats, setStats] = useState<EnterpriseStats | null>(null)
  const [members, setMembers] = useState<EnterpriseMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitationsKey, setInvitationsKey] = useState(0) // bumped when an invitation is created or answered
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [formData, setFormData] = useState<EnterpriseFormData>(EMPTY_FORM)
  const [showMapOverview, setShowMapOverview] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const isAdmin = user?.role === 'admin'
  const actorRole = myFarmRole(selectedEnterprise, members, user?.id, isAdmin)

  const fetchEnterprises = async () => {
    try {
      setLoading(true)
      const res = await apiService.listEnterprises({ limit: 100 })
      setEnterprises(res.data?.items || [])
    } catch { setEnterprises([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchEnterprises() }, [])

  const fetchStats = async (id: string) => {
    try {
      const res = await apiService.getEnterpriseStats(id)
      setStats(res.data)
    } catch { setStats(null) }
  }

  const fetchMembers = async (id: string) => {
    try {
      setMembersLoading(true)
      const res = await apiService.listEnterpriseMembers(id)
      setMembers(res.data || [])
    } catch { setMembers([]) }
    finally { setMembersLoading(false) }
  }

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!selectedEnterprise) return
    setUpdatingMemberId(userId)
    try {
      await apiService.updateEnterpriseMember(selectedEnterprise.id, userId, { role: newRole })
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole as EnterpriseMember['role'] } : m))
      setSuccessMsg(t('farmTeam.roleChanged'))
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(userMessage(err))
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleTransfer = async (userId: string) => {
    if (!selectedEnterprise) return
    const who = members.find(m => m.userId === userId)
    const name = who?.userName || who?.userPhone || who?.userEmail || ''
    if (!window.confirm(t('farmTeam.makeOwnerConfirm', { farm: selectedEnterprise.name, name }))) return
    try {
      await apiService.transferFarmOwnership(selectedEnterprise.id, userId)
      setSuccessMsg(t('farmTeam.handedOver', { farm: selectedEnterprise.name, name }))
      await fetchEnterprises()
      setSelectedEnterprise(null)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      setError(userMessage(err))
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedEnterprise) return
    const who = members.find(m => m.userId === userId)
    if (!window.confirm(t('farmTeam.removeConfirm', { name: who?.userName || who?.userPhone || who?.userEmail || '' }))) return
    try {
      await apiService.removeEnterpriseMember(selectedEnterprise.id, userId)
      setMembers(prev => prev.filter(m => m.userId !== userId))
      setSuccessMsg(t('farmTeam.removed'))
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(userMessage(err))
    }
  }

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingEnterprise(null)
    setError('')
  }

  const openEdit = (ent: Enterprise) => {
    setEditingEnterprise(ent)
    setFormData({
      name: ent.name, enterpriseType: ent.enterpriseType, description: ent.description || '',
      address: ent.address || '', city: ent.city || '', state: ent.state || '',
      country: ent.country || 'US', postalCode: ent.postalCode || '',
      totalArea: ent.totalArea?.toString() || '', areaUnit: ent.areaUnit || 'acres',
      licenseNumber: ent.licenseNumber || '', regulatoryId: ent.regulatoryId || '',
      taxId: ent.taxId || '', phone: ent.phone || '', email: ent.email || '', website: ent.website || '',
      gpsLatitude: ent.gpsLatitude?.toString() || '', gpsLongitude: ent.gpsLongitude?.toString() || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.name || !formData.enterpriseType) {
      setError('Name and enterprise type are required')
      return
    }
    try {
      const payload: any = {
        ...formData,
        totalArea: formData.totalArea ? parseFloat(formData.totalArea) : undefined,
        gpsLatitude: formData.gpsLatitude ? parseFloat(formData.gpsLatitude) : undefined,
        gpsLongitude: formData.gpsLongitude ? parseFloat(formData.gpsLongitude) : undefined,
      }
      if (editingEnterprise) {
        await apiService.updateEnterprise(editingEnterprise.id, payload)
        setSuccessMsg('Enterprise updated successfully')
      } else {
        await apiService.createEnterprise(payload)
        setSuccessMsg('Enterprise created successfully')
      }
      resetForm()
      setShowForm(false)
      fetchEnterprises()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(userMessage(err, 'common.failedToSave'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('enterpriseManagement.deactivateConfirm'))) return
    try {
      await apiService.deleteEnterprise(id)
      setSuccessMsg(t('enterpriseManagement.deactivated'))
      fetchEnterprises()
      if (selectedEnterprise?.id === id) setSelectedEnterprise(null)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(userMessage(err, 'common.failedToDelete'))
    }
  }

  const selectEnterprise = (ent: Enterprise) => {
    setSelectedEnterprise(ent)
    fetchStats(ent.id)
    fetchMembers(ent.id)
  }

  const filtered = enterprises.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ENTERPRISE_TYPE_LABELS[e.enterpriseType] || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('enterpriseManagement.pageTitle')}</h1>
          <p className="subtitle">{t('enterpriseManagement.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className={`btn ${showMapOverview ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowMapOverview(!showMapOverview)}>
            🗺️ {showMapOverview ? 'Hide Map' : 'Map View'}
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
            + New Enterprise
          </button>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && !showForm && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <div className="filters-bar">
        <input
          type="text" placeholder={t('enterpriseManagement.searchPlaceholder')} className="search-input"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {showMapOverview && (
        <EnterpriseMapOverview enterprises={enterprises} selectedEnterprise={selectedEnterprise} />
      )}

      <div className="si-dcfaac94">
        {/* Enterprise List */}
        <div className="si-03587c55">
          {loading ? (
            <div className="loading-spinner">{t('enterpriseManagement.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>{t('enterpriseManagement.emptyTitle')}</h3>
              <p>{t('enterpriseManagement.emptySubtitle')}</p>
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
                + Create Enterprise
              </button>
            </div>
          ) : (
            <div className="cards-grid si-243e7be2">
              {filtered.map(ent => (
                <EnterpriseCard
                  key={ent.id}
                  ent={ent}
                  isSelected={selectedEnterprise?.id === ent.id}
                  canManage={isAdmin || ent.ownerId === user?.id}
                  editLabel={t('common.edit')}
                  deleteLabel={t('common.delete')}
                  onSelect={selectEnterprise}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats Panel */}
        {selectedEnterprise && stats && (
          <EnterpriseStatsPanel enterprise={selectedEnterprise} stats={stats} speciesLabel={speciesLabel} t={t} />
        )}

        {/* Members Panel */}
        {selectedEnterprise && (
          <EnterpriseMembersPanel
            members={members}
            membersLoading={membersLoading}
            actorRole={actorRole}
            updatingMemberId={updatingMemberId}
            membersLabel={t('enterpriseManagement.tabs.members')}
            onInviteClick={() => setShowInviteModal(true)}
            onUpdateRole={handleUpdateMemberRole}
            onRemoveMember={handleRemoveMember}
            onTransfer={handleTransfer}
          />
        )}
        {selectedEnterprise && (
          <FarmInvitationsPanel
            enterpriseId={selectedEnterprise.id}
            actorRole={actorRole}
            refreshKey={invitationsKey}
            onChanged={() => fetchMembers(selectedEnterprise.id)}
          />
        )}
      </div>

      {showInviteModal && selectedEnterprise && (
        <InviteMemberModal
          enterpriseId={selectedEnterprise.id}
          roles={rolesIMayAssign(actorRole)}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => setInvitationsKey(k => k + 1)}
        />
      )}

      {showForm && (
        <EnterpriseFormModal
          formRef={formRef}
          editingEnterprise={editingEnterprise}
          formData={formData}
          error={error}
          t={t}
          onChange={updater => setFormData(updater)}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); resetForm() }}
        />
      )}
    </div>
  )
}

export default EnterpriseManagement

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../../styles/modules.css'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import type { User, PendingUser, VetProfileData } from '../../components/userManagement/userManagementShared'
import { EMPTY_VET_FORM } from '../../components/userManagement/userManagementShared'
import PendingApprovalsTab from '../../components/userManagement/PendingApprovalsTab'
import RejectRegistrationModal from '../../components/userManagement/RejectRegistrationModal'
import RoleChangeRequestsTab from '../../components/userManagement/RoleChangeRequestsTab'
import UsersSearchAndTable from '../../components/userManagement/UsersSearchAndTable'
import RoleChangeModal from '../../components/userManagement/RoleChangeModal'
import VetProfileModal from '../../components/userManagement/VetProfileModal'
import SecondaryRolesModal from '../../components/userManagement/SecondaryRolesModal'
import FreezeAccountModal from '../../components/userManagement/FreezeAccountModal'
import SuspendAccountModal from '../../components/userManagement/SuspendAccountModal'
import ResetPasswordModal from '../../components/userManagement/ResetPasswordModal'

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
  // Vet details when an admin assigns the veterinarian role directly - supplying a license
  // marks the provisioned vet_profiles row verified; leaving it blank still makes the vet
  // visible/bookable (unverified) so they never silently disappear from Find Doctor.
  const [roleVetLicense, setRoleVetLicense] = useState('')
  const [roleVetFee, setRoleVetFee] = useState('')

  // Vet Profile Modal
  const [showVetModal, setShowVetModal] = useState<User | null>(null)
  const [vetForm, setVetForm] = useState<VetProfileData>(EMPTY_VET_FORM)
  const [vetLoading, setVetLoading] = useState(false)
  const [vetSaving, setVetSaving] = useState(false)
  const [vetSaved, setVetSaved] = useState(false)

  // Pending approvals tab
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingMsg, setPendingMsg] = useState('')

  // Freeze / suspend modals
  const [showFreezeModal, setShowFreezeModal] = useState<User | null>(null)
  const [showSuspendModal, setShowSuspendModal] = useState<User | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [showRejectRegistrationModal, setShowRejectRegistrationModal] = useState<PendingUser | null>(null)
  const [rejectRegistrationReason, setRejectRegistrationReason] = useState('')

  // Role Change Requests tab
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'requests'>('users')
  const [roleRequests, setRoleRequests] = useState<any[]>([])
  const [requestsFilter, setRequestsFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [requestProcessing, setRequestProcessing] = useState<string | null>(null)
  const [requestMsg, setRequestMsg] = useState('')
  const [actionError, setActionError] = useState('')

  // Secondary roles modal (P4-HIGH1)
  const [showSecondaryRolesModal, setShowSecondaryRolesModal] = useState<User | null>(null)
  const [secondaryRoles, setSecondaryRoles] = useState<any[]>([])
  const [secondaryRolesLoading, setSecondaryRolesLoading] = useState(false)
  const [addRoleValue, setAddRoleValue] = useState('')

  // Reset password modal (C7)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<User | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false)
  const [resetPasswordMsg, setResetPasswordMsg] = useState('')
  const [addRoleNotes, setAddRoleNotes] = useState('')
  const [rolesActionMsg, setRolesActionMsg] = useState('')
  const [rolesActionErr, setRolesActionErr] = useState('')

  useEffect(() => {
    loadUsers()
  }, [search, roleFilter])

  useEffect(() => {
    if (activeTab === 'requests') loadRoleRequests()
    if (activeTab === 'pending') loadPendingUsers()
  }, [activeTab, requestsFilter])

  const loadPendingUsers = async () => {
    try {
      setPendingLoading(true)
      setPendingMsg('')
      const result = await apiService.adminListPendingUsers()
      setPendingUsers(result.data || [])
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to load pending registrations')
    } finally {
      setPendingLoading(false)
    }
  }

  const handleApproveRegistration = async (userId: string) => {
    try {
      setProcessing(userId)
      await apiService.adminApproveUser(userId)
      setPendingMsg('Account approved and user notified.')
      loadPendingUsers()
      loadUsers()
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to approve user')
    } finally {
      setProcessing(null)
    }
  }

  const handleRejectRegistration = async () => {
    if (!showRejectRegistrationModal || !rejectRegistrationReason.trim()) return
    try {
      setProcessing(showRejectRegistrationModal.id)
      await apiService.adminRejectUser(showRejectRegistrationModal.id, rejectRegistrationReason)
      setPendingMsg('Registration rejected and user notified.')
      setShowRejectRegistrationModal(null)
      setRejectRegistrationReason('')
      loadPendingUsers()
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to reject user')
    } finally {
      setProcessing(null)
    }
  }

  const handleFreezeUser = async () => {
    if (!showFreezeModal || !actionReason.trim()) return
    try {
      setProcessing(showFreezeModal.id)
      await apiService.adminFreezeUser(showFreezeModal.id, actionReason)
      setUsers(prev => prev.map(u => u.id === showFreezeModal.id ? { ...u, accountStatus: 'frozen', isActive: false, freezeReason: actionReason } : u))
      setShowFreezeModal(null)
      setActionReason('')
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to freeze account')
    } finally {
      setProcessing(null)
    }
  }

  const handleUnfreezeUser = async (u: User) => {
    try {
      setProcessing(u.id)
      await apiService.adminUnfreezeUser(u.id)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, accountStatus: 'active', isActive: true, freezeReason: undefined } : x))
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to unfreeze account')
    } finally {
      setProcessing(null)
    }
  }

  const handleSuspendUser = async () => {
    if (!showSuspendModal || !actionReason.trim()) return
    try {
      setProcessing(showSuspendModal.id)
      await apiService.adminSuspendUser(showSuspendModal.id, actionReason)
      setUsers(prev => prev.map(u => u.id === showSuspendModal.id ? { ...u, accountStatus: 'suspended', isActive: false } : u))
      setShowSuspendModal(null)
      setActionReason('')
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to suspend account')
    } finally {
      setProcessing(null)
    }
  }

  const handleReactivateUser = async (u: User) => {
    try {
      setProcessing(u.id)
      await apiService.adminReactivateUser(u.id)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, accountStatus: 'active', isActive: true } : x))
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to reactivate account')
    } finally {
      setProcessing(null)
    }
  }

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
  useAutoRefresh('users', loadUsers)

  const handleChangeRole = async () => {
    if (!showRoleModal || !newRole) return
    try {
      setProcessing(showRoleModal.id)
      const vetProfile = newRole === 'veterinarian'
        ? {
            licenseNumber: roleVetLicense.trim() || undefined,
            consultationFee: roleVetFee ? Number(roleVetFee) : undefined,
          }
        : undefined
      await apiService.adminChangeUserRole(showRoleModal.id, newRole, vetProfile)
      setUsers(users.map(u => u.id === showRoleModal.id ? { ...u, role: newRole } : u))
      setShowRoleModal(null)
      setRoleVetLicense(''); setRoleVetFee('')
    } catch (err: any) {
      console.error('Failed to change role:', err?.message)
      setActionError(err?.response?.data?.message || err?.message || 'Failed to change user role')
    } finally {
      setProcessing(null)
    }
  }

  // P4-HIGH1: Secondary roles management
  const openSecondaryRoles = async (u: User) => {
    setShowSecondaryRolesModal(u)
    setSecondaryRoles([])
    setRolesActionMsg('')
    setRolesActionErr('')
    setAddRoleValue('')
    setAddRoleNotes('')
    setSecondaryRolesLoading(true)
    try {
      const result = await apiService.getUserRoles(u.id)
      setSecondaryRoles(result.data || [])
    } catch (err: any) {
      setRolesActionErr(err?.response?.data?.error || err?.message || 'Failed to load roles')
    } finally {
      setSecondaryRolesLoading(false)
    }
  }

  const handleAddSecondaryRole = async () => {
    if (!showSecondaryRolesModal || !addRoleValue) return
    try {
      await apiService.addUserRole(showSecondaryRolesModal.id, addRoleValue, addRoleNotes || undefined)
      setRolesActionMsg(t('userManagement.roleGranted'))
      setAddRoleValue('')
      setAddRoleNotes('')
      const result = await apiService.getUserRoles(showSecondaryRolesModal.id)
      setSecondaryRoles(result.data || [])
    } catch (err: any) {
      setRolesActionErr(err?.response?.data?.error || err?.message || 'Failed to add role')
    }
  }

  const handleRemoveSecondaryRole = async (role: string) => {
    if (!showSecondaryRolesModal) return
    try {
      await apiService.removeUserRole(showSecondaryRolesModal.id, role)
      setRolesActionMsg(t('userManagement.roleRemoved'))
      const result = await apiService.getUserRoles(showSecondaryRolesModal.id)
      setSecondaryRoles(result.data || [])
    } catch (err: any) {
      setRolesActionErr(err?.response?.data?.error || err?.message || 'Failed to remove role')
    }
  }

  const handleResetPassword = async () => {
    if (!showResetPasswordModal || !resetPasswordValue) return
    if (resetPasswordValue.length < 8) {
      setActionError(t('userManagement.resetPasswordMin'))
      return
    }
    try {
      setResetPasswordSaving(true)
      setActionError('')
      await apiService.adminResetUserPassword(showResetPasswordModal.id, resetPasswordValue)
      setResetPasswordMsg(t('userManagement.resetPasswordSuccess'))
      setResetPasswordValue('')
      setTimeout(() => {
        setShowResetPasswordModal(null)
        setResetPasswordMsg('')
      }, 2000)
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to reset password')
    } finally {
      setResetPasswordSaving(false)
    }
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
      // No vet profile - form stays empty
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
        <div className="module-alert error si-101fd1d0">
          <span>⚠️ {actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="si-2188ebb7">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="module-tabs si-af65fe13">
        <button className={`module-tab${activeTab === 'users' ? ' active' : ''}`} onClick={() => setActiveTab('users')}>
          👥 Users
        </button>
        <button className={`module-tab${activeTab === 'pending' ? ' active' : ''}`} onClick={() => setActiveTab('pending')}>
          ⏳ Pending Approvals
        </button>
        <button className={`module-tab${activeTab === 'requests' ? ' active' : ''}`} onClick={() => setActiveTab('requests')}>
          🔄 {t('adminRoleRequests.title')}
        </button>
      </div>

      {/* ── Pending Approvals Tab ── */}
      {activeTab === 'pending' && (
        <PendingApprovalsTab
          pendingUsers={pendingUsers}
          pendingLoading={pendingLoading}
          pendingMsg={pendingMsg}
          processing={processing}
          onApprove={handleApproveRegistration}
          setShowRejectRegistrationModal={setShowRejectRegistrationModal}
          setRejectRegistrationReason={setRejectRegistrationReason}
        />
      )}

      <RejectRegistrationModal
        showRejectRegistrationModal={showRejectRegistrationModal}
        setShowRejectRegistrationModal={setShowRejectRegistrationModal}
        rejectRegistrationReason={rejectRegistrationReason}
        setRejectRegistrationReason={setRejectRegistrationReason}
        onRejectConfirm={handleRejectRegistration}
        processing={processing}
      />

      {/* ── Role Change Requests Tab ── */}
      {activeTab === 'requests' && (
        <RoleChangeRequestsTab
          roleRequests={roleRequests}
          requestsLoading={requestsLoading}
          requestMsg={requestMsg}
          requestsFilter={requestsFilter}
          setRequestsFilter={setRequestsFilter}
          requestProcessing={requestProcessing}
          onApprove={handleApproveRequest}
          showRejectModal={showRejectModal}
          setShowRejectModal={setShowRejectModal}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          onRejectConfirm={handleRejectRequest}
        />
      )}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (<>
        <UsersSearchAndTable
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          loading={loading}
          users={users}
          processing={processing}
          formatDate={formatDate}
          onOpenRoleModal={(u) => { setShowRoleModal(u); setNewRole(''); setRoleVetLicense(''); setRoleVetFee('') }}
          onOpenVetProfile={openVetProfile}
          onOpenSecondaryRoles={openSecondaryRoles}
          onOpenResetPassword={(u) => { setShowResetPasswordModal(u); setResetPasswordValue(''); setResetPasswordMsg('') }}
          onApproveRegistration={handleApproveRegistration}
          onOpenRejectRegistration={(u) => { setShowRejectRegistrationModal(u as any); setRejectRegistrationReason('') }}
          onUnfreeze={handleUnfreezeUser}
          onReactivate={handleReactivateUser}
          onOpenFreeze={(u) => { setShowFreezeModal(u); setActionReason('') }}
          onOpenSuspend={(u) => { setShowSuspendModal(u); setActionReason('') }}
        />

        <RoleChangeModal
          showRoleModal={showRoleModal}
          setShowRoleModal={setShowRoleModal}
          newRole={newRole}
          setNewRole={setNewRole}
          roleVetLicense={roleVetLicense}
          setRoleVetLicense={setRoleVetLicense}
          roleVetFee={roleVetFee}
          setRoleVetFee={setRoleVetFee}
          processing={processing}
          onConfirm={handleChangeRole}
        />

        <VetProfileModal
          showVetModal={showVetModal}
          setShowVetModal={setShowVetModal}
          vetLoading={vetLoading}
          vetForm={vetForm}
          onFormChange={handleVetFormChange}
          vetSaving={vetSaving}
          vetSaved={vetSaved}
          onSave={handleSaveVetProfile}
          formatCurrency={formatCurrency}
        />

        <SecondaryRolesModal
          showSecondaryRolesModal={showSecondaryRolesModal}
          setShowSecondaryRolesModal={setShowSecondaryRolesModal}
          rolesActionMsg={rolesActionMsg}
          rolesActionErr={rolesActionErr}
          setRolesActionErr={setRolesActionErr}
          secondaryRolesLoading={secondaryRolesLoading}
          secondaryRoles={secondaryRoles}
          addRoleValue={addRoleValue}
          setAddRoleValue={setAddRoleValue}
          addRoleNotes={addRoleNotes}
          setAddRoleNotes={setAddRoleNotes}
          onAddRole={handleAddSecondaryRole}
          onRemoveRole={handleRemoveSecondaryRole}
        />

        <FreezeAccountModal
          showFreezeModal={showFreezeModal}
          setShowFreezeModal={setShowFreezeModal}
          actionReason={actionReason}
          setActionReason={setActionReason}
          processing={processing}
          onConfirm={handleFreezeUser}
        />

        <SuspendAccountModal
          showSuspendModal={showSuspendModal}
          setShowSuspendModal={setShowSuspendModal}
          actionReason={actionReason}
          setActionReason={setActionReason}
          processing={processing}
          onConfirm={handleSuspendUser}
        />

        <ResetPasswordModal
          showResetPasswordModal={showResetPasswordModal}
          setShowResetPasswordModal={setShowResetPasswordModal}
          resetPasswordMsg={resetPasswordMsg}
          resetPasswordValue={resetPasswordValue}
          setResetPasswordValue={setResetPasswordValue}
          resetPasswordSaving={resetPasswordSaving}
          onConfirm={handleResetPassword}
        />
      </>)}
    </div>
  )
}

export default UserManagement

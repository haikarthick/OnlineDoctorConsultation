import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import apiService from '../../services/api'
import NetworkRoleMatrix from './NetworkRoleMatrix'
import '../ModulePage.css'
import './HospitalNetworks.css'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

import {
  HospitalNetwork, NetworkMember, NetworkDashboard, NetworkHospital,
  AuditEntry, AuditStats, PatientSearchResult, EnrollmentRecord, WalkInInviteForm,
} from '../../components/hospitalNetwork/hospitalNetworksShared'
import NetworkModal from '../../components/hospitalNetwork/NetworkModal'
import CreateBranchHospitalModal from '../../components/hospitalNetwork/CreateBranchHospitalModal'
import EditBranchHospitalModal from '../../components/hospitalNetwork/EditBranchHospitalModal'
import DeleteBranchConfirmModal from '../../components/hospitalNetwork/DeleteBranchConfirmModal'
import AddMemberModal from '../../components/hospitalNetwork/AddMemberModal'
import EditMemberModal from '../../components/hospitalNetwork/EditMemberModal'
import InviteStaffModal from '../../components/hospitalNetwork/InviteStaffModal'
import WalkInInviteModal from '../../components/hospitalNetwork/WalkInInviteModal'
import WalkInRegisterModal from '../../components/hospitalNetwork/WalkInRegisterModal'
import OnboardingChecklistModal from '../../components/hospitalNetwork/OnboardingChecklistModal'
import ComplianceExportModal from '../../components/hospitalNetwork/ComplianceExportModal'
import ApprovalActionModal, { ApprovalActionKind } from '../../components/hospitalNetwork/ApprovalActionModal'
import NetworksListTab from '../../components/hospitalNetwork/NetworksListTab'
import NetworkDetailTab from '../../components/hospitalNetwork/NetworkDetailTab'
import AuditTab from '../../components/hospitalNetwork/AuditTab'
import PatientsTab from '../../components/hospitalNetwork/PatientsTab'
import ReferralsTab from '../../components/hospitalNetwork/ReferralsTab'
import LeaveManagementTab from '../../components/hospitalNetwork/LeaveManagementTab'
import AnalyticsTab from '../../components/hospitalNetwork/AnalyticsTab'

// ─── Main Component ───────────────────────────────────────────────────────────
const HospitalNetworks: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { speciesLabel } = useMasterData()

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
  const [showApprovalModal, setShowApprovalModal] = useState<ApprovalActionKind | null>(null)
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
  const [editMemberForm, setEditMemberForm] = useState({ networkRole: '', hospitalId: '', department: '' })
  const [editMemberLoading, setEditMemberLoading] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [showInviteStaff, setShowInviteStaff] = useState(false)
  const [inviteStaffForm, setInviteStaffForm] = useState({ email: '', name: '', position: 'receptionist', hospitalId: '' })
  const [inviteStaffLoading, setInviteStaffLoading] = useState(false)
  const [inviteStaffSuccess, setInviteStaffSuccess] = useState('')
  const [inviteStaffError, setInviteStaffError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [customNetworkRoles, setCustomNetworkRoles] = useState<{ role_key: string; display_name: string }[]>([])

  // ─── Audit State ──────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  // Network configuration change trail (distinct from the record-access trail)
  const [securityAudit, setSecurityAudit] = useState<any[]>([])
  const [securityAuditLoading, setSecurityAuditLoading] = useState(false)
  const [securityAuditError, setSecurityAuditError] = useState('')
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

  // Onboarding checklist state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingNetwork, setOnboardingNetwork] = useState<HospitalNetwork | null>(null)

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
  useAutoRefresh(['hospital-networks', 'patients'], loadNetworks)

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
      // Load pending invites and custom roles (non-fatal)
      apiService.listStaffInvites(network.id).then((res: any) => {
        setPendingInvites(res.data ?? res ?? [])
      }).catch(() => setPendingInvites([]))
      apiService.getNetworkRoles(network.id).then((res: any) => {
        const roles = res.data ?? res ?? []
        setCustomNetworkRoles(Array.isArray(roles) ? roles.filter((r: any) => r.is_active !== false) : [])
      }).catch(() => setCustomNetworkRoles([]))
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

  // Configuration change trail. Requires the viewAuditLogs network action, so a
  // 403/404 here is expected for roles without it - surfaced, not swallowed.
  useEffect(() => {
    if (activeTab !== 'audit' || !selectedNetwork) return
    let cancelled = false
    setSecurityAuditLoading(true)
    setSecurityAuditError('')
    apiService.getNetworkSecurityAudit(selectedNetwork.id, { limit: 50 })
      .then(res => { if (!cancelled) setSecurityAudit(Array.isArray(res.data) ? res.data : []) })
      .catch((e: any) => {
        if (cancelled) return
        setSecurityAudit([])
        setSecurityAuditError(
          e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to load'
        )
      })
      .finally(() => { if (!cancelled) setSecurityAuditLoading(false) })
    return () => { cancelled = true }
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

  const loadLeaveRequests = async () => {
    if (!selectedNetwork) return
    try {
      const res = await apiService.listLeaveRequests(selectedNetwork.id)
      setLeaveRequests(res.data?.data?.rows || res.data?.rows || res.data?.data || [])
    } catch (err: any) {
      console.error('Failed to load leave requests:', err?.message)
    }
  }

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

  useEffect(() => {
    if (activeTab === 'referrals') loadReferrals(referralDirection)
    if (activeTab === 'leave') loadLeaveRequests()
    if (activeTab === 'analytics' && selectedNetwork) loadAnalytics(selectedNetwork.id)
  }, [activeTab, selectedNetwork, referralDirection]) // eslint-disable-line react-hooks/exhaustive-deps

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
      (apiService as any).client
        .get(`/hospital-networks/${selectedNetwork.id}/hospitals`)
        .then((res: any) => setReferralNetworkHospitals(res.data?.hospitals || res.data || []))
        .catch(() => setReferralError(t('networkReferrals.hospitalsLoadFailed')))
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
    const isNew = !editingNetwork
    setShowCreateModal(false)
    setEditingNetwork(null)
    setSuccessMsg(`Network "${network.name}" saved.`)
    await loadNetworks()
    if (isNew) {
      setOnboardingNetwork(network)
      setShowOnboarding(true)
    }
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
    setEditMemberForm({ networkRole: member.networkRole, hospitalId: member.hospitalId || '', department: (member as any).department || '' })
    if (selectedNetwork) {
      (apiService as any).get(`/hospital-networks/${selectedNetwork.id}/departments`)
        .then((res: any) => setDepartments(res.data?.data || []))
        .catch(() => setDepartments([]))
    }
  }

  const handleUpdateMember = async () => {
    if (!selectedNetwork || !editingMember) return
    setEditMemberLoading(true)
    try {
      await apiService.updateNetworkMember(selectedNetwork.id, editingMember.userId, {
        networkRole: editMemberForm.networkRole,
        hospitalId: editMemberForm.hospitalId || undefined,
        department: editMemberForm.department || undefined,
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

  const handleSendStaffInvite = async () => {
    if (!selectedNetwork) return
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
        // Refresh pending invites list
        apiService.listStaffInvites(selectedNetwork.id).then((r: any) => setPendingInvites(r.data ?? r ?? [])).catch(() => {})
      } else {
        setInviteStaffError(res.message || res.error || 'Failed to send invite')
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to send invite'
      setInviteStaffError(
        e.response?.status === 409
          ? (errMsg.includes('already a member') ? 'This email is already a member of this network.' : 'A pending invitation already exists for this email. Check the pending invites list below.')
          : errMsg
      )
    } finally {
      setInviteStaffLoading(false)
    }
  }

  const handleCloseInviteStaffModal = () => {
    setShowInviteStaff(false); setInviteStaffSuccess(''); setInviteStaffError(''); setInviteLink('')
  }

  const handleCopyInviteLink = (inv: any) => {
    const token = inv.inviteToken ?? inv.invite_token
    const link = `${window.location.origin}/accept-staff-invite?token=${token}`
    navigator.clipboard.writeText(link)
    alert(t('hospitalNetworks.detail.inviteLinkCopied'))
  }

  const handleRevokeInvite = async (inv: any) => {
    if (!selectedNetwork) return
    if (!window.confirm(t('hospitalNetworks.detail.revokeConfirm'))) return
    try {
      await apiService.revokeStaffInvite(selectedNetwork.id, inv.id)
      setPendingInvites(prev => prev.filter(i => i.id !== inv.id))
    } catch {
      alert(t('hospitalNetworks.detail.revokeFailed'))
    }
  }

  const handleDeleteBranch = async () => {
    if (!selectedNetwork || !deletingBranch) return
    try {
      await apiService.deleteBranchHospital(selectedNetwork.id, deletingBranch.id)
      setSuccessMsg('Branch hospital removed.')
      setDeletingBranch(null)
      loadDetail(selectedNetwork)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove hospital')
      setDeletingBranch(null)
    }
  }

  const handleCreateLeaveRequest = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    if (!selectedNetwork) return
    const fd = new FormData(ev.currentTarget)
    try {
      await apiService.createLeaveRequest(selectedNetwork.id, {
        leave_type: fd.get('leave_type'),
        start_date: fd.get('start_date'),
        end_date: fd.get('end_date'),
        reason: fd.get('reason'),
      })
      setShowLeaveModal(false)
      loadLeaveRequests()
    } catch (err: any) { console.error(err) }
  }

  const handleApproveLeave = async (lr: any) => {
    if (!selectedNetwork) return
    try {
      await apiService.updateLeaveRequest(selectedNetwork.id, lr.id, { status: 'approved' })
      loadLeaveRequests()
    } catch (err: any) { console.error(err) }
  }

  const handleRejectLeave = async (lr: any) => {
    if (!selectedNetwork) return
    try {
      await apiService.updateLeaveRequest(selectedNetwork.id, lr.id, { status: 'rejected', rejectionReason: 'Declined by admin' })
      loadLeaveRequests()
    } catch (err: any) { console.error(err) }
  }

  const handleCompleteTransfer = async (transfer: any) => {
    if (!selectedNetwork) return
    try {
      await apiService.completePatientTransfer(selectedNetwork.id, transfer.id)
      loadTransfers()
    } catch (err: any) { console.error(err) }
  }

  const filteredNetworks = networks.filter(n => {
    const matchesSearch = !searchTerm || n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.headquartersCity ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'approved' && n.isApproved) ||
      (statusFilter === 'pending' && !n.isApproved)
    return matchesSearch && matchesStatus
  })

  const userNetworkRole = networkMembers.find(m => m.userId === user?.id)?.networkRole

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
          {activeTab === 'networks' && (user?.role === 'admin' || user?.role === 'corporate_admin') && (
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
            <span className="si-e04dd9c4">
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

      {activeTab === 'networks' && (
        <NetworksListTab
          networks={networks}
          filteredNetworks={filteredNetworks}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          approveState={approveState}
          userRole={user?.role}
          formatDate={formatDate}
          onView={handleView}
          onEdit={setEditingNetwork}
          onApproveClick={handleApproveClick}
          onApproveConfirm={handleApproveConfirm}
          onApproveCancel={(networkId) => setApproveState(s => ({ ...s, [networkId]: 'idle' }))}
          t={t}
        />
      )}

      {activeTab === 'detail' && (
        <NetworkDetailTab
          selectedNetwork={selectedNetwork}
          detailLoading={detailLoading}
          dashboard={dashboard}
          financialData={financialData}
          networkHospitals={networkHospitals}
          networkMembers={networkMembers}
          pendingInvites={pendingInvites}
          approvalLoading={approvalLoading}
          approvalHistory={approvalHistory}
          brandingForm={brandingForm}
          setBrandingForm={setBrandingForm}
          brandingSaving={brandingSaving}
          brandingSaved={brandingSaved}
          showBrandingPanel={showBrandingPanel}
          setShowBrandingPanel={setShowBrandingPanel}
          userNetworkRole={userNetworkRole}
          userRole={user?.role}
          formatDate={formatDate}
          onEditNetwork={() => selectedNetwork && setEditingNetwork(selectedNetwork)}
          onDeactivateNetwork={handleDeactivateNetwork}
          onAddBranch={() => setShowCreateBranch(true)}
          onEditBranch={setEditingBranch}
          onDeleteBranch={setDeletingBranch}
          onApprovalRequestInfo={() => setShowApprovalModal('info_requested')}
          onApprovalApprove={() => setShowApprovalModal('approved')}
          onApprovalReject={() => setShowApprovalModal('rejected')}
          onApprovalSuspend={() => setShowApprovalModal('suspended')}
          onBrandingSave={handleBrandingSubmit}
          onInviteStaff={() => { setShowInviteStaff(true); setInviteStaffError('') }}
          onAddMember={() => setShowAddMember(true)}
          onEditMember={handleEditMember}
          onRemoveMember={handleRemoveMember}
          onCopyInviteLink={handleCopyInviteLink}
          onRevokeInvite={handleRevokeInvite}
          t={t}
        />
      )}

      {activeTab === 'audit' && (
        <AuditTab
          hasSelectedNetwork={!!selectedNetwork}
          onGoToNetworks={() => setActiveTab('networks')}
          auditStats={auditStats}
          auditRecordTypeFilter={auditRecordTypeFilter}
          setAuditRecordTypeFilter={(v) => { setAuditRecordTypeFilter(v); setAuditPage(1) }}
          auditGrantedFilter={auditGrantedFilter}
          setAuditGrantedFilter={(v) => { setAuditGrantedFilter(v); setAuditPage(1) }}
          auditSearch={auditSearch}
          setAuditSearch={setAuditSearch}
          onExportCsv={exportAuditCsv}
          onOpenComplianceModal={() => setShowComplianceModal(true)}
          auditLoading={auditLoading}
          filteredAuditLogs={filteredAuditLogs}
          formatDate={formatDate}
          auditTotal={auditTotal}
          auditPage={auditPage}
          setAuditPage={setAuditPage}
          securityAuditLoading={securityAuditLoading}
          securityAuditError={securityAuditError}
          securityAudit={securityAudit}
          t={t}
        />
      )}

      {activeTab === 'patients' && (
        <PatientsTab
          hasSelectedNetwork={!!selectedNetwork}
          patientSearch={patientSearch}
          setPatientSearch={setPatientSearch}
          patientSearchLoading={patientSearchLoading}
          patientResults={patientResults}
          enrollmentSuccessIds={enrollmentSuccessIds}
          requestingEnrollment={requestingEnrollment}
          onRequestEnrollment={handleRequestEnrollment}
          onRegisterWalkIn={() => setShowWalkInRegModal(true)}
          onInviteOnline={() => setShowInviteModal(true)}
          allEnrollments={allEnrollments}
          enrollmentsLoading={enrollmentsLoading}
          enrollmentFilter={enrollmentFilter}
          setEnrollmentFilter={setEnrollmentFilter}
          formatDate={formatDate}
          speciesLabel={speciesLabel}
          t={t}
        />
      )}

      {(showCreateModal || editingNetwork) && (
        <NetworkModal
          editing={editingNetwork}
          onClose={() => { setShowCreateModal(false); setEditingNetwork(null) }}
          onSaved={handleNetworkSaved}
          t={t}
        />
      )}

      {showOnboarding && onboardingNetwork && (
        <OnboardingChecklistModal
          onboardingNetwork={onboardingNetwork}
          onClose={() => setShowOnboarding(false)}
          onDismiss={(network) => {
            setShowOnboarding(false)
            handleView(network)
            setActiveTab('detail')
          }}
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
        <DeleteBranchConfirmModal
          deletingBranch={deletingBranch}
          onClose={() => setDeletingBranch(null)}
          onConfirm={handleDeleteBranch}
          t={t}
        />
      )}

      {editingMember && selectedNetwork && (
        <EditMemberModal
          editingMember={editingMember}
          editMemberForm={editMemberForm}
          setEditMemberForm={setEditMemberForm}
          editMemberLoading={editMemberLoading}
          networkHospitals={networkHospitals}
          departments={departments}
          onClose={() => setEditingMember(null)}
          onSave={handleUpdateMember}
          t={t}
        />
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

      {showInviteStaff && selectedNetwork && (
        <InviteStaffModal
          networkHospitals={networkHospitals}
          customNetworkRoles={customNetworkRoles}
          inviteStaffForm={inviteStaffForm}
          setInviteStaffForm={setInviteStaffForm}
          inviteStaffLoading={inviteStaffLoading}
          inviteStaffSuccess={inviteStaffSuccess}
          inviteStaffError={inviteStaffError}
          inviteLink={inviteLink}
          onClose={handleCloseInviteStaffModal}
          onSendInvite={handleSendStaffInvite}
          t={t}
        />
      )}

      {showInviteModal && selectedNetwork && (
        <WalkInInviteModal
          inviteForm={inviteForm}
          setInviteForm={setInviteForm}
          inviteLoading={inviteLoading}
          inviteSuccess={inviteSuccess}
          onClose={() => setShowInviteModal(false)}
          onSubmit={handleInviteWalkIn}
          t={t}
        />
      )}

      {showWalkInRegModal && selectedNetwork && (
        <WalkInRegisterModal
          walkInForm={walkInForm}
          setWalkInForm={setWalkInForm}
          walkInLoading={walkInLoading}
          walkInSuccess={walkInSuccess}
          networkHospitals={networkHospitals}
          onClose={() => setShowWalkInRegModal(false)}
          onSubmit={handleRegisterWalkIn}
          t={t}
        />
      )}

      {activeTab === 'referrals' && selectedNetwork && (
        <ReferralsTab
          selectedNetwork={selectedNetwork}
          referralSuccess={referralSuccess}
          referralError={referralError}
          referralDirection={referralDirection}
          onChangeDirection={(dir) => { setReferralDirection(dir); loadReferrals(dir) }}
          referralsLoading={referralsLoading}
          referrals={referrals}
          speciesLabel={speciesLabel}
          onAcceptReferral={(ref) => setResponseModal({ referral: ref, action: 'accepted' })}
          onRejectReferral={(ref) => setResponseModal({ referral: ref, action: 'rejected' })}
          transfers={transfers}
          onCompleteTransfer={handleCompleteTransfer}
          onOpenCreateReferral={() => setShowCreateReferralModal(true)}
          showCreateReferralModal={showCreateReferralModal}
          referralForm={referralForm}
          setReferralForm={setReferralForm}
          referralNetworkHospitals={referralNetworkHospitals}
          referralSubmitting={referralSubmitting}
          onCloseCreateReferral={() => setShowCreateReferralModal(false)}
          onSubmitCreateReferral={handleCreateReferral}
          responseModal={responseModal}
          responseNotes={responseNotes}
          setResponseNotes={setResponseNotes}
          respondingSubmitting={respondingSubmitting}
          onCloseResponseModal={() => setResponseModal(null)}
          onConfirmResponse={handleReferralResponse}
          t={t}
        />
      )}

      {activeTab === 'leave' && selectedNetwork && (
        <LeaveManagementTab
          leaveRequests={leaveRequests}
          showLeaveModal={showLeaveModal}
          onOpenLeaveModal={() => setShowLeaveModal(true)}
          onCloseLeaveModal={() => setShowLeaveModal(false)}
          onSubmitLeaveRequest={handleCreateLeaveRequest}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          t={t}
        />
      )}

      {activeTab === 'roleMatrix' && selectedNetwork && (
        <div className="hn-tab-content">
          <NetworkRoleMatrix
            networkId={selectedNetwork.id}
            networkName={selectedNetwork.name}
            adminMode={true}
          />
        </div>
      )}

      {activeTab === 'analytics' && selectedNetwork && (
        <AnalyticsTab
          analyticsLoading={analyticsLoading}
          analyticsError={analyticsError}
          analyticsData={analyticsData}
          t={t}
        />
      )}

      {showComplianceModal && selectedNetwork && (
        <ComplianceExportModal
          complianceFrom={complianceFrom}
          setComplianceFrom={setComplianceFrom}
          complianceTo={complianceTo}
          setComplianceTo={setComplianceTo}
          complianceGenerating={complianceGenerating}
          complianceError={complianceError}
          onClose={() => setShowComplianceModal(false)}
          onExport={handleExportCompliance}
          t={t}
        />
      )}

      {showApprovalModal && (
        <ApprovalActionModal
          showApprovalModal={showApprovalModal}
          approvalNotes={approvalNotes}
          setApprovalNotes={setApprovalNotes}
          approvalSaving={approvalSaving}
          onClose={() => { setShowApprovalModal(null); setApprovalNotes('') }}
          onConfirm={handleApprovalAction}
          t={t}
        />
      )}
    </div>
  )
}

export default HospitalNetworks

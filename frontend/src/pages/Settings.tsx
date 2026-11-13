import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { usePermission } from '../context/PermissionContext'
import { useGroomingEnabled } from '../hooks/useGroomingEnabled'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { VetProfile } from '../types'
import ProfileSection from '../components/settings/ProfileSection'
import VetProfessionalSection from '../components/settings/VetProfessionalSection'
import CertificateServicesPanel from '../components/settings/CertificateServicesPanel'
import ConsultationFeeSection from '../components/settings/ConsultationFeeSection'
import ClinicAvailabilitySection from '../components/settings/ClinicAvailabilitySection'
import PreferencesSection from '../components/settings/PreferencesSection'
import PrivacyDataSection from '../components/settings/PrivacyDataSection'
import RoleAndAccountSection from '../components/settings/RoleAndAccountSection'

const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { hasPermission } = usePermission()
  const { enabled: groomingEnabled } = useGroomingEnabled()
  const { formatCurrency, formatDateTime } = useSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isVet = user?.role === 'veterinarian'

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dataSummary, setDataSummary] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [selectedCertTypes, setSelectedCertTypes] = useState<string[]>([])
  const [savingCertTypes, setSavingCertTypes] = useState(false)
  const [certTypesSaved, setCertTypesSaved] = useState(false)

  // Role change request
  const [roleRequests, setRoleRequests] = useState<any[]>([])
  const [rcLoading, setRcLoading] = useState(true)
  const [rcSubmitting, setRcSubmitting] = useState(false)
  const [rcMsg, setRcMsg] = useState('')
  const [selectedNewRole, setSelectedNewRole] = useState('')
  const [rcReason, setRcReason] = useState('')
  // Vet-specific details, required when requesting the veterinarian role (mirrors
  // registration) so an admin can verify + provision the vet profile in one approval step.
  const [rcVetLicense, setRcVetLicense] = useState('')
  const [rcVetFee, setRcVetFee] = useState('')
  const [rcVetExperience, setRcVetExperience] = useState('')
  const [rcVetSpecializations, setRcVetSpecializations] = useState('')
  const [rcVetClinic, setRcVetClinic] = useState('')

  // P6-NOTIFICATIONS: notification preferences
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefSaved, setPrefSaved] = useState(false)
  const [prefLoadError, setPrefLoadError] = useState('')

  React.useEffect(() => {
    apiService.getNotificationPreferences().then((r: any) => {
      setDigestEnabled(r.data?.data?.digestEmailsEnabled ?? r.data?.digestEmailsEnabled ?? true)
    }).catch(() => setPrefLoadError(t('notificationPreferences.loadFailed')))
  }, [t])

  React.useEffect(() => {
    apiService.getMyRoleChangeRequests().then((r: any) => setRoleRequests(r.data || [])).catch((err: any) => {
      console.error('Failed to load role requests:', err?.message)
    }).finally(() => setRcLoading(false))
  }, [])

  const pendingRequest = roleRequests.find((r: any) => r.status === 'pending')
  const approvedRequest = roleRequests.find((r: any) => r.status === 'approved')

  const isVetRequest = selectedNewRole === 'veterinarian'
  const vetDetailsMissing = isVetRequest && !rcVetLicense.trim()

  const handleSubmitRoleChange = async () => {
    if (!selectedNewRole || !rcReason.trim()) return
    if (vetDetailsMissing) { setRcMsg(t('settings.roleChange.vetLicenseRequired')); return }
    setRcSubmitting(true)
    setRcMsg('')
    try {
      const payload: Parameters<typeof apiService.submitRoleChangeRequest>[0] = {
        requested_role: selectedNewRole,
        reason: rcReason,
      }
      if (isVetRequest) {
        payload.profile = {
          licenseNumber: rcVetLicense.trim(),
          consultationFee: rcVetFee ? Number(rcVetFee) : undefined,
          yearsOfExperience: rcVetExperience ? Number(rcVetExperience) : undefined,
          specializations: rcVetSpecializations
            ? rcVetSpecializations.split(',').map(s => s.trim()).filter(Boolean)
            : undefined,
          clinicName: rcVetClinic.trim() || undefined,
        }
      }
      await apiService.submitRoleChangeRequest(payload)
      setRcMsg(t('settings.roleChange.successSubmit'))
      setSelectedNewRole('')
      setRcReason('')
      setRcVetLicense(''); setRcVetFee(''); setRcVetExperience(''); setRcVetSpecializations(''); setRcVetClinic('')
      const r = await apiService.getMyRoleChangeRequests()
      setRoleRequests((r as any).data || [])
    } catch (err: any) {
      setRcMsg(err?.response?.data?.message || t('register.error'))
    } finally {
      setRcSubmitting(false)
    }
  }

  const handleCancelRoleChange = async (id: string) => {
    try {
      await apiService.cancelRoleChangeRequest(id)
      setRcMsg(t('settings.roleChange.successCancel'))
      const r = await apiService.getMyRoleChangeRequests()
      setRoleRequests((r as any).data || [])
    } catch (err: any) {
      console.error('Failed to cancel role change request:', err?.message)
    }
  }
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  // Vet-specific profile
  const [vetForm, setVetForm] = useState({
    consultationFee: '',
    bio: '',
    specializations: '',
    qualifications: '',
    languages: '',
    clinicName: '',
    clinicAddress: '',
    licenseNumber: '',
    yearsOfExperience: '',
    availableDays: '',
    availableHoursStart: '',
    availableHoursEnd: '',
    isAvailable: true,
    acceptsEmergency: false,
    profileImage: '',
  })

  useEffect(() => {
    if (isVet) {
      loadVetProfile()
    }
  }, [isVet])

  const loadVetProfile = async () => {
    try {
      const result = await apiService.getMyVetProfile()
      const p = result.data as VetProfile
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
      setSelectedCertTypes(p.certificateTypes || [])
    } catch {
      // No vet profile yet
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleVetChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setVetForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setVetForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSaveBasic = async () => {
    try {
      setSaving(true)
      await apiService.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      })
      showSaved('basic')
    } catch {
      alert(t('settings.alerts.failedUpdateProfile'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveVet = async () => {
    try {
      setSaving(true)
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
      await apiService.updateVetProfile(payload)
      showSaved('vet')
    } catch {
      alert(t('settings.alerts.failedUpdateVetProfile'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCertTypes = async () => {
    try {
      setSavingCertTypes(true)
      await apiService.updateVetProfile({ certificateTypes: selectedCertTypes })
      setCertTypesSaved(true)
      setTimeout(() => setCertTypesSaved(false), 3000)
    } catch {
      alert(t('settings.alerts.failedUpdateVetProfile'))
    } finally {
      setSavingCertTypes(false)
    }
  }

  const toggleCertType = (type: string) => {
    setSelectedCertTypes(prev =>
      prev.includes(type) ? prev.filter(t_ => t_ !== type) : [...prev, type]
    )
  }

  const showSaved = (section: string) => {
    setSaved(section)
    setTimeout(() => setSaved(''), 3000)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const result = await apiService.uploadFile(file, 'profiles')
      const url = result.url || result.key
      setVetForm(prev => ({ ...prev, profileImage: url }))
    } catch {
      alert(t('settings.alerts.failedUploadPhoto'))
    } finally {
      setUploading(false)
    }
  }

  const handleLoadDataSummary = async () => {
    setDataLoading(true)
    try {
      const result = await apiService.getUserDataSummary()
      setDataSummary(result.data || {})
    } catch { /* */ } finally { setDataLoading(false) }
  }

  const handleSaveNotificationPreferences = async () => {
    setPrefSaving(true)
    setPrefSaved(false)
    try {
      await apiService.updateNotificationPreferences({ digestEmailsEnabled: digestEnabled })
      setPrefSaved(true)
      setTimeout(() => setPrefSaved(false), 3000)
    } catch (err: any) {
      console.error('Failed to save preferences:', err?.message)
    } finally {
      setPrefSaving(false)
    }
  }

  const profileImageUrl = vetForm.profileImage

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('settings.pageTitle')}</h1>
      </div>

      <div className="module-content">
        <div className="settings-container">
          <ProfileSection
            formData={formData}
            onChange={handleChange}
            onSave={handleSaveBasic}
            saving={saving}
            saved={saved === 'basic'}
          />

          {isVet && (
            <>
              <VetProfessionalSection
                vetForm={vetForm}
                onVetChange={handleVetChange}
                profileImageUrl={profileImageUrl}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onPhotoUpload={handlePhotoUpload}
                firstNameInitial={user?.firstName?.charAt(0)}
                lastNameInitial={user?.lastName?.charAt(0)}
              />

              <CertificateServicesPanel
                selectedCertTypes={selectedCertTypes}
                onToggle={toggleCertType}
                onSave={handleSaveCertTypes}
                saving={savingCertTypes}
                saved={certTypesSaved}
              />

              <ConsultationFeeSection
                consultationFee={vetForm.consultationFee}
                onVetChange={handleVetChange}
                formatCurrency={formatCurrency}
              />

              <ClinicAvailabilitySection
                vetForm={vetForm}
                onVetChange={handleVetChange}
                onSave={handleSaveVet}
                saving={saving}
                saved={saved === 'vet'}
              />
            </>
          )}

          <PreferencesSection />

          <PrivacyDataSection
            dataSummary={dataSummary}
            dataLoading={dataLoading}
            onLoadSummary={handleLoadDataSummary}
            formatDateTime={formatDateTime}
          />
        </div>
      </div>

      <RoleAndAccountSection
        currentUserRole={user?.role}
        groomingEnabled={groomingEnabled}
        canUseGroomerConsole={hasPermission('grooming_provider_console')}
        rcMsg={rcMsg}
        approvedRequest={approvedRequest}
        pendingRequest={pendingRequest}
        rcLoading={rcLoading}
        selectedNewRole={selectedNewRole}
        setSelectedNewRole={setSelectedNewRole}
        isVetRequest={isVetRequest}
        rcVetLicense={rcVetLicense}
        setRcVetLicense={setRcVetLicense}
        rcVetFee={rcVetFee}
        setRcVetFee={setRcVetFee}
        rcVetExperience={rcVetExperience}
        setRcVetExperience={setRcVetExperience}
        rcVetClinic={rcVetClinic}
        setRcVetClinic={setRcVetClinic}
        rcVetSpecializations={rcVetSpecializations}
        setRcVetSpecializations={setRcVetSpecializations}
        rcReason={rcReason}
        setRcReason={setRcReason}
        vetDetailsMissing={vetDetailsMissing}
        rcSubmitting={rcSubmitting}
        onSubmitRoleChange={handleSubmitRoleChange}
        onCancelRoleChange={handleCancelRoleChange}
        roleRequests={roleRequests}
        digestEnabled={digestEnabled}
        setDigestEnabled={setDigestEnabled}
        prefSaving={prefSaving}
        prefSaved={prefSaved}
        prefLoadError={prefLoadError}
        setPrefLoadError={setPrefLoadError}
        onSaveNotificationPreferences={handleSaveNotificationPreferences}
      />

      <style>{`
        .settings-container {
          max-width: 700px;
        }

        .settings-section {
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-section:last-child {
          border-bottom: none;
        }

        .settings-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 16px 0;
        }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          font-size: 13px;
          color: #1a1a1a;
        }

        .form-group input,
        .form-group textarea {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input:disabled {
          background: #f5f5f5;
          color: #999;
          cursor: not-allowed;
        }

        .preferences-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preference-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 6px;
          background: #f9f9f9;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .preference-item:hover {
          background: #f0f0f0;
        }

        .preference-item input[type="checkbox"] {
          cursor: pointer;
          width: 18px;
          height: 18px;
        }

        .preference-item span {
          font-size: 14px;
          color: #1a1a1a;
        }

        @media (max-width: 768px) {
          .settings-container {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

export default Settings

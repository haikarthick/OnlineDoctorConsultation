import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import apiService from '../../services/api'
import CertificatePrintView, { CertificatePrintData, CertificateTemplate } from '../../components/CertificatePrintView'
import { CERT_TYPES_FARM, CERT_TYPES_HERD, CERT_TYPES_GROUP, VaccineRow, emptyVaccineRow } from '../../components/certificateWriter/certificateWriterShared'
import IssuedSuccessScreen from '../../components/certificateWriter/IssuedSuccessScreen'
import Step1AnimalAndType from '../../components/certificateWriter/Step1AnimalAndType'
import Step2ClinicalDetails from '../../components/certificateWriter/Step2ClinicalDetails'
import Step3Review from '../../components/certificateWriter/Step3Review'
import '../../styles/modules.css'
import './CertificateWriter.css'

interface CertificateWriterProps {
  onNavigate: (path: string) => void
}

const CertificateWriter: React.FC<CertificateWriterProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { speciesLabel } = useMasterData()

  // Read URL params (edit mode or pre-fill)
  const urlParams = new URLSearchParams(window.location.search)
  const editId = urlParams.get('edit') || ''
  const urlConsultationId = urlParams.get('consultationId') || ''
  const urlAnimalId = urlParams.get('animalId') || ''
  const urlPetOwnerId = urlParams.get('petOwnerId') || ''

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string>(editId)

  // Step 1: Selection
  const [certType, setCertType] = useState('')
  const [ownerSearch, setOwnerSearch] = useState('')
  const [owners, setOwners] = useState<{ id: string; name: string; email: string }[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState(urlPetOwnerId)
  const [selectedOwner, setSelectedOwner] = useState<{ id: string; name: string; email: string } | null>(null)
  const [animals, setAnimals] = useState<{ id: string; name: string; species: string; breed?: string; uniqueId?: string }[]>([])
  const [selectedAnimalId, setSelectedAnimalId] = useState(urlAnimalId)
  const [consultations, setConsultations] = useState<{ id: string; label: string }[]>([])
  const [selectedConsultationId, setSelectedConsultationId] = useState(urlConsultationId)
  const [loadingOwners, setLoadingOwners] = useState(false)
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  const [examinationDate, setExaminationDate] = useState(new Date().toISOString().slice(0, 10))

  // Enterprise (farmer/admin)
  const [enterpriseOptions, setEnterpriseOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const isFarmerOrAdmin = user?.role === 'farmer' || user?.role === 'admin'

  // Group subject (herd/group certificates) - selects a real animal_groups row
  const [groups, setGroups] = useState<{ id: string; name: string; groupType?: string; currentCount?: number; species?: string; managementMode?: string; animalCount?: number }[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [loadingGroups, setLoadingGroups] = useState(false)

  // Step 2: Clinical fields
  const [clinicalFindings, setClinicalFindings] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [treatmentSummary, setTreatmentSummary] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')

  // Vaccination-specific
  const [vaccineRows, setVaccineRows] = useState<VaccineRow[]>([emptyVaccineRow()])
  // Travel-specific
  const [destination, setDestination] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [airline, setAirline] = useState('')
  // Breeding-specific
  const [breedingSoundness, setBreedingSoundness] = useState('')
  const [pregnancyStatus, setPregnancyStatus] = useState('')
  const [estimatedGestation, setEstimatedGestation] = useState('')
  // Valuation-specific
  const [valuationAmount, setValuationAmount] = useState('')
  const [valuationBasis, setValuationBasis] = useState('')
  // Movement-specific (movement_permit, slaughter_fitness, export_health_certificate)
  const [movementFrom, setMovementFrom] = useState('')
  const [movementTo, setMovementTo] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [transportDate, setTransportDate] = useState('')
  const [driverName, setDriverName] = useState('')
  const [movementPurpose, setMovementPurpose] = useState('')
  // Herd-specific (herd_health_certificate)
  const [herdGroupName, setHerdGroupName] = useState('')
  const [herdAnimalCount, setHerdAnimalCount] = useState('')
  const [herdPurpose, setHerdPurpose] = useState('')
  const [herdSpecies, setHerdSpecies] = useState('')

  // Preview
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<CertificatePrintData | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CertificateTemplate | null>(null)

  const isVaccRelated = ['rabies_vaccination', 'vaccination_record'].includes(certType)
  const isTravelRelated = ['fitness_to_travel', 'pre_travel'].includes(certType)
  const isBreedingRelated = ['breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation'].includes(certType)
  const isValuation = certType === 'animal_valuation'
  const isMovement = ['movement_permit', 'slaughter_fitness', 'export_health_certificate'].includes(certType)
  const isHerd = CERT_TYPES_HERD.includes(certType)
  // A group-capable cert can name a whole animal_groups row (batch herd/flock) as subject.
  const isGroupCapable = CERT_TYPES_GROUP.includes(certType)

  // ── Load edit data ──
  useEffect(() => {
    if (!editId) return
    const loadEdit = async () => {
      try {
        const res = await apiService.getCertificate(editId)
        const cert = res.data?.certificate || res.data
        if (!cert) return
        setCertType(cert.certificateType || '')
        setSelectedAnimalId(cert.animalId || '')
        setSelectedGroupId(cert.groupId || '')
        if (cert.groupId) setSelectedGroup(cert.herdDetails?.groupName ? { id: cert.groupId, name: cert.herdDetails.groupName } : { id: cert.groupId, name: cert.herdDetails?.groupName || 'Group' })
        setSelectedOwnerId(cert.petOwnerId || '')
        setSelectedConsultationId(cert.consultationId || '')
        setExaminationDate(cert.examinationDate ? cert.examinationDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
        setClinicalFindings(cert.clinicalFindings || '')
        setDiagnosis(cert.diagnosis || '')
        setTreatmentSummary(cert.treatmentSummary || '')
        setRecommendations(cert.recommendations || '')
        setValidUntil(cert.validUntil ? cert.validUntil.slice(0, 10) : '')
        setNotes(cert.notes || '')
        if (cert.vaccinationDetails?.vaccines) setVaccineRows(cert.vaccinationDetails.vaccines)
        if (cert.travelDetails) {
          setDestination(cert.travelDetails.destination || '')
          setDepartureDate(cert.travelDetails.departureDate ? cert.travelDetails.departureDate.slice(0, 10) : '')
          setAirline(cert.travelDetails.airline || '')
        }
        if (cert.breedingDetails) {
          setBreedingSoundness(cert.breedingDetails.soundness || '')
          setPregnancyStatus(cert.breedingDetails.pregnancyStatus || '')
          setEstimatedGestation(cert.breedingDetails.estimatedGestation || '')
        }
        if (cert.valuationDetails) {
          setValuationAmount(String(cert.valuationDetails.amount || ''))
          setValuationBasis(cert.valuationDetails.basis || '')
        }
        if (cert.movementDetails) {
          setMovementFrom(cert.movementDetails.fromLocation || '')
          setMovementTo(cert.movementDetails.toLocation || '')
          setVehicleNumber(cert.movementDetails.vehicleNumber || '')
          setTransportDate(cert.movementDetails.transportDate ? cert.movementDetails.transportDate.slice(0, 10) : '')
          setDriverName(cert.movementDetails.driverName || '')
          setMovementPurpose(cert.movementDetails.purpose || '')
        }
        if (cert.herdDetails) {
          setHerdGroupName(cert.herdDetails.groupName || '')
          setHerdAnimalCount(String(cert.herdDetails.animalCount || ''))
          setHerdPurpose(cert.herdDetails.purpose || '')
          setHerdSpecies(cert.herdDetails.species || '')
        }
        // Load owner info
        if (cert.petOwnerId) setSelectedOwnerId(cert.petOwnerId)
        if (cert.enterpriseId) setSelectedEnterpriseId(cert.enterpriseId)
      } catch { /* ignore */ }
    }
    loadEdit()
  }, [editId])

  // ── Load enterprises for farmer/admin ──
  useEffect(() => {
    if (!isFarmerOrAdmin) return
    apiService.listEnterprises({ limit: 100 }).then(res => {
      const items = res.data?.items || res.data?.enterprises || (Array.isArray(res.data) ? res.data : [])
      setEnterpriseOptions(items.map((e: any) => ({ id: e.id, name: e.name })))
    }).catch(() => setError(t('certificateWriter.failedToLoadEnterprises')))
  }, [isFarmerOrAdmin, t])

  // ── Load animal groups for a farm cert when an enterprise is selected ──
  const isGroupCapableAny = CERT_TYPES_GROUP.includes(certType)
  useEffect(() => {
    if (!isGroupCapableAny || !selectedEnterpriseId) { setGroups([]); setSelectedGroupId(''); return }
    let isCancelled = false
    setLoadingGroups(true)
    apiService.listAnimalGroups(selectedEnterpriseId, { limit: 200 }).then(res => {
      if (isCancelled) return
      setGroups((res.data?.items || []).map((g: any) => ({
        id: g.id, name: g.name, groupType: g.groupType, currentCount: g.currentCount,
        species: g.species, managementMode: g.managementMode, animalCount: g.animalCount || g.currentCount,
      })))
    }).catch(() => { if (!isCancelled) setGroups([]) }).finally(() => { if (!isCancelled) setLoadingGroups(false) })
    return () => { isCancelled = true }
  }, [isGroupCapableAny, selectedEnterpriseId, certType])

  // ── Search owners ──
  const searchOwners = useCallback(async (q: string) => {
    if (!q.trim()) { setOwners([]); return }
    try {
      setLoadingOwners(true)
      const res = await apiService.listPatients({ search: q, limit: 20 })
      const users = res.data?.users || (Array.isArray(res.data) ? res.data : [])
      setOwners(users.map((u: any) => ({
        id: u.id,
        name: `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim(),
        email: u.email || '',
      })))
    } catch { setOwners([]) }
    finally { setLoadingOwners(false) }
  }, [])

  useEffect(() => {
    const t_ = setTimeout(() => searchOwners(ownerSearch), 350)
    return () => clearTimeout(t_)
  }, [ownerSearch, searchOwners])

  // ── Load animals when owner OR enterprise selected ──
  useEffect(() => {
    const isFarmCert = CERT_TYPES_FARM.includes(certType)
    const useEnterprise = isFarmCert && selectedEnterpriseId
    if (!useEnterprise && !selectedOwnerId) { setAnimals([]); return }
    const loadAnimals = async () => {
      try {
        setLoadingAnimals(true)
        const params = useEnterprise
          ? { enterpriseId: selectedEnterpriseId, limit: 200 }
          : { ownerId: selectedOwnerId, limit: 100 }
        const res = await apiService.listAnimals(params)
        const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
        setAnimals(list.map((a: any) => ({ id: a.id, name: a.name, species: a.species, breed: a.breed, uniqueId: a.uniqueId || a.unique_id })))
        if (list.length === 1 && !selectedAnimalId) setSelectedAnimalId(list[0].id)
      } catch { setAnimals([]) }
      finally { setLoadingAnimals(false) }
    }
    loadAnimals()
  }, [selectedOwnerId, selectedEnterpriseId, certType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load recent consultations for this owner ──
  useEffect(() => {
    if (!selectedOwnerId) { setConsultations([]); return }
    const loadConsultations = async () => {
      try {
        const res = await apiService.listConsultations({ limit: 20 })
        const items = res.data?.items || res.data?.consultations || (Array.isArray(res.data) ? res.data : [])
        setConsultations(items
          .filter((c: any) => c.petOwnerId === selectedOwnerId || c.pet_owner_id === selectedOwnerId)
          .map((c: any) => ({
            id: c.id,
            label: `${c.animalName || 'Consultation'} - ${formatDate(c.scheduledAt || c.scheduled_at || c.createdAt || c.created_at)}`,
          }))
        )
      } catch { setConsultations([]) }
    }
    loadConsultations()
  }, [selectedOwnerId, formatDate])

  // ── Build payload ──
  const buildPayload = () => {
    const payload: any = {
      certificateType: certType,
      animalId: selectedAnimalId || undefined,
      groupId: selectedGroupId || undefined,
      petOwnerId: selectedOwnerId || undefined,
      consultationId: selectedConsultationId || undefined,
      enterpriseId: selectedEnterpriseId || undefined,
      examinationDate: examinationDate || undefined,
      clinicalFindings: clinicalFindings || undefined,
      diagnosis: diagnosis || undefined,
      treatmentSummary: treatmentSummary || undefined,
      recommendations: recommendations || undefined,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
    }
    if (isVaccRelated && vaccineRows.some(r => r.vaccine)) {
      payload.vaccinationDetails = { vaccines: vaccineRows.filter(r => r.vaccine.trim()) }
    }
    if (isTravelRelated && (destination || departureDate)) {
      payload.travelDetails = { destination, departureDate, airline }
    }
    if (isBreedingRelated && (breedingSoundness || pregnancyStatus)) {
      payload.breedingDetails = { soundness: breedingSoundness, pregnancyStatus, estimatedGestation }
    }
    if (isValuation && valuationAmount) {
      payload.valuationDetails = { amount: valuationAmount, basis: valuationBasis }
    }
    if (isMovement && (movementFrom || movementTo)) {
      payload.movementDetails = { fromLocation: movementFrom, toLocation: movementTo, vehicleNumber, transportDate, driverName, purpose: movementPurpose }
    }
    if (isHerd && (herdGroupName || herdAnimalCount)) {
      payload.herdDetails = { groupName: herdGroupName, animalCount: herdAnimalCount ? Number(herdAnimalCount) : undefined, species: herdSpecies, purpose: herdPurpose }
    }
    return payload
  }

  // ── Save draft ──
  const handleSaveDraft = async () => {
    if (!certType) { setError(t('certificateWriter.noCertTypeSelected')); return }
    try {
      setSubmitting(true)
      setError('')
      const payload = buildPayload()
      if (savedId) {
        await apiService.updateCertificate(savedId, payload)
      } else {
        const res = await apiService.createCertificate(payload)
        const created = res.data?.certificate || res.data
        if (created?.id) setSavedId(created.id)
        else throw new Error(t('certificateWriter.failedToCreate'))
      }
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || t('certificateWriter.failedToSave'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Issue certificate ──
  const handleIssue = async () => {
    if (!certType) { setError(t('certificateWriter.noCertTypeSelected')); return }
    try {
      setSubmitting(true)
      setError('')
      let id = savedId
      const payload = buildPayload()
      if (id) {
        await apiService.updateCertificate(id, payload)
      } else {
        const res = await apiService.createCertificate(payload)
        const created = res.data?.certificate || res.data
        id = created?.id || ''
        if (!id) throw new Error(t('certificateWriter.failedToCreate'))
        setSavedId(id)
      }
      await apiService.issueCertificate(id)
      setIssued(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || t('certificateWriter.failedToIssue'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Build preview ──
  const handlePreview = async () => {
    try {
      const tplMap = await apiService.getCertificateTemplate()
      const tpl: CertificateTemplate = {
        clinicName: tplMap.clinicName || 'waytovet Platform',
        clinicAddress: tplMap.clinicAddress || '',
        clinicPhone: tplMap.clinicPhone || '',
        clinicEmail: tplMap.clinicEmail || '',
        clinicWebsite: tplMap.clinicWebsite || '',
        registrationNumber: tplMap.registrationNumber || '',
        clinicLogo: tplMap.clinicLogo || '',
        footerText: tplMap.footerText || '',
      }
      setPreviewTemplate(tpl)

      const selectedAnimalObj = animals.find(a => a.id === selectedAnimalId)
      const preview: CertificatePrintData = {
        id: savedId || 'preview',
        certificateNumber: savedId ? 'DRAFT-PREVIEW' : 'DRAFT',
        certificateType: certType,
        status: 'draft',
        examinationDate: examinationDate,
        validUntil: validUntil || undefined,
        clinicalFindings: clinicalFindings,
        diagnosis: diagnosis,
        treatmentSummary: treatmentSummary,
        recommendations: recommendations,
        notes: notes,
        animalName: selectedAnimalObj?.name,
        animalSpecies: selectedAnimalObj?.species,
        animalBreed: selectedAnimalObj?.breed,
        ownerFirstName: selectedOwner?.name?.split(' ')[0],
        ownerLastName: selectedOwner?.name?.split(' ').slice(1).join(' '),
        vetFirstName: user?.firstName || (user as any)?.first_name || '',
        vetLastName: user?.lastName || (user as any)?.last_name || '',
        vaccinationDetails: isVaccRelated && vaccineRows.some(r => r.vaccine) ? { vaccines: vaccineRows.filter(r => r.vaccine.trim()) } : undefined,
        travelDetails: isTravelRelated && (destination || departureDate) ? { destination, departureDate, airline } : undefined,
        breedingDetails: isBreedingRelated && (breedingSoundness || pregnancyStatus) ? { soundness: breedingSoundness, pregnancyStatus, estimatedGestation } : undefined,
        valuationDetails: isValuation && valuationAmount ? { amount: valuationAmount, basis: valuationBasis } : undefined,
        movementDetails: isMovement && (movementFrom || movementTo) ? { fromLocation: movementFrom, toLocation: movementTo, vehicleNumber, transportDate, driverName, purpose: movementPurpose } : undefined,
        herdDetails: isHerd && (herdGroupName || herdAnimalCount) ? { groupName: herdGroupName, animalCount: herdAnimalCount ? Number(herdAnimalCount) : undefined, species: herdSpecies, purpose: herdPurpose } : undefined,
      }
      setPreviewData(preview)
      setShowPreview(true)
    } catch { /* ignore */ }
  }

  const selectOwner = (o: { id: string; name: string; email: string }) => {
    setSelectedOwnerId(o.id)
    setSelectedOwner(o)
    setOwnerSearch(o.name)
    setOwners([])
    setSelectedAnimalId('')
  }

  // Pick a whole group (batch herd/flock) as the certificate subject. Pre-fills the
  // free-typed herd details so the certificate always points at a real animal_groups row.
  const selectGroup = (g: { id: string; name: string; groupType?: string; currentCount?: number; species?: string; animalCount?: number }) => {
    setSelectedGroupId(g.id)
    setSelectedGroup(g)
    setHerdGroupName(g.name)
    const count = g.animalCount ?? g.currentCount
    if (count != null) setHerdAnimalCount(String(count))
    if (g.species) setHerdSpecies(g.species)
    // Movement/export certs: default the origin to the group's enterprise context
    if (isMovement) setMovementFrom(g.name)
  }

  // ── Issued success screen ──
  if (issued) {
    return <IssuedSuccessScreen t={t} certType={certType} onNavigate={onNavigate} />
  }

  return (
    <div className="module-page cw-page">
      {/* ── Header ── */}
      <div className="module-header">
        <div>
          <h1>📜 {editId ? t('certificateWriter.editTitle') : t('certificateWriter.title')}</h1>
          <p>
            {t('certificateWriter.step1')} &rarr; {t('certificateWriter.step2')} &rarr; {t('certificateWriter.step3')}
          </p>
        </div>
        <button className="module-btn" onClick={() => onNavigate('/vet-certificates')}>
          ← {t('certificateWriter.back')}
        </button>
      </div>

      {error && (
        <div className="module-alert error cw-alert-gap">
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {draftSaved && (
        <div className="module-alert success cw-alert-gap">
          ✓ {t('certificateWriter.draftSaved')}
        </div>
      )}

      {/* ── Step indicator ── */}
      <div className="module-tabs cw-tabs-gap">
        {[1, 2, 3].map(s => (
          <button
            key={s}
            className={`module-tab${step === s ? ' active' : ''}`}
            onClick={() => setStep(s)}
          >
            {s === 1 && `1. ${t('certificateWriter.step1')}`}
            {s === 2 && `2. ${t('certificateWriter.step2')}`}
            {s === 3 && `3. ${t('certificateWriter.step3')}`}
          </button>
        ))}
      </div>

      {step === 1 && (
        <Step1AnimalAndType
          t={t} speciesLabel={speciesLabel} certType={certType} setCertType={setCertType}
          isFarmerOrAdmin={isFarmerOrAdmin} enterpriseOptions={enterpriseOptions}
          selectedEnterpriseId={selectedEnterpriseId} setSelectedEnterpriseId={setSelectedEnterpriseId}
          ownerSearch={ownerSearch} setOwnerSearch={setOwnerSearch}
          setSelectedOwnerId={setSelectedOwnerId} setSelectedOwner={setSelectedOwner}
          loadingOwners={loadingOwners} owners={owners} selectOwner={selectOwner} selectedOwnerId={selectedOwnerId}
          isHerd={isHerd} isGroupCapable={isGroupCapable} selectedAnimalId={selectedAnimalId}
          setSelectedAnimalId={setSelectedAnimalId} loadingAnimals={loadingAnimals} animals={animals}
          loadingGroups={loadingGroups} groups={groups} selectedGroupId={selectedGroupId}
          selectGroup={selectGroup} selectedGroup={selectedGroup} consultations={consultations}
          selectedConsultationId={selectedConsultationId} setSelectedConsultationId={setSelectedConsultationId}
          examinationDate={examinationDate} setExaminationDate={setExaminationDate} setStep={setStep}
        />
      )}

      {step === 2 && (
        <Step2ClinicalDetails
          t={t} certType={certType} selectedAnimalId={selectedAnimalId} animals={animals} selectedOwner={selectedOwner}
          isVaccRelated={isVaccRelated} vaccineRows={vaccineRows} setVaccineRows={setVaccineRows}
          isTravelRelated={isTravelRelated} destination={destination} setDestination={setDestination}
          departureDate={departureDate} setDepartureDate={setDepartureDate} airline={airline} setAirline={setAirline}
          isBreedingRelated={isBreedingRelated} breedingSoundness={breedingSoundness} setBreedingSoundness={setBreedingSoundness}
          pregnancyStatus={pregnancyStatus} setPregnancyStatus={setPregnancyStatus}
          estimatedGestation={estimatedGestation} setEstimatedGestation={setEstimatedGestation}
          isValuation={isValuation} valuationAmount={valuationAmount} setValuationAmount={setValuationAmount}
          valuationBasis={valuationBasis} setValuationBasis={setValuationBasis}
          isMovement={isMovement} movementFrom={movementFrom} setMovementFrom={setMovementFrom}
          movementTo={movementTo} setMovementTo={setMovementTo} vehicleNumber={vehicleNumber} setVehicleNumber={setVehicleNumber}
          transportDate={transportDate} setTransportDate={setTransportDate} driverName={driverName} setDriverName={setDriverName}
          movementPurpose={movementPurpose} setMovementPurpose={setMovementPurpose}
          isHerd={isHerd} herdGroupName={herdGroupName} setHerdGroupName={setHerdGroupName}
          herdAnimalCount={herdAnimalCount} setHerdAnimalCount={setHerdAnimalCount}
          herdSpecies={herdSpecies} setHerdSpecies={setHerdSpecies} herdPurpose={herdPurpose} setHerdPurpose={setHerdPurpose}
          clinicalFindings={clinicalFindings} setClinicalFindings={setClinicalFindings}
          diagnosis={diagnosis} setDiagnosis={setDiagnosis}
          treatmentSummary={treatmentSummary} setTreatmentSummary={setTreatmentSummary}
          recommendations={recommendations} setRecommendations={setRecommendations}
          validUntil={validUntil} setValidUntil={setValidUntil} examinationDate={examinationDate}
          notes={notes} setNotes={setNotes} setStep={setStep}
        />
      )}

      {step === 3 && (
        <Step3Review
          t={t} certType={certType} selectedGroupId={selectedGroupId} selectedGroup={selectedGroup}
          animals={animals} selectedAnimalId={selectedAnimalId} selectedOwnerId={selectedOwnerId} selectedOwner={selectedOwner}
          examinationDate={examinationDate} validUntil={validUntil} formatDate={formatDate}
          handlePreview={handlePreview} submitting={submitting} setStep={setStep}
          handleSaveDraft={handleSaveDraft} handleIssue={handleIssue} isHerd={isHerd} isGroupCapable={isGroupCapable}
        />
      )}

      {/* ── Preview modal ── */}
      {showPreview && previewData && previewTemplate && (
        <CertificatePrintView
          certificate={previewData}
          template={previewTemplate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

export default CertificateWriter

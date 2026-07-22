import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import CertificatePrintView, { CertificatePrintData, CertificateTemplate } from '../../components/CertificatePrintView'
import '../../styles/modules.css'
import './CertificateWriter.css'

interface CertificateWriterProps {
  onNavigate: (path: string) => void
}

const CERT_TYPES_PET = [
  'health_certificate', 'fitness_to_travel', 'rabies_vaccination', 'vaccination_record',
  'pre_travel', 'sterilization', 'treatment', 'animal_injury', 'post_mortem',
  'fitness_for_sale',
]

const CERT_TYPES_FARM = [
  'breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation', 'animal_valuation',
  'movement_permit', 'herd_health_certificate', 'slaughter_fitness', 'export_health_certificate',
]

// Herd-level certs: animal selection optional (cert covers a group)
const CERT_TYPES_HERD = ['herd_health_certificate']

interface VaccineRow {
  vaccine: string; batchNo: string; dateAdministered: string; nextDue: string; manufacturer: string
}

const emptyVaccineRow = (): VaccineRow => ({
  vaccine: '', batchNo: '', dateAdministered: '', nextDue: '', manufacturer: ''
})

const CertificateWriter: React.FC<CertificateWriterProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()

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
            label: `${c.animalName || 'Consultation'} — ${formatDate(c.scheduledAt || c.scheduled_at || c.createdAt || c.created_at)}`,
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
        clinicName: tplMap.clinicName || 'VetCare Platform',
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

  const certTypeLabel = (type: string) => t(`vetCertificates.certTypes.${type}` as any) || type.replace(/_/g, ' ')

  // ── Issued success screen ──
  if (issued) {
    return (
      <div className="module-page">
        <div className="module-card cw-success-card">
          <p className="cw-success-icon">✅</p>
          <h2>{t('certificateWriter.certificateIssued')}</h2>
          <p className="cw-success-type">{certTypeLabel(certType)}</p>
          <div className="cw-success-actions">
            <button className="module-btn" onClick={() => onNavigate('/vet-certificates')}>
              {t('certificateWriter.viewAllCertificates')}
            </button>
            <button className="module-btn primary" onClick={() => window.location.reload()}>
              {t('certificateWriter.createAnother')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
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

      {/* ════════════════════════════════
          STEP 1: Animal & Type
      ══════════════════════════════ */}
      {step === 1 && (
        <div className="module-card cw-card">
          <h3 className="cw-step-title">1. {t('certificateWriter.step1')}</h3>

          {/* Certificate type - grouped by context */}
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.selectType')} *</label>
            <select
              className="module-input"
              value={certType}
              onChange={e => setCertType(e.target.value)}
            >
              <option value="">{t('certificateWriter.selectType')}</option>
              <optgroup label="🐾 Pet / General">
                {CERT_TYPES_PET.map(ct => (
                  <option key={ct} value={ct}>{certTypeLabel(ct)}</option>
                ))}
              </optgroup>
              <optgroup label="🐄 Farm / Enterprise">
                {CERT_TYPES_FARM.map(ct => (
                  <option key={ct} value={ct}>{certTypeLabel(ct)}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Enterprise selector (farmer/admin only) */}
          {isFarmerOrAdmin && enterpriseOptions.length > 0 && (
            <div className="module-form-group">
              <label className="module-label">🏢 {t('certificateWriter.enterprise')}</label>
              <select
                className="module-input"
                value={selectedEnterpriseId}
                onChange={e => setSelectedEnterpriseId(e.target.value)}
              >
                <option value="">— {t('certificateWriter.noEnterprise')} —</option>
                {enterpriseOptions.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Owner search */}
          <div className="module-form-group cw-owner-search-wrap">
            <label className="module-label">{t('certificateWriter.searchOwner')} *</label>
            <input
              className="module-input"
              type="text"
              placeholder={t('certificateWriter.searchOwner')}
              value={ownerSearch}
              onChange={e => { setOwnerSearch(e.target.value); if (!e.target.value) { setSelectedOwnerId(''); setSelectedOwner(null) } }}
            />
            {loadingOwners && <div className="cw-loading-hint">{t('common.loading')}</div>}
            {owners.length > 0 && (
              <div className="cw-dropdown">
                {owners.map(o => (
                  <div key={o.id} className="cw-dropdown-item" onClick={() => selectOwner(o)}>
                    <strong>{o.name}</strong>
                    <span className="cw-dropdown-item-email">· {o.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Animal select — shown when owner selected OR enterprise selected for farm certs */}
          {(selectedOwnerId || (CERT_TYPES_FARM.includes(certType) && selectedEnterpriseId)) && (
            <div className="module-form-group">
              <label className="module-label">
                {t('certificateWriter.selectAnimal')} {isHerd ? `(${t('certificateWriter.optionalForHerd')})` : '*'}
              </label>
              {loadingAnimals ? (
                <div className="si-ad8ab961">{t('common.loading')}</div>
              ) : animals.length === 0 ? (
                <div className="si-c22a66cc">{t('certificateWriter.noAnimals')}</div>
              ) : (
                <select
                  className="module-input"
                  value={selectedAnimalId}
                  onChange={e => setSelectedAnimalId(e.target.value)}
                >
                  <option value="">{isHerd ? `— ${t('certificateWriter.optionalForHerd')} —` : t('certificateWriter.selectAnimal')}</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.uniqueId ? `[${a.uniqueId}] ` : ''}{a.name} ({a.species}{a.breed ? ', ' + a.breed : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {!selectedOwnerId && !(CERT_TYPES_FARM.includes(certType) && selectedEnterpriseId) && (
            <p className="cw-hint">ℹ {t('certificateWriter.selectOwnerFirst')}</p>
          )}

          {/* Optional consultation link */}
          {selectedOwnerId && consultations.length > 0 && (
            <div className="module-form-group">
              <label className="module-label">{t('certificateWriter.linkConsultation')}</label>
              <select
                className="module-input"
                value={selectedConsultationId}
                onChange={e => setSelectedConsultationId(e.target.value)}
              >
                <option value="">— None —</option>
                {consultations.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Examination date */}
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.examinationDate')}</label>
            <input
              className="module-input"
              type="date"
              value={examinationDate}
              onChange={e => setExaminationDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="cw-next-bar">
            <button
              className="module-btn primary"
              disabled={!certType || !selectedOwnerId || (!isHerd && !selectedAnimalId)}
              onClick={() => setStep(2)}
            >
              {t('certificateWriter.next')} →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          STEP 2: Clinical Details
      ══════════════════════════════ */}
      {step === 2 && (
        <div className="module-card cw-card">
          <h3 className="cw-step-title">2. {t('certificateWriter.step2')}</h3>

          {/* Summary of step 1 */}
          <div className="cw-step-summary">
            <strong className="cw-summary-name">{certTypeLabel(certType)}</strong>
            {selectedAnimalId && animals.find(a => a.id === selectedAnimalId) && (
              <span> — {animals.find(a => a.id === selectedAnimalId)?.name}</span>
            )}
            <span className="cw-summary-owner">({selectedOwner?.name || ''})</span>
          </div>

          {/* Vaccination-specific */}
          {isVaccRelated && (
            <div className="module-form-group">
              <label className="module-label">💉 {t('certificateWriter.vaccinationDetails')}</label>
              {vaccineRows.map((row, i) => (
                <div key={i} className="cw-vaccine-row">
                  <div className="module-form-row-3">
                    <div className="module-form-group">
                      <label className="module-label cw-label-sm">Vaccine Name</label>
                      <input className="module-input" value={row.vaccine} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, vaccine: e.target.value } : x))} placeholder="e.g. Rabies" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label cw-label-sm">Batch No.</label>
                      <input className="module-input" value={row.batchNo} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, batchNo: e.target.value } : x))} placeholder="Batch number" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label cw-label-sm">Manufacturer</label>
                      <input className="module-input" value={row.manufacturer} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, manufacturer: e.target.value } : x))} placeholder="Manufacturer" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label cw-label-sm">Date Administered</label>
                      <input className="module-input" type="date" value={row.dateAdministered} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, dateAdministered: e.target.value } : x))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label cw-label-sm">Next Due</label>
                      <input className="module-input" type="date" value={row.nextDue} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, nextDue: e.target.value } : x))} />
                    </div>
                    <div className="module-form-group">
                      {vaccineRows.length > 1 && (
                        <button className="module-btn small danger" onClick={() => setVaccineRows(r => r.filter((_, j) => j !== i))}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button className="module-btn small" onClick={() => setVaccineRows(r => [...r, emptyVaccineRow()])}>
                + Add Vaccine
              </button>
            </div>
          )}

          {/* Travel-specific */}
          {isTravelRelated && (
            <div className="module-form-group">
              <label className="module-label">✈️ {t('certificateWriter.travelDetails')}</label>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.destination')} *</label>
                  <input className="module-input" value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. United Kingdom" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.departureDate')}</label>
                  <input className="module-input" type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('certificateWriter.airline')}</label>
                <input className="module-input" value={airline} onChange={e => setAirline(e.target.value)} placeholder="e.g. IndiGo, Air India" />
              </div>
            </div>
          )}

          {/* Breeding-specific */}
          {isBreedingRelated && (
            <div className="module-form-group">
              <label className="module-label">🐄 {t('certificateWriter.breedingDetails')}</label>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.breedingSoundness')}</label>
                  <select className="module-input" value={breedingSoundness} onChange={e => setBreedingSoundness(e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="Sound">Sound</option>
                    <option value="Questionable">Questionable</option>
                    <option value="Unsound">Unsound</option>
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.pregnancyStatus')}</label>
                  <select className="module-input" value={pregnancyStatus} onChange={e => setPregnancyStatus(e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="Pregnant">Pregnant</option>
                    <option value="Not Pregnant">Not Pregnant</option>
                    <option value="Undetermined">Undetermined</option>
                  </select>
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('certificateWriter.estimatedGestation')}</label>
                <input className="module-input" value={estimatedGestation} onChange={e => setEstimatedGestation(e.target.value)} placeholder="e.g. 6 weeks" />
              </div>
            </div>
          )}

          {/* Valuation-specific */}
          {isValuation && (
            <div className="module-form-group">
              <label className="module-label">💰 {t('certificateWriter.valuationDetails')}</label>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.valuationAmount')} *</label>
                  <input className="module-input" type="number" min="0" value={valuationAmount} onChange={e => setValuationAmount(e.target.value)} placeholder="e.g. 50000" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.valuationBasis')}</label>
                  <input className="module-input" value={valuationBasis} onChange={e => setValuationBasis(e.target.value)} placeholder="e.g. Market value based on breed and age" />
                </div>
              </div>
            </div>
          )}

          {/* Movement-specific (movement_permit, slaughter_fitness, export_health_certificate) */}
          {isMovement && (
            <div className="module-form-group">
              <label className="module-label">🚛 {t('certificateWriter.movementDetails')}</label>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.movementFrom')} *</label>
                  <input className="module-input" value={movementFrom} onChange={e => setMovementFrom(e.target.value)} placeholder="e.g. Farm Name, Village, District" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.movementTo')} *</label>
                  <input className="module-input" value={movementTo} onChange={e => setMovementTo(e.target.value)} placeholder="e.g. Slaughterhouse, Export Port, Market" />
                </div>
              </div>
              <div className="module-form-row-3">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.vehicleNumber')}</label>
                  <input className="module-input" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. TN 01 AB 1234" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.transportDate')}</label>
                  <input className="module-input" type="date" value={transportDate} onChange={e => setTransportDate(e.target.value)} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.driverName')}</label>
                  <input className="module-input" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver / Transporter name" />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('certificateWriter.movementPurpose')}</label>
                <select className="module-input" value={movementPurpose} onChange={e => setMovementPurpose(e.target.value)}>
                  <option value="">— Select purpose —</option>
                  <option value="Sale">Sale</option>
                  <option value="Slaughter">Slaughter</option>
                  <option value="Export">Export</option>
                  <option value="Breeding">Breeding</option>
                  <option value="Treatment">Treatment / Veterinary Care</option>
                  <option value="Exhibition">Exhibition / Show</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Herd-specific (herd_health_certificate) */}
          {isHerd && (
            <div className="module-form-group">
              <label className="module-label">🐄 {t('certificateWriter.herdDetails')}</label>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.herdGroupName')} *</label>
                  <input className="module-input" value={herdGroupName} onChange={e => setHerdGroupName(e.target.value)} placeholder="e.g. Block A Cattle, Pen 3 Sheep" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.herdAnimalCount')} *</label>
                  <input className="module-input" type="number" min="1" value={herdAnimalCount} onChange={e => setHerdAnimalCount(e.target.value)} placeholder="Total number of animals" />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.herdSpecies')}</label>
                  <select className="module-input" value={herdSpecies} onChange={e => setHerdSpecies(e.target.value)}>
                    <option value="">— Select species —</option>
                    <option value="Cattle">Cattle / Bovine</option>
                    <option value="Sheep">Sheep</option>
                    <option value="Goat">Goat</option>
                    <option value="Pig">Pig / Swine</option>
                    <option value="Poultry">Poultry</option>
                    <option value="Horse">Horse / Equine</option>
                    <option value="Mixed">Mixed Species</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('certificateWriter.herdPurpose')}</label>
                  <select className="module-input" value={herdPurpose} onChange={e => setHerdPurpose(e.target.value)}>
                    <option value="">— Select purpose —</option>
                    <option value="Dairy">Dairy Production</option>
                    <option value="Meat">Meat Production</option>
                    <option value="Breeding">Breeding Stock</option>
                    <option value="Draft">Draft / Work Animals</option>
                    <option value="Mixed">Mixed Purpose</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Common clinical fields */}
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.clinicalFindings')}</label>
            <textarea className="module-input si-3f7753b6" rows={4} value={clinicalFindings} onChange={e => setClinicalFindings(e.target.value)} placeholder={t('certificateWriter.clinicalFindingsPlaceholder')} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.diagnosis')}</label>
            <textarea className="module-input si-3f7753b6" rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Assessment or diagnostic conclusion..." />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.treatmentSummary')}</label>
            <textarea className="module-input si-3f7753b6" rows={3} value={treatmentSummary} onChange={e => setTreatmentSummary(e.target.value)} placeholder="Describe treatments or procedures performed..." />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.recommendations')}</label>
            <textarea className="module-input si-3f7753b6" rows={2} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Post-certificate recommendations..." />
          </div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('certificateWriter.validUntil')}</label>
              <input className="module-input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} min={examinationDate} />
            </div>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.notes')}</label>
            <textarea className="module-input si-3f7753b6" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
          </div>

          <div className="cw-actions">
            <button className="module-btn" onClick={() => setStep(1)}>← {t('certificateWriter.back')}</button>
            <button className="module-btn primary" onClick={() => setStep(3)}>{t('certificateWriter.next')} →</button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          STEP 3: Review & Issue
      ══════════════════════════════ */}
      {step === 3 && (
        <div className="module-card cw-card">
          <h3 className="cw-step-title">3. {t('certificateWriter.step3')}</h3>

          {/* Review summary */}
          <div className="cw-review-summary">
            <div className="cw-review-grid">
              <div>
                <div className="cw-review-label">{t('certificateWriter.reviewCertType')}</div>
                <div className="cw-review-value">{certTypeLabel(certType)}</div>
              </div>
              <div>
                <div className="cw-review-label">{t('certificateWriter.reviewAnimal')}</div>
                <div className="cw-review-value">{animals.find(a => a.id === selectedAnimalId)?.name || '—'}</div>
              </div>
              <div>
                <div className="cw-review-label">{t('certificateWriter.reviewOwner')}</div>
                <div className="cw-review-value">{selectedOwner?.name || '—'}</div>
              </div>
              <div>
                <div className="cw-review-label">{t('certificateWriter.reviewExamDate')}</div>
                <div className="cw-review-value">{examinationDate ? formatDate(examinationDate) : '—'}</div>
              </div>
              <div>
                <div className="cw-review-label">{t('certificateWriter.reviewValidUntil')}</div>
                <div className="cw-review-value">{validUntil ? formatDate(validUntil) : t('certificateWriter.reviewNoExpiry')}</div>
              </div>
            </div>
          </div>

          <div className="cw-preview-bar">
            <button className="module-btn" onClick={handlePreview}>
              👁 {t('certificateWriter.preview')}
            </button>
          </div>

          <div className="cw-warning-note">
            <strong>⚠ {t('certificateWriter.issueNotePrefix')}:</strong>{' '}
            {t('certificateWriter.issueNoteText')}
          </div>

          <div className="cw-actions">
            <button className="module-btn" onClick={() => setStep(2)} disabled={submitting}>
              ← {t('certificateWriter.back')}
            </button>
            <div className="cw-actions-right">
              <button className="module-btn" onClick={handleSaveDraft} disabled={submitting}>
                {submitting ? t('common.saving') : `💾 ${t('certificateWriter.saveDraft')}`}
              </button>
              <button
                className="module-btn primary"
                onClick={handleIssue}
                disabled={submitting || !certType || (!isHerd && !selectedAnimalId) || !selectedOwnerId}
              >
                {submitting ? t('common.saving') : `✅ ${t('certificateWriter.issueNow')}`}
              </button>
            </div>
          </div>
        </div>
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

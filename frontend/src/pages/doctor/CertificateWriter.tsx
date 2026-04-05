import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import CertificatePrintView, { CertificatePrintData, CertificateTemplate } from '../../components/CertificatePrintView'
import '../../styles/modules.css'

interface CertificateWriterProps {
  onNavigate: (path: string) => void
}

const CERT_TYPES = [
  'health_certificate', 'fitness_to_travel', 'rabies_vaccination', 'vaccination_record',
  'pre_travel', 'sterilization', 'treatment', 'animal_injury', 'post_mortem',
  'breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation',
  'fitness_for_sale', 'animal_valuation',
]

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
  const [animals, setAnimals] = useState<{ id: string; name: string; species: string; breed?: string }[]>([])
  const [selectedAnimalId, setSelectedAnimalId] = useState(urlAnimalId)
  const [consultations, setConsultations] = useState<{ id: string; label: string }[]>([])
  const [selectedConsultationId, setSelectedConsultationId] = useState(urlConsultationId)
  const [loadingOwners, setLoadingOwners] = useState(false)
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  const [examinationDate, setExaminationDate] = useState(new Date().toISOString().slice(0, 10))

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

  // Preview
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<CertificatePrintData | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CertificateTemplate | null>(null)

  const isVaccRelated = ['rabies_vaccination', 'vaccination_record'].includes(certType)
  const isTravelRelated = ['fitness_to_travel', 'pre_travel'].includes(certType)
  const isBreedingRelated = ['breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation'].includes(certType)
  const isValuation = certType === 'animal_valuation'

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
        // Load owner info
        if (cert.petOwnerId) setSelectedOwnerId(cert.petOwnerId)
      } catch { /* ignore */ }
    }
    loadEdit()
  }, [editId])

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

  // ── Load animals when owner selected ──
  useEffect(() => {
    if (!selectedOwnerId) { setAnimals([]); return }
    const loadAnimals = async () => {
      try {
        setLoadingAnimals(true)
        const res = await apiService.listAnimals({ ownerId: selectedOwnerId, limit: 100 })
        const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
        setAnimals(list.map((a: any) => ({ id: a.id, name: a.name, species: a.species, breed: a.breed })))
        if (list.length === 1 && !selectedAnimalId) setSelectedAnimalId(list[0].id)
      } catch { setAnimals([]) }
      finally { setLoadingAnimals(false) }
    }
    loadAnimals()
  }, [selectedOwnerId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="module-card" style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', padding: '40px 32px' }}>
          <p style={{ fontSize: 48 }}>✅</p>
          <h2>{t('certificateWriter.certificateIssued')}</h2>
          <p style={{ color: '#718096' }}>{certTypeLabel(certType)}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="module-btn" onClick={() => onNavigate('/vet-certificates')}>
              View All Certificates
            </button>
            <button className="module-btn primary" onClick={() => window.location.reload()}>
              + Create Another
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
          ← Back
        </button>
      </div>

      {error && (
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          {error}
          <button className="module-alert-close" onClick={() => setError('')}>✕</button>
        </div>
      )}
      {draftSaved && (
        <div className="module-alert success" style={{ marginBottom: 16 }}>
          ✓ {t('certificateWriter.draftSaved')}
        </div>
      )}

      {/* ── Step indicator ── */}
      <div className="module-tabs" style={{ marginBottom: 24 }}>
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
        <div className="module-card" style={{ padding: '24px 28px' }}>
          <h3 style={{ margin: '0 0 20px' }}>1. {t('certificateWriter.step1')}</h3>

          {/* Certificate type */}
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.selectType')} *</label>
            <select
              className="module-input"
              value={certType}
              onChange={e => setCertType(e.target.value)}
            >
              <option value="">{t('certificateWriter.selectType')}</option>
              {CERT_TYPES.map(ct => (
                <option key={ct} value={ct}>{certTypeLabel(ct)}</option>
              ))}
            </select>
          </div>

          {/* Owner search */}
          <div className="module-form-group" style={{ position: 'relative' }}>
            <label className="module-label">{t('certificateWriter.searchOwner')} *</label>
            <input
              className="module-input"
              type="text"
              placeholder={t('certificateWriter.searchOwner')}
              value={ownerSearch}
              onChange={e => { setOwnerSearch(e.target.value); if (!e.target.value) { setSelectedOwnerId(''); setSelectedOwner(null) } }}
            />
            {loadingOwners && <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>{t('common.loading')}</div>}
            {owners.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                {owners.map(o => (
                  <div
                    key={o.id}
                    onClick={() => selectOwner(o)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f7fafc', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f7fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <strong>{o.name}</strong> <span style={{ color: '#718096' }}>· {o.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Animal select */}
          {selectedOwnerId && (
            <div className="module-form-group">
              <label className="module-label">{t('certificateWriter.selectAnimal')} *</label>
              {loadingAnimals ? (
                <div style={{ fontSize: 13, color: '#718096' }}>{t('common.loading')}</div>
              ) : animals.length === 0 ? (
                <div style={{ fontSize: 13, color: '#e53e3e' }}>{t('certificateWriter.noAnimals')}</div>
              ) : (
                <select
                  className="module-input"
                  value={selectedAnimalId}
                  onChange={e => setSelectedAnimalId(e.target.value)}
                >
                  <option value="">{t('certificateWriter.selectAnimal')}</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.species}{a.breed ? ', ' + a.breed : ''})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {!selectedOwnerId && (
            <p style={{ color: '#718096', fontSize: 13, margin: '4px 0 16px' }}>
              ℹ {t('certificateWriter.selectOwnerFirst')}
            </p>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="module-btn primary"
              disabled={!certType || !selectedOwnerId || !selectedAnimalId}
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
        <div className="module-card" style={{ padding: '24px 28px' }}>
          <h3 style={{ margin: '0 0 20px' }}>2. {t('certificateWriter.step2')}</h3>

          {/* Summary of step 1 */}
          <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
            <strong>{certTypeLabel(certType)}</strong>
            {selectedAnimalId && animals.find(a => a.id === selectedAnimalId) && (
              <span style={{ color: '#4a5568' }}> — {animals.find(a => a.id === selectedAnimalId)?.name}</span>
            )}
            <span style={{ marginLeft: 8, color: '#718096' }}>({selectedOwner?.name || 'Owner'})</span>
          </div>

          {/* Vaccination-specific */}
          {isVaccRelated && (
            <div className="module-form-group">
              <label className="module-label">💉 {t('certificateWriter.vaccinationDetails')}</label>
              {vaccineRows.map((row, i) => (
                <div key={i} style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }}>
                  <div className="module-form-row-3">
                    <div className="module-form-group">
                      <label className="module-label" style={{ fontSize: 11 }}>Vaccine Name</label>
                      <input className="module-input" value={row.vaccine} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, vaccine: e.target.value } : x))} placeholder="e.g. Rabies" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label" style={{ fontSize: 11 }}>Batch No.</label>
                      <input className="module-input" value={row.batchNo} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, batchNo: e.target.value } : x))} placeholder="Batch number" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label" style={{ fontSize: 11 }}>Manufacturer</label>
                      <input className="module-input" value={row.manufacturer} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, manufacturer: e.target.value } : x))} placeholder="Manufacturer" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label" style={{ fontSize: 11 }}>Date Administered</label>
                      <input className="module-input" type="date" value={row.dateAdministered} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, dateAdministered: e.target.value } : x))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label" style={{ fontSize: 11 }}>Next Due</label>
                      <input className="module-input" type="date" value={row.nextDue} onChange={e => setVaccineRows(r => r.map((x, j) => j === i ? { ...x, nextDue: e.target.value } : x))} />
                    </div>
                    <div className="module-form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                      {vaccineRows.length > 1 && (
                        <button className="module-btn small" onClick={() => setVaccineRows(r => r.filter((_, j) => j !== i))} style={{ color: '#e53e3e' }}>
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

          {/* Common clinical fields */}
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.clinicalFindings')}</label>
            <textarea className="module-input" rows={4} value={clinicalFindings} onChange={e => setClinicalFindings(e.target.value)} placeholder={t('certificateWriter.clinicalFindingsPlaceholder')} style={{ resize: 'vertical' }} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.diagnosis')}</label>
            <textarea className="module-input" rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Assessment or diagnostic conclusion..." style={{ resize: 'vertical' }} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.treatmentSummary')}</label>
            <textarea className="module-input" rows={3} value={treatmentSummary} onChange={e => setTreatmentSummary(e.target.value)} placeholder="Describe treatments or procedures performed..." style={{ resize: 'vertical' }} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.recommendations')}</label>
            <textarea className="module-input" rows={2} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Post-certificate recommendations..." style={{ resize: 'vertical' }} />
          </div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('certificateWriter.validUntil')}</label>
              <input className="module-input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} min={examinationDate} />
            </div>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.notes')}</label>
            <textarea className="module-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." style={{ resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap' }}>
            <button className="module-btn" onClick={() => setStep(1)}>← {t('certificateWriter.back')}</button>
            <button className="module-btn primary" onClick={() => setStep(3)}>{t('certificateWriter.next')} →</button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          STEP 3: Review & Issue
      ══════════════════════════════ */}
      {step === 3 && (
        <div className="module-card" style={{ padding: '24px 28px' }}>
          <h3 style={{ margin: '0 0 20px' }}>3. {t('certificateWriter.step3')}</h3>

          {/* Review summary */}
          <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 18px', marginBottom: 24 }}>
            <div style={{ display: 'grid', gap: '8px 20px', gridTemplateColumns: '1fr 1fr', fontSize: 13 }}>
              <div><span style={{ color: '#718096' }}>Certificate Type:</span> <strong>{certTypeLabel(certType)}</strong></div>
              <div><span style={{ color: '#718096' }}>Animal:</span> <strong>{animals.find(a => a.id === selectedAnimalId)?.name || selectedAnimalId}</strong></div>
              <div><span style={{ color: '#718096' }}>Owner:</span> <strong>{selectedOwner?.name || selectedOwnerId}</strong></div>
              <div><span style={{ color: '#718096' }}>Exam Date:</span> <strong>{examinationDate ? formatDate(examinationDate) : '—'}</strong></div>
              <div><span style={{ color: '#718096' }}>Valid Until:</span> <strong>{validUntil ? formatDate(validUntil) : 'No expiry'}</strong></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <button
              className="module-btn"
              onClick={handlePreview}
            >
              👁 {t('certificateWriter.preview')}
            </button>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '12px 14px', fontSize: 13, marginBottom: 20 }}>
            <strong>⚠ Note:</strong>{' '}
            Issuing will assign a permanent certificate number and cannot be undone. Save as draft to review first.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button className="module-btn" onClick={() => setStep(2)} disabled={submitting}>
              ← {t('certificateWriter.back')}
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="module-btn" onClick={handleSaveDraft} disabled={submitting}>
                {submitting ? t('common.saving') : `💾 ${t('certificateWriter.saveDraft')}`}
              </button>
              <button
                className="module-btn primary"
                onClick={handleIssue}
                disabled={submitting || !certType || !selectedAnimalId || !selectedOwnerId}
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

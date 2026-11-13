import React from 'react'
import { TFunction } from 'i18next'
import { VaccineRow, certTypeLabel } from './certificateWriterShared'

interface Animal { id: string; name: string; species: string; breed?: string; uniqueId?: string }
interface Owner { id: string; name: string; email: string }

interface Step2ClinicalDetailsProps {
  t: TFunction
  certType: string
  selectedAnimalId: string
  animals: Animal[]
  selectedOwner: Owner | null
  isVaccRelated: boolean
  vaccineRows: VaccineRow[]
  setVaccineRows: React.Dispatch<React.SetStateAction<VaccineRow[]>>
  isTravelRelated: boolean
  destination: string
  setDestination: (v: string) => void
  departureDate: string
  setDepartureDate: (v: string) => void
  airline: string
  setAirline: (v: string) => void
  isBreedingRelated: boolean
  breedingSoundness: string
  setBreedingSoundness: (v: string) => void
  pregnancyStatus: string
  setPregnancyStatus: (v: string) => void
  estimatedGestation: string
  setEstimatedGestation: (v: string) => void
  isValuation: boolean
  valuationAmount: string
  setValuationAmount: (v: string) => void
  valuationBasis: string
  setValuationBasis: (v: string) => void
  isMovement: boolean
  movementFrom: string
  setMovementFrom: (v: string) => void
  movementTo: string
  setMovementTo: (v: string) => void
  vehicleNumber: string
  setVehicleNumber: (v: string) => void
  transportDate: string
  setTransportDate: (v: string) => void
  driverName: string
  setDriverName: (v: string) => void
  movementPurpose: string
  setMovementPurpose: (v: string) => void
  isHerd: boolean
  herdGroupName: string
  setHerdGroupName: (v: string) => void
  herdAnimalCount: string
  setHerdAnimalCount: (v: string) => void
  herdSpecies: string
  setHerdSpecies: (v: string) => void
  herdPurpose: string
  setHerdPurpose: (v: string) => void
  clinicalFindings: string
  setClinicalFindings: (v: string) => void
  diagnosis: string
  setDiagnosis: (v: string) => void
  treatmentSummary: string
  setTreatmentSummary: (v: string) => void
  recommendations: string
  setRecommendations: (v: string) => void
  validUntil: string
  setValidUntil: (v: string) => void
  examinationDate: string
  notes: string
  setNotes: (v: string) => void
  setStep: (s: number) => void
}

const Step2ClinicalDetails: React.FC<Step2ClinicalDetailsProps> = ({
  t, certType, selectedAnimalId, animals, selectedOwner,
  isVaccRelated, vaccineRows, setVaccineRows,
  isTravelRelated, destination, setDestination, departureDate, setDepartureDate, airline, setAirline,
  isBreedingRelated, breedingSoundness, setBreedingSoundness, pregnancyStatus, setPregnancyStatus, estimatedGestation, setEstimatedGestation,
  isValuation, valuationAmount, setValuationAmount, valuationBasis, setValuationBasis,
  isMovement, movementFrom, setMovementFrom, movementTo, setMovementTo, vehicleNumber, setVehicleNumber, transportDate, setTransportDate, driverName, setDriverName, movementPurpose, setMovementPurpose,
  isHerd, herdGroupName, setHerdGroupName, herdAnimalCount, setHerdAnimalCount, herdSpecies, setHerdSpecies, herdPurpose, setHerdPurpose,
  clinicalFindings, setClinicalFindings, diagnosis, setDiagnosis, treatmentSummary, setTreatmentSummary, recommendations, setRecommendations,
  validUntil, setValidUntil, examinationDate, notes, setNotes, setStep,
}) => (
  <div className="module-card cw-card">
    <h3 className="cw-step-title">2. {t('certificateWriter.step2')}</h3>

    {/* Summary of step 1 */}
    <div className="cw-step-summary">
      <strong className="cw-summary-name">{certTypeLabel(t, certType)}</strong>
      {selectedAnimalId && animals.find(a => a.id === selectedAnimalId) && (
        <span> - {animals.find(a => a.id === selectedAnimalId)?.name}</span>
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
        <button className="module-btn small" onClick={() => setVaccineRows(r => [...r, { vaccine: '', batchNo: '', dateAdministered: '', nextDue: '', manufacturer: '' }])}>
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
              <option value="">- Select -</option>
              <option value="Sound">Sound</option>
              <option value="Questionable">Questionable</option>
              <option value="Unsound">Unsound</option>
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('certificateWriter.pregnancyStatus')}</label>
            <select className="module-input" value={pregnancyStatus} onChange={e => setPregnancyStatus(e.target.value)}>
              <option value="">- Select -</option>
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
            <option value="">- Select purpose -</option>
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
              <option value="">- Select species -</option>
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
              <option value="">- Select purpose -</option>
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
)

export default Step2ClinicalDetails

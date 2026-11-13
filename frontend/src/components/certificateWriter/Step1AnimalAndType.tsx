import React from 'react'
import { TFunction } from 'i18next'
import { GROUP_TYPE_LABELS, AnimalGroupType } from '../../types'
import { CERT_TYPES_PET, CERT_TYPES_FARM, certTypeLabel } from './certificateWriterShared'

interface Owner { id: string; name: string; email: string }
interface Animal { id: string; name: string; species: string; breed?: string; uniqueId?: string }
interface Group { id: string; name: string; groupType?: string; currentCount?: number; species?: string; managementMode?: string; animalCount?: number }
interface Consultation { id: string; label: string }

interface Step1AnimalAndTypeProps {
  t: TFunction
  speciesLabel: (species: string, t: TFunction) => string
  certType: string
  setCertType: (v: string) => void
  isFarmerOrAdmin: boolean
  enterpriseOptions: { id: string; name: string }[]
  selectedEnterpriseId: string
  setSelectedEnterpriseId: (v: string) => void
  ownerSearch: string
  setOwnerSearch: (v: string) => void
  setSelectedOwnerId: (v: string) => void
  setSelectedOwner: (v: Owner | null) => void
  loadingOwners: boolean
  owners: Owner[]
  selectOwner: (o: Owner) => void
  selectedOwnerId: string
  isHerd: boolean
  isGroupCapable: boolean
  selectedAnimalId: string
  setSelectedAnimalId: (v: string) => void
  loadingAnimals: boolean
  animals: Animal[]
  loadingGroups: boolean
  groups: Group[]
  selectedGroupId: string
  selectGroup: (g: Group) => void
  selectedGroup: Group | null
  consultations: Consultation[]
  selectedConsultationId: string
  setSelectedConsultationId: (v: string) => void
  examinationDate: string
  setExaminationDate: (v: string) => void
  setStep: (s: number) => void
}

const Step1AnimalAndType: React.FC<Step1AnimalAndTypeProps> = ({
  t, speciesLabel, certType, setCertType, isFarmerOrAdmin, enterpriseOptions,
  selectedEnterpriseId, setSelectedEnterpriseId, ownerSearch, setOwnerSearch,
  setSelectedOwnerId, setSelectedOwner, loadingOwners, owners, selectOwner, selectedOwnerId,
  isHerd, isGroupCapable, selectedAnimalId, setSelectedAnimalId, loadingAnimals, animals,
  loadingGroups, groups, selectedGroupId, selectGroup, selectedGroup, consultations,
  selectedConsultationId, setSelectedConsultationId, examinationDate, setExaminationDate, setStep,
}) => (
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
            <option key={ct} value={ct}>{certTypeLabel(t, ct)}</option>
          ))}
        </optgroup>
        <optgroup label="🐄 Farm / Enterprise">
          {CERT_TYPES_FARM.map(ct => (
            <option key={ct} value={ct}>{certTypeLabel(t, ct)}</option>
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
          <option value="">- {t('certificateWriter.noEnterprise')} -</option>
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

    {/* Animal select - shown when owner selected OR enterprise selected for farm certs */}
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
            <option value="">{isHerd ? `- ${t('certificateWriter.optionalForHerd')} -` : t('certificateWriter.selectAnimal')}</option>
            {animals.map(a => (
              <option key={a.id} value={a.id}>
                {a.uniqueId ? `[${a.uniqueId}] ` : ''}{a.name} ({speciesLabel(a.species, t)}{a.breed ? ', ' + a.breed : ''})
              </option>
            ))}
          </select>
        )}
      </div>
    )}

    {/* Group subject picker - for batch herd/flock certificates */}
    {isGroupCapable && (
      <div className="module-form-group">
        <label className="module-label">🐄 {t('certificateWriter.selectGroup')}</label>
        {loadingGroups ? (
          <div className="si-ad8ab961">{t('common.loading')}</div>
        ) : groups.length === 0 ? (
          <div className="si-c22a66cc">{t('certificateWriter.noGroups')}</div>
        ) : (
          <select
            className="module-input"
            value={selectedGroupId}
            onChange={e => {
              const g = groups.find(x => x.id === e.target.value)
              selectGroup(g || { id: e.target.value, name: '' })
            }}
          >
            <option value="">- {t('certificateWriter.selectGroup')} -</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.name}{g.groupType ? ` (${GROUP_TYPE_LABELS[g.groupType as AnimalGroupType] || g.groupType})` : ''}
                {g.animalCount != null ? ` · ${g.animalCount} head` : ''}
              </option>
            ))}
          </select>
        )}
        {selectedGroupId && (
          <p className="cw-hint">✓ {t('certificateWriter.groupLinked', { name: selectedGroup?.name || selectedGroupId })}</p>
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
          <option value="">- None -</option>
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
        disabled={!certType || !selectedOwnerId || (!isHerd && !isGroupCapable && !selectedAnimalId) || (isGroupCapable && !selectedAnimalId && !selectedGroupId)}
        onClick={() => setStep(2)}
      >
        {t('certificateWriter.next')} →
      </button>
    </div>
  </div>
)

export default Step1AnimalAndType

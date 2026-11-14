import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Animal } from './herdMedicalShared'

interface AnimalSelectProps {
  animals: Animal[]
  value: string
  onChange: (v: string) => void
  required?: boolean
  speciesLabel: (species: string, t: TFunction) => string
}

const AnimalSelect: React.FC<AnimalSelectProps> = ({ animals, value, onChange, required, speciesLabel }) => {
  const { t } = useTranslation()
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="search-input si-7d984748" required={required}>
      <option value="">{t('herdMedical.selectAnimal')}</option>
      {animals.map(a => (
        <option key={a.id} value={a.id}>
          {a.name} ({speciesLabel(a.species, t)}{a.breed ? ' - ' + a.breed : ''}{a.groupName ? ' | ' + a.groupName : ''})
        </option>
      ))}
    </select>
  )
}

export default AnimalSelect

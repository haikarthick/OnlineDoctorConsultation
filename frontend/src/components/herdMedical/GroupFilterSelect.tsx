import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AnimalGroup } from './herdMedicalShared'

interface GroupFilterSelectProps {
  groups: AnimalGroup[]
  value: string
  onChange: (v: string) => void
  className?: string
}

const GroupFilterSelect: React.FC<GroupFilterSelectProps> = ({ groups, value, onChange, className }) => {
  const { t } = useTranslation()
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className || 'search-input si-4979ce6f'}>
      <option value="">{t('herdMedical.allGroups')}</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  )
}

export default GroupFilterSelect

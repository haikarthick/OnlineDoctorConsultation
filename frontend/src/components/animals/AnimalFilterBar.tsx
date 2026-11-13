import React from 'react'
import type { TFunction } from 'i18next'
import AutocompleteInput from '../AutocompleteInput'
import type { EnterpriseOption, GroupOption } from './animalsShared'

interface Props {
  animalNames: string[]
  searchTerm: string
  setSearchTerm: (v: string) => void
  speciesFilter: string
  setSpeciesFilter: (v: string) => void
  uniqueSpecies: string[]
  isFarmer: boolean
  enterpriseOptions: EnterpriseOption[]
  enterpriseFilter: string
  setEnterpriseFilter: (v: string) => void
  groupOptions: GroupOption[]
  groupFilter: string
  setGroupFilter: (v: string) => void
  filteredCount: number
  t: TFunction
  speciesIcon: (species?: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
}

const AnimalFilterBar: React.FC<Props> = ({
  animalNames, searchTerm, setSearchTerm, speciesFilter, setSpeciesFilter, uniqueSpecies,
  isFarmer, enterpriseOptions, enterpriseFilter, setEnterpriseFilter,
  groupOptions, groupFilter, setGroupFilter, filteredCount, t, speciesIcon, speciesLabel
}) => (
  <div className="si-72baa289">
    <AutocompleteInput
      value={searchTerm}
      onChange={setSearchTerm}
      options={animalNames}
      placeholder={t('animals.searchPlaceholder')}
      className="animals-search"
    />
    <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} className="an-field an-field--w160">
      <option value="">{t('animals.allSpecies')}</option>
      {uniqueSpecies.map(s => <option key={s} value={s}>{speciesIcon(s)} {speciesLabel(s, t)}</option>)}
    </select>
    {isFarmer && enterpriseOptions.length > 0 && (
      <select value={enterpriseFilter} onChange={e => { setEnterpriseFilter(e.target.value); setGroupFilter('') }} className="an-field an-field--w180">
        <option value=''>{t('animals.enterprise.filterByEnterprise')}</option>
        {enterpriseOptions.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
      </select>
    )}
    {isFarmer && enterpriseFilter && groupOptions.length > 0 && (
      <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="an-field an-field--w160">
        <option value=''>{t('animals.enterprise.filterByGroup')}</option>
        {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    )}
    <span className="si-c3b93ebb">{filteredCount} {filteredCount !== 1 ? t('animals.animalsCount') : t('animals.animalCount')}</span>
  </div>
)

export default AnimalFilterBar

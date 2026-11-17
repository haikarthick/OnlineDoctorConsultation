import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../../context/MasterDataContext'
import { ChipSelect } from './ChipSelect'

interface SpeciesPickerProps {
  /** Visible question; also names the chip group for assistive tech. */
  label: string
  /** The species picker groups, already ordered for the signed-in role (useSpeciesCategories). */
  categories: Array<{ label: string; species: string[] }>
  value: string
  onChange: (speciesCode: string) => void
  /** Offer farm animals as the one-tap choices (a farmer), instead of the first few of the list. */
  preferFarm?: boolean
  /** How many one-tap choices to show before "More". */
  featuredCount?: number
}

/** The segments whose animals a farmer keeps most often - offered as one-tap species. */
const COMMON_FARM_SEGMENTS = ['dairy', 'small_ruminant', 'pig', 'poultry']

/**
 * Choose a species with one tap, or open the full list for the rest. Shared by every form that
 * asks "which animal?" so the animal form and the group form behave identically. Which species are
 * one tap is read from master data (a farm segment), not from a list of names in code; the chosen
 * species always shows even when it is not among the first few.
 */
export const SpeciesPicker: React.FC<SpeciesPickerProps> = ({ label, categories, value, onChange, preferFarm = false, featuredCount = 6 }) => {
  const { t } = useTranslation()
  const { farmMaster, speciesLabel, speciesIcon } = useMasterData()
  const [showAll, setShowAll] = useState(false)

  const featured = useMemo(() => {
    const all = categories.flatMap(c => c.species)
    const segmentOf = new Map(farmMaster.species.map(s => [s.code, s.farmSegment as string]))
    const pool = preferFarm ? all.filter(code => COMMON_FARM_SEGMENTS.includes(segmentOf.get(code) || '')) : all
    const picked = pool.slice(0, featuredCount)
    if (value && !picked.includes(value)) picked.push(value)
    return picked
  }, [categories, farmMaster.species, preferFarm, featuredCount, value])

  return (
    <>
      <ChipSelect
        label={label}
        options={featured.map(code => ({ value: code, label: speciesLabel(code, t), icon: speciesIcon(code) }))}
        value={value}
        onChange={onChange}
      />
      <div>
        <button type="button" className="choice-chip" aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>
          {t('farmProfile.form.moreSpecies')}
        </button>
        {showAll && (
          <div className="an-more-species">
            <select className="an-field" value={value} aria-label={label} onChange={e => onChange(e.target.value)}>
              <option value="">{t('animals.form.selectSpecies')}</option>
              {categories.map(cat => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.species.map(code => <option key={code} value={code}>{speciesIcon(code)} {speciesLabel(code, t)}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  )
}

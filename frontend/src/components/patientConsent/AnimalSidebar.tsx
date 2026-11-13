import React from 'react'
import type { Animal } from './patientConsentShared'
import { speciesEmoji } from './patientConsentShared'

interface AnimalSidebarProps {
  animals: Animal[]
  animalsLoading: boolean
  selectedAnimal: Animal | null
  consentCounts: Record<string, number>
  onSelect: (animal: Animal) => void
  speciesLabel: (species: string, t: any) => string
  t: (key: string) => string
}

const AnimalSidebar: React.FC<AnimalSidebarProps> = ({
  animals, animalsLoading, selectedAnimal, consentCounts, onSelect, speciesLabel, t,
}) => (
  <aside className="pc-sidebar">
    <p className="pc-sidebar-title">Your Animals</p>

    {animalsLoading ? (
      <div className="pc-loading"><div className="pc-spinner" /></div>
    ) : animals.length === 0 ? (
      <p className="si-965ccfa5">
        No animals found.
      </p>
    ) : (
      animals.map(animal => {
        const activeCount = consentCounts[animal.id] ?? 0
        const isSelected = selectedAnimal?.id === animal.id
        return (
          <div
            key={animal.id}
            className={'pc-animal-card' + (isSelected ? ' active' : '')}
            onClick={() => onSelect(animal)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onSelect(animal)}
            aria-pressed={isSelected}
          >
            <div className="pc-animal-avatar">{speciesEmoji(animal.species)}</div>
            <div className="pc-animal-info">
              <div className="pc-animal-name">{animal.name}</div>
              <div className="pc-animal-species">{speciesLabel(animal.species, t)}</div>
            </div>
            <span className={'pc-consent-count-badge' + (activeCount === 0 ? ' zero' : '')}>
              {activeCount}
            </span>
          </div>
        )
      })
    )}
  </aside>
)

export default AnimalSidebar

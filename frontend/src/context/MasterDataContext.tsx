import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import apiService from '../services/api'
import {
  SPECIES_CATEGORIES as FALLBACK_SPECIES_CATEGORIES,
  BREED_DATABASE as FALLBACK_BREED_DATABASE,
  ANIMAL_CLASS_TERMS as FALLBACK_ANIMAL_CLASS_TERMS,
  SPECIES_ICONS as FALLBACK_SPECIES_ICONS,
  EAR_TAG_SPECIES as FALLBACK_EAR_TAG_SPECIES,
  AnimalClassTerm,
} from '../constants/speciesBreeds'

// Fallback marketplace categories/conditions — mirrors the pre-migration hardcoded
// CATEGORY_KEYS/condition <option>s in Marketplace.tsx, used only until the live
// master-data fetch resolves (see loadMasterData below).
const FALLBACK_MARKETPLACE_CATEGORIES: MasterMarketplaceCategory[] = [
  { code: 'animal', labelKey: 'marketplace.categories.animals', label: null, icon: null },
  { code: 'feed', labelKey: 'marketplace.categories.feed', label: null, icon: null },
  { code: 'equipment', labelKey: 'marketplace.categories.equipment', label: null, icon: null },
  { code: 'medicine', labelKey: 'marketplace.categories.medicine', label: null, icon: null },
  { code: 'semen_embryo', labelKey: 'marketplace.categories.semenEmbryo', label: null, icon: null },
  { code: 'service', labelKey: 'marketplace.categories.services', label: null, icon: null },
  { code: 'other', labelKey: 'marketplace.categories.other', label: null, icon: null },
]
const FALLBACK_MARKETPLACE_CONDITIONS: MasterMarketplaceCondition[] = [
  { code: 'new', labelKey: 'marketplace.conditionLabel.healthy', label: null },
  { code: 'used', labelKey: 'marketplace.conditionLabel.fair', label: null },
  { code: 'refurbished', labelKey: 'marketplace.conditionLabel.underTreatment', label: null },
]

export interface MasterMarketplaceCategory { code: string; labelKey: string | null; label: string | null; icon: string | null }
export interface MasterMarketplaceCondition { code: string; labelKey: string | null; label: string | null }

interface MasterDataContextType {
  speciesCategories: Array<{ label: string; species: string[] }>
  speciesIcon: (species?: string) => string
  breedsForSpecies: (species?: string) => string[]
  classTermsForSpecies: (species: string) => AnimalClassTerm[]
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined
  earTagSpecies: string[]
  marketplaceCategories: MasterMarketplaceCategory[]
  marketplaceConditions: MasterMarketplaceCondition[]
  /** Resolve a label_key-or-label master-data row to display text (labelKey takes priority when set). */
  resolveLabel: (item: { labelKey?: string | null; label?: string | null }, t: (key: string) => string) => string
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined)

export const MasterDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [breedsBySpecies, setBreedsBySpecies] = useState<Record<string, string[]>>(FALLBACK_BREED_DATABASE)
  const [classesBySpecies, setClassesBySpecies] = useState<Record<string, AnimalClassTerm[]>>(FALLBACK_ANIMAL_CLASS_TERMS)
  const [speciesCategories, setSpeciesCategories] = useState(FALLBACK_SPECIES_CATEGORIES)
  const [speciesIcons, setSpeciesIcons] = useState<Record<string, string>>(FALLBACK_SPECIES_ICONS)
  const [earTagSpecies, setEarTagSpecies] = useState<string[]>(FALLBACK_EAR_TAG_SPECIES)
  const [marketplaceCategories, setMarketplaceCategories] = useState<MasterMarketplaceCategory[]>(FALLBACK_MARKETPLACE_CATEGORIES)
  const [marketplaceConditions, setMarketplaceConditions] = useState<MasterMarketplaceCondition[]>(FALLBACK_MARKETPLACE_CONDITIONS)

  const loadMasterData = useCallback(async () => {
    try {
      const [speciesRes, breedsRes, classesRes, categoriesRes, conditionsRes] = await Promise.all([
        apiService.get('/master-data/species'),
        apiService.get('/master-data/breeds'),
        apiService.get('/master-data/animal-classes'),
        apiService.get('/master-data/marketplace/categories'),
        apiService.get('/master-data/marketplace/conditions'),
      ])

      const species: any[] = speciesRes.data?.data || []
      const breeds: any[] = breedsRes.data?.data || []
      const classes: any[] = classesRes.data?.data || []
      const categories: any[] = categoriesRes.data?.data || []
      const conditions: any[] = conditionsRes.data?.data || []

      if (species.length === 0) return // API not ready / empty DB — keep fallback defaults

      // Rebuild grouped SPECIES_CATEGORIES shape from the flat species list
      const byCategory = new Map<string, string[]>()
      const iconMap: Record<string, string> = {}
      const earTags: string[] = []
      for (const s of [...species].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const cat = s.category || 'Other'
        if (!byCategory.has(cat)) byCategory.set(cat, [])
        byCategory.get(cat)!.push(s.code)
        if (s.icon) iconMap[s.code] = s.icon
        if (s.hasEarTag) earTags.push(s.code)
      }
      setSpeciesCategories([...byCategory.entries()].map(([label, list]) => ({ label, species: list })))
      setSpeciesIcons(iconMap)
      setEarTagSpecies(earTags)

      const breedMap: Record<string, string[]> = {}
      for (const b of [...breeds].sort((a, b2) => a.sortOrder - b2.sortOrder)) {
        if (!breedMap[b.speciesCode]) breedMap[b.speciesCode] = []
        breedMap[b.speciesCode].push(b.name)
      }
      setBreedsBySpecies(breedMap)

      const classMap: Record<string, AnimalClassTerm[]> = {}
      for (const c of [...classes].sort((a, b2) => a.sortOrder - b2.sortOrder)) {
        if (!classMap[c.speciesCode]) classMap[c.speciesCode] = []
        classMap[c.speciesCode].push({
          value: c.value, labelKey: c.labelKey || '', impliedGender: c.impliedGender,
          canBePregnant: c.canBePregnant, canProduceMilk: c.canProduceMilk,
        })
      }
      setClassesBySpecies(classMap)

      if (categories.length > 0) {
        setMarketplaceCategories(categories.sort((a, b) => a.sortOrder - b.sortOrder).map((c: any) => ({ code: c.code, labelKey: c.labelKey, label: c.label, icon: c.icon })))
      }
      if (conditions.length > 0) {
        setMarketplaceConditions(conditions.sort((a, b) => a.sortOrder - b.sortOrder).map((c: any) => ({ code: c.code, labelKey: c.labelKey, label: c.label })))
      }
    } catch {
      // Silently keep fallback defaults — matches SettingsContext's load-failure behavior
    }
  }, [])

  useEffect(() => { loadMasterData() }, [loadMasterData])

  const speciesIcon = useCallback((species?: string): string => {
    if (!species) return '🐾'
    return speciesIcons[species] || '🐾'
  }, [speciesIcons])

  const breedsForSpecies = useCallback((species?: string): string[] => {
    if (!species) return []
    const direct = breedsBySpecies[species]
    if (direct) return direct
    const match = Object.keys(breedsBySpecies).find(k => k.toLowerCase() === species.toLowerCase())
    return match ? breedsBySpecies[match] : ['Mixed Breed', 'Other']
  }, [breedsBySpecies])

  const classTermsForSpecies = useCallback((species: string): AnimalClassTerm[] => {
    return classesBySpecies[species] || []
  }, [classesBySpecies])

  const findClassTerm = useCallback((species: string, value: string): AnimalClassTerm | undefined => {
    return (classesBySpecies[species] || []).find(c => c.value === value)
  }, [classesBySpecies])

  const resolveLabel = useCallback((item: { labelKey?: string | null; label?: string | null }, t: (key: string) => string): string => {
    if (item.labelKey) return t(item.labelKey)
    return item.label || ''
  }, [])

  return (
    <MasterDataContext.Provider value={{
      speciesCategories, speciesIcon, breedsForSpecies, classTermsForSpecies, findClassTerm,
      earTagSpecies, marketplaceCategories, marketplaceConditions, resolveLabel,
    }}>
      {children}
    </MasterDataContext.Provider>
  )
}

export const useMasterData = (): MasterDataContextType => {
  const ctx = useContext(MasterDataContext)
  if (!ctx) throw new Error('useMasterData must be used within MasterDataProvider')
  return ctx
}

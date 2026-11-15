import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import {
  SPECIES_CATEGORIES as FALLBACK_SPECIES_CATEGORIES,
  BREED_DATABASE as FALLBACK_BREED_DATABASE,
  ANIMAL_CLASS_TERMS as FALLBACK_ANIMAL_CLASS_TERMS,
  SPECIES_ICONS as FALLBACK_SPECIES_ICONS,
  EAR_TAG_SPECIES as FALLBACK_EAR_TAG_SPECIES,
  MARKETPLACE_FARMER_SPECIES,
  MARKETPLACE_PET_OWNER_SPECIES,
  AnimalClassTerm,
} from '../constants/speciesBreeds'
import type {
  FarmMaster, FarmSpecies, FarmAnimalClass, FarmGroupType, FarmRecordType, FarmSegment, ManagementMode,
} from '../utils/farmProfile/resolveFarmProfile'
import { groupTypesForSpecies as resolveGroupTypesForSpecies } from '../utils/farmProfile/resolveFarmProfile'
import { GROUP_TYPE_LABELS } from '../types'

// Fallback marketplace-eligible species list - union of the old hardcoded farmer/pet-owner
// arrays, used only until the live master-data fetch resolves (see loadMasterData below).
// The admin-configurable is_marketplace_eligible flag (migration 023) replaces both arrays
// with a single flag per species - see MEMORY.md / marketplace species-picker note.
const FALLBACK_MARKETPLACE_ELIGIBLE_SPECIES = Array.from(new Set([...MARKETPLACE_FARMER_SPECIES, ...MARKETPLACE_PET_OWNER_SPECIES]))

/** Same deterministic transform as migration 024's SQL backfill (lower + non-alnum -> _),
 *  so the pre-load fallback resolves translations immediately instead of showing English
 *  until the /master-data/species fetch completes. */
function deriveLabelKey(code: string): string {
  return `speciesNames.${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}
const FALLBACK_SPECIES_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  Object.keys(FALLBACK_SPECIES_ICONS).map(code => [code, deriveLabelKey(code)])
)

// Fallback marketplace categories/conditions - mirrors the pre-migration hardcoded
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

/** Per-locale label overrides an admin can type on any master-data row (migrations 025/026).
 *  Keyed by locale code; 'en' comes from the row's plain `label`/`name`. */
export interface LocaleLabels { labelHi?: string | null; labelKn?: string | null; labelMl?: string | null; labelTa?: string | null; labelTe?: string | null }

const LOCALE_LABEL_FIELD: Record<string, keyof LocaleLabels> = {
  hi: 'labelHi', kn: 'labelKn', ml: 'labelMl', ta: 'labelTa', te: 'labelTe',
}
/** The admin-typed override for `lang` on a row, or null. English has no per-locale
 *  column - its override is the plain `label`/`name`, handled by callers. */
function localeOverride(item: LocaleLabels, lang: string): string | null {
  const field = LOCALE_LABEL_FIELD[lang]
  return field ? ((item[field] as string | null | undefined) || null) : null
}
/** Extract the 5 per-locale label fields from a raw API row into a LocaleLabels bag. */
function pickLocaleFields(o: any): LocaleLabels {
  return { labelHi: o.labelHi ?? null, labelKn: o.labelKn ?? null, labelMl: o.labelMl ?? null, labelTa: o.labelTa ?? null, labelTe: o.labelTe ?? null }
}

export interface MasterMarketplaceCategory extends LocaleLabels { code: string; labelKey: string | null; label: string | null; icon: string | null }
export interface MasterMarketplaceCondition extends LocaleLabels { code: string; labelKey: string | null; label: string | null }
/** A breed with its canonical English `name` (the stored value) plus optional per-locale display overrides. */
export interface BreedEntry extends LocaleLabels { name: string }

// Breeds carry per-locale display overrides (migration 026); the canonical English `name`
// stays the stored value. Fallback (pre-API) has names only.
const FALLBACK_BREED_ENTRIES: Record<string, BreedEntry[]> = Object.fromEntries(
  Object.entries(FALLBACK_BREED_DATABASE).map(([sp, names]) => [sp, (names as string[]).map(n => ({ name: n }))])
)

/** A group type as a picker shows it: the stored `value` plus its label columns and flags. */
export interface GroupTypeEntry extends LocaleLabels {
  value: string; labelKey: string | null; label: string | null; icon: string | null
  managementMode: ManagementMode | null; suggestedClass: string | null
  isHealthHold: boolean; yieldsMilk: boolean; yieldsEggs: boolean
}
/** A daily record / event type as a tile shows it. Whether it applies comes from useFarmProfile. */
export interface RecordTypeEntry extends LocaleLabels {
  code: string; kind: 'daily' | 'event'; labelKey: string | null; label: string | null; icon: string | null; unit: string | null
}

const EMPTY_FARM_MASTER: FarmMaster = { species: [], classes: [], groupTypes: [], recordTypes: [] }

interface MasterDataContextType {
  speciesCategories: Array<{ label: string; species: string[] }>
  /** Species picker groups ordered for a role: a farmer sees livestock, poultry and aquaculture
   *  first, everyone else sees pets first (the stored sort order). Use via useSpeciesCategories(). */
  speciesCategoriesFor: (role?: string | null) => Array<{ label: string; species: string[] }>
  /** Master data in the shape the farm profile resolver reads. Empty until the first load -
   *  check farmMasterLoaded before relying on a profile. Use via useFarmProfile(). */
  farmMaster: FarmMaster
  farmMasterLoaded: boolean
  /** Group types offered for a species (its own list, else its farm segment's), for pickers. */
  groupTypesForSpecies: (species?: string | null) => GroupTypeEntry[]
  /** Label/icon row for a record type code (milk, eggs, heat ...), or undefined. */
  recordTypeEntry: (code: string) => RecordTypeEntry | undefined
  /**
   * The words for a group's type, whatever screen shows it: the master-data label for the group's
   * species (translated per locale), else the legacy generic label ("Herd", "Pen / Corral") for a
   * group created before group types were master data, else the stored value. Use this instead of
   * printing `group.groupType` or reading a hardcoded label list.
   */
  groupTypeLabel: (species: string | null | undefined, value: string | null | undefined, t: TFunction) => string
  /** The master-data icon for a group type, or null when it has none (legacy values). */
  groupTypeIcon: (species: string | null | undefined, value: string | null | undefined) => string | null
  speciesIcon: (species?: string) => string
  breedsForSpecies: (species?: string) => string[]
  /** Localized display name for a breed (canonical `name` stays the stored value).
   *  Falls back to the English name when no override exists for the current locale. */
  breedLabel: (species: string | undefined, name: string) => string
  classTermsForSpecies: (species: string) => AnimalClassTerm[]
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined
  earTagSpecies: string[]
  /** Species codes eligible for the Marketplace "sell an animal" picker - admin-configurable
   *  via master-data CRUD (is_marketplace_eligible), not a hardcoded list. */
  marketplaceEligibleSpecies: string[]
  /** Translated species display name - replaces rendering the raw species code directly
   *  (e.g. "Buffalo") which never translated regardless of locale. Falls back to the raw
   *  code if no translation key resolves (defensive; every seeded species has one). */
  speciesLabel: (species: string | undefined, t: TFunction) => string
  marketplaceCategories: MasterMarketplaceCategory[]
  marketplaceConditions: MasterMarketplaceCondition[]
  /** Resolve a master-data row to display text for the current locale. Precedence:
   *  per-locale override → English `label` (in en) → built-in labelKey translation → English label. */
  resolveLabel: (item: { labelKey?: string | null; label?: string | null } & LocaleLabels, t: (key: string) => string) => string
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined)

export const MasterDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [breedsBySpecies, setBreedsBySpecies] = useState<Record<string, BreedEntry[]>>(FALLBACK_BREED_ENTRIES)
  const [classesBySpecies, setClassesBySpecies] = useState<Record<string, AnimalClassTerm[]>>(FALLBACK_ANIMAL_CLASS_TERMS)
  const [speciesCategories, setSpeciesCategories] = useState(FALLBACK_SPECIES_CATEGORIES)
  const [speciesIcons, setSpeciesIcons] = useState<Record<string, string>>(FALLBACK_SPECIES_ICONS)
  const [earTagSpecies, setEarTagSpecies] = useState<string[]>(FALLBACK_EAR_TAG_SPECIES)
  const [marketplaceEligibleSpecies, setMarketplaceEligibleSpecies] = useState<string[]>(FALLBACK_MARKETPLACE_ELIGIBLE_SPECIES)
  const [speciesLabelKeys, setSpeciesLabelKeys] = useState<Record<string, string>>(FALLBACK_SPECIES_LABEL_KEYS)
  /** Per-locale label overrides admins typed directly on a species row (migration 025) -
   *  keyed by species code, then by locale ('hi'/'kn'/'ml'/'ta'/'te'; 'en' comes from `label`).
   *  Checked before the labelKey/i18n-key path in speciesLabel() below. */
  const [speciesTranslatedLabels, setSpeciesTranslatedLabels] = useState<Record<string, Record<string, string>>>({})
  const [marketplaceCategories, setMarketplaceCategories] = useState<MasterMarketplaceCategory[]>(FALLBACK_MARKETPLACE_CATEGORIES)
  const [marketplaceConditions, setMarketplaceConditions] = useState<MasterMarketplaceCondition[]>(FALLBACK_MARKETPLACE_CONDITIONS)
  // Farm profile engine (migration 043): the rows the resolver reads, plus the label rows.
  const [farmMaster, setFarmMaster] = useState<FarmMaster>(EMPTY_FARM_MASTER)
  const [farmMasterLoaded, setFarmMasterLoaded] = useState(false)
  const [groupTypeEntries, setGroupTypeEntries] = useState<Record<string, GroupTypeEntry>>({})
  const [recordTypeEntries, setRecordTypeEntries] = useState<Record<string, RecordTypeEntry>>({})
  const { i18n } = useTranslation()

  const loadMasterData = useCallback(async () => {
    try {
      const [speciesRes, breedsRes, classesRes, categoriesRes, conditionsRes] = await Promise.all([
        apiService.get('/master-data/species'),
        apiService.get('/master-data/breeds'),
        apiService.get('/master-data/animal-classes'),
        apiService.get('/master-data/marketplace/categories'),
        apiService.get('/master-data/marketplace/conditions'),
      ])

      // Loaded separately and tolerantly: a failure here must not take the species, breed and
      // class pickers down with it (they are used on every animal form in the app).
      const [groupTypesRes, recordTypesRes] = await Promise.allSettled([
        apiService.get('/master-data/group-types'),
        apiService.get('/master-data/record-types'),
      ])
      const groupTypes: any[] = groupTypesRes.status === 'fulfilled' ? (groupTypesRes.value.data?.data || []) : []
      const recordTypes: any[] = recordTypesRes.status === 'fulfilled' ? (recordTypesRes.value.data?.data || []) : []

      const species: any[] = speciesRes.data?.data || []
      const breeds: any[] = breedsRes.data?.data || []
      const classes: any[] = classesRes.data?.data || []
      const categories: any[] = categoriesRes.data?.data || []
      const conditions: any[] = conditionsRes.data?.data || []

      if (species.length === 0) return // API not ready / empty DB - keep fallback defaults

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
      setMarketplaceEligibleSpecies(species.filter(s => s.isMarketplaceEligible).map(s => s.code))
      const labelKeyMap: Record<string, string> = {}
      const translatedLabelMap: Record<string, Record<string, string>> = {}
      for (const s of species) {
        if (s.labelKey) labelKeyMap[s.code] = s.labelKey
        const overrides: Record<string, string> = {}
        if (s.label) overrides.en = s.label
        if (s.labelHi) overrides.hi = s.labelHi
        if (s.labelKn) overrides.kn = s.labelKn
        if (s.labelMl) overrides.ml = s.labelMl
        if (s.labelTa) overrides.ta = s.labelTa
        if (s.labelTe) overrides.te = s.labelTe
        if (Object.keys(overrides).length > 0) translatedLabelMap[s.code] = overrides
      }
      setSpeciesLabelKeys(labelKeyMap)
      setSpeciesTranslatedLabels(translatedLabelMap)

      const breedMap: Record<string, BreedEntry[]> = {}
      for (const b of [...breeds].sort((a, b2) => a.sortOrder - b2.sortOrder)) {
        if (!breedMap[b.speciesCode]) breedMap[b.speciesCode] = []
        breedMap[b.speciesCode].push({ name: b.name, ...pickLocaleFields(b) })
      }
      setBreedsBySpecies(breedMap)

      const classMap: Record<string, AnimalClassTerm[]> = {}
      for (const c of [...classes].sort((a, b2) => a.sortOrder - b2.sortOrder)) {
        if (!classMap[c.speciesCode]) classMap[c.speciesCode] = []
        classMap[c.speciesCode].push({
          value: c.value, labelKey: c.labelKey || '', label: c.label ?? null, impliedGender: c.impliedGender,
          canBePregnant: c.canBePregnant, canProduceMilk: c.canProduceMilk,
          canLayEggs: !!c.canLayEggs, isJuvenile: !!c.isJuvenile, ...pickLocaleFields(c),
        })
      }
      setClassesBySpecies(classMap)

      // ── Farm profile master (the resolver's input) ──
      const farmSpecies: FarmSpecies[] = species.map((sp: any) => ({
        code: sp.code,
        farmSegment: (sp.farmSegment || 'pet') as FarmSegment,
        hasEarTag: !!sp.hasEarTag,
        defaultManagementMode: (sp.defaultManagementMode === 'batch' ? 'batch' : 'individual') as ManagementMode,
        producesMilk: !!sp.producesMilk, producesEggs: !!sp.producesEggs, producesWool: !!sp.producesWool,
        isAquatic: !!sp.isAquatic, litterExpected: !!sp.litterExpected,
        gestationDays: sp.gestationDays ?? null, incubationDays: sp.incubationDays ?? null,
        birthEventTerm: sp.birthEventTerm || 'birth',
        waterType: sp.waterType ?? null, waterQualityRanges: sp.waterQualityRanges ?? null,
      }))
      const farmClasses: FarmAnimalClass[] = classes.map((c: any) => ({
        speciesCode: c.speciesCode || '', value: c.value, impliedGender: c.impliedGender,
        canBePregnant: !!c.canBePregnant, canProduceMilk: !!c.canProduceMilk,
        canLayEggs: !!c.canLayEggs, isJuvenile: !!c.isJuvenile,
      }))
      const farmGroupTypes: FarmGroupType[] = groupTypes.map((g: any) => ({
        speciesCode: g.speciesCode ?? null, farmSegment: g.farmSegment ?? null, value: g.value,
        managementMode: g.managementMode ?? null, suggestedClass: g.suggestedClass ?? null,
        isHealthHold: !!g.isHealthHold, yieldsMilk: !!g.yieldsMilk, yieldsEggs: !!g.yieldsEggs,
        sortOrder: g.sortOrder ?? 0,
      }))
      const farmRecordTypes: FarmRecordType[] = recordTypes.map((r: any) => ({
        code: r.code, kind: r.kind, subject: r.subject, unit: r.unit ?? null, sortOrder: r.sortOrder ?? 0,
        rules: (r.rules || []).map((rule: any) => ({
          farmSegment: rule.farmSegment ?? null, managementMode: rule.managementMode ?? null,
          requiresSpeciesFlag: rule.requiresSpeciesFlag ?? null, aquatic: rule.aquatic ?? null,
          requiresClassFlag: rule.requiresClassFlag ?? null, requiresGroupFlag: rule.requiresGroupFlag ?? null,
        })),
      }))
      setFarmMaster({ species: farmSpecies, classes: farmClasses, groupTypes: farmGroupTypes, recordTypes: farmRecordTypes })

      // Label rows, keyed so a picker can find the row for a resolver result. A group type is
      // unique per scope, so the key carries the scope ("species:Cattle" / "segment:poultry").
      const gtEntries: Record<string, GroupTypeEntry> = {}
      for (const g of groupTypes) {
        const scope = g.speciesCode ? `species:${g.speciesCode}` : `segment:${g.farmSegment}`
        gtEntries[`${scope}|${g.value}`] = {
          value: g.value, labelKey: g.labelKey ?? null, label: g.label ?? null, icon: g.icon ?? null,
          managementMode: g.managementMode ?? null, suggestedClass: g.suggestedClass ?? null,
          isHealthHold: !!g.isHealthHold, yieldsMilk: !!g.yieldsMilk, yieldsEggs: !!g.yieldsEggs,
          ...pickLocaleFields(g),
        }
      }
      setGroupTypeEntries(gtEntries)
      const rtEntries: Record<string, RecordTypeEntry> = {}
      for (const r of recordTypes) {
        rtEntries[r.code] = {
          code: r.code, kind: r.kind, labelKey: r.labelKey ?? null, label: r.label ?? null,
          icon: r.icon ?? null, unit: r.unit ?? null, ...pickLocaleFields(r),
        }
      }
      setRecordTypeEntries(rtEntries)
      setFarmMasterLoaded(groupTypesRes.status === 'fulfilled' && recordTypesRes.status === 'fulfilled')

      if (categories.length > 0) {
        setMarketplaceCategories(categories.sort((a, b) => a.sortOrder - b.sortOrder).map((c: any) => ({ code: c.code, labelKey: c.labelKey, label: c.label, icon: c.icon, ...pickLocaleFields(c) })))
      }
      if (conditions.length > 0) {
        setMarketplaceConditions(conditions.sort((a, b) => a.sortOrder - b.sortOrder).map((c: any) => ({ code: c.code, labelKey: c.labelKey, label: c.label, ...pickLocaleFields(c) })))
      }
    } catch {
      // Silently keep fallback defaults - matches SettingsContext's load-failure behavior
    }
  }, [])

  useEffect(() => { loadMasterData() }, [loadMasterData])

  const speciesIcon = useCallback((species?: string): string => {
    if (!species) return '🐾'
    return speciesIcons[species] || '🐾'
  }, [speciesIcons])

  const breedEntriesForSpecies = useCallback((species?: string): BreedEntry[] => {
    if (!species) return []
    const direct = breedsBySpecies[species]
    if (direct) return direct
    const match = Object.keys(breedsBySpecies).find(k => k.toLowerCase() === species.toLowerCase())
    return match ? breedsBySpecies[match] : [{ name: 'Mixed Breed' }, { name: 'Other' }]
  }, [breedsBySpecies])

  const breedsForSpecies = useCallback((species?: string): string[] => {
    return breedEntriesForSpecies(species).map(b => b.name)
  }, [breedEntriesForSpecies])

  const breedLabel = useCallback((species: string | undefined, name: string): string => {
    if (!species || !name) return name || ''
    const lang = (i18n.language || 'en').split('-')[0]
    if (lang === 'en') return name
    const entry = breedEntriesForSpecies(species).find(b => b.name === name)
    return (entry && localeOverride(entry, lang)) || name
  }, [breedEntriesForSpecies, i18n.language])

  const classTermsForSpecies = useCallback((species: string): AnimalClassTerm[] => {
    return classesBySpecies[species] || []
  }, [classesBySpecies])

  const findClassTerm = useCallback((species: string, value: string): AnimalClassTerm | undefined => {
    return (classesBySpecies[species] || []).find(c => c.value === value)
  }, [classesBySpecies])

  const resolveLabel = useCallback((item: { labelKey?: string | null; label?: string | null } & LocaleLabels, t: (key: string) => string): string => {
    // Locale-aware, mirroring speciesLabel() so parent (species) and child (class/
    // category/condition) values resolve consistently. Precedence for the current locale:
    //   1. admin-typed per-locale override (label_ta etc.)
    //   2. in English UI, the admin-typed English `label` (rename override)
    //   3. the built-in i18n labelKey translation (seeded rows; label_key only)
    //   4. the English `label` as a last resort (custom rows with no key/translation)
    const lang = (i18n.language || 'en').split('-')[0]
    const override = localeOverride(item, lang)
    if (override) return override
    if (lang === 'en' && item.label) return item.label
    if (item.labelKey) return t(item.labelKey)
    return item.label || ''
  }, [i18n.language])

  const speciesLabel = useCallback((species: string | undefined, t: TFunction): string => {
    if (!species) return ''
    const lang = (i18n.language || 'en').split('-')[0]
    const override = speciesTranslatedLabels[species]?.[lang]
    if (override) return override
    const key = speciesLabelKeys[species]
    if (key) return t(key, species)
    return species
  }, [speciesLabelKeys, speciesTranslatedLabels, i18n.language])

  // Farmers asked to see livestock, poultry and aquaculture before pets. The order is by ROLE,
  // not global: a pet owner still sees pets first. A category counts as "farm" when any of its
  // species belongs to a farm segment - read from data, so a new category needs no code here.
  const speciesCategoriesFor = useCallback((role?: string | null) => {
    if (role !== 'farmer' || farmMaster.species.length === 0) return speciesCategories
    const segmentOf = new Map(farmMaster.species.map(sp => [sp.code, sp.farmSegment]))
    const isFarmCategory = (cat: { species: string[] }) => cat.species.some(code => (segmentOf.get(code) || 'pet') !== 'pet')
    return [...speciesCategories.filter(isFarmCategory), ...speciesCategories.filter(cat => !isFarmCategory(cat))]
  }, [speciesCategories, farmMaster.species])

  const groupTypesForSpecies = useCallback((species?: string | null): GroupTypeEntry[] => {
    return resolveGroupTypesForSpecies(farmMaster, species)
      .map(g => groupTypeEntries[`${g.speciesCode ? `species:${g.speciesCode}` : `segment:${g.farmSegment}`}|${g.value}`])
      .filter((entry): entry is GroupTypeEntry => !!entry)
  }, [farmMaster, groupTypeEntries])

  const recordTypeEntry = useCallback((code: string): RecordTypeEntry | undefined => recordTypeEntries[code], [recordTypeEntries])

  const groupTypeLabel = useCallback((species: string | null | undefined, value: string | null | undefined, t: TFunction): string => {
    if (!value) return ''
    const entry = groupTypesForSpecies(species).find(g => g.value === value)
    if (entry) return resolveLabel(entry, t) || value
    return (GROUP_TYPE_LABELS as Record<string, string>)[value] || value
  }, [groupTypesForSpecies, resolveLabel])

  const groupTypeIcon = useCallback((species: string | null | undefined, value: string | null | undefined): string | null => {
    if (!value) return null
    return groupTypesForSpecies(species).find(g => g.value === value)?.icon || null
  }, [groupTypesForSpecies])

  const value = useMemo(() => ({
    speciesCategories, speciesCategoriesFor, farmMaster, farmMasterLoaded, groupTypesForSpecies, recordTypeEntry,
    groupTypeLabel, groupTypeIcon,
    speciesIcon, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm,
    earTagSpecies, marketplaceEligibleSpecies, speciesLabel, marketplaceCategories, marketplaceConditions, resolveLabel,
  }), [
    speciesCategories, speciesCategoriesFor, farmMaster, farmMasterLoaded, groupTypesForSpecies, recordTypeEntry,
    groupTypeLabel, groupTypeIcon,
    speciesIcon, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm,
    earTagSpecies, marketplaceEligibleSpecies, speciesLabel, marketplaceCategories, marketplaceConditions, resolveLabel,
  ])

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  )
}

export const useMasterData = (): MasterDataContextType => {
  const ctx = useContext(MasterDataContext)
  if (!ctx) throw new Error('useMasterData must be used within MasterDataProvider')
  return ctx
}

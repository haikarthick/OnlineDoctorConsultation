import database from '../utils/database';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MasterSpecies {
  id: string;
  code: string;
  label: string;
  labelKey: string | null;
  /** Per-locale label overrides - admin-typed, take priority over labelKey when present. */
  labelHi: string | null;
  labelKn: string | null;
  labelMl: string | null;
  labelTa: string | null;
  labelTe: string | null;
  icon: string | null;
  category: string | null;
  hasEarTag: boolean;
  sortOrder: number;
  isActive: boolean;
  isProtected: boolean;
  /** Whether this species appears in the Marketplace "sell an animal" species picker. */
  isMarketplaceEligible: boolean;
  /** 'individual' | 'batch' - what a new group of this species defaults to (migration 041). */
  defaultManagementMode: 'individual' | 'batch';
  // Farm profile capability flags (migration 043) - read by the farm profile resolver.
  farmSegment: string;
  producesMilk: boolean;
  producesEggs: boolean;
  producesWool: boolean;
  isAquatic: boolean;
  litterExpected: boolean;
  gestationDays: number | null;
  incubationDays: number | null;
  birthEventTerm: string;
  scientificName: string | null;
  waterType: string | null;
  waterQualityRanges: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-locale label overrides shared by every master-data entity (migrations 025/026).
 *  For breeds these translate `name`; for the others they translate the labelKey/label. */
export interface LocaleLabels {
  labelHi: string | null;
  labelKn: string | null;
  labelMl: string | null;
  labelTa: string | null;
  labelTe: string | null;
}

export interface MasterBreed extends LocaleLabels {
  id: string;
  speciesId: string;
  speciesCode?: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterAnimalClass extends LocaleLabels {
  id: string;
  speciesId: string;
  speciesCode?: string;
  value: string;
  labelKey: string | null;
  label: string | null;
  impliedGender: 'male' | 'female' | 'unknown';
  canBePregnant: boolean;
  canProduceMilk: boolean;
  canLayEggs: boolean;
  /** A juvenile is never asked about pregnancy, births or production. */
  isJuvenile: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Life-stage / purpose group type, scoped to ONE species or to a whole farm segment (migration 043). */
export interface MasterGroupType extends LocaleLabels {
  id: string;
  speciesId: string | null;
  speciesCode: string | null;
  farmSegment: string | null;
  value: string;
  labelKey: string | null;
  label: string;
  icon: string | null;
  managementMode: 'individual' | 'batch' | null;
  suggestedClass: string | null;
  isHealthHold: boolean;
  yieldsMilk: boolean;
  yieldsEggs: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterRecordTypeRule {
  id: string;
  ruleKey: string;
  farmSegment: string | null;
  managementMode: string | null;
  requiresSpeciesFlag: string | null;
  aquatic: boolean | null;
  requiresClassFlag: string | null;
  requiresGroupFlag: string | null;
}

/** A daily record or event a farmer can enter, with the rules saying when it applies (migration 043). */
export interface MasterRecordType extends LocaleLabels {
  id: string;
  code: string;
  kind: 'daily' | 'event';
  subject: 'animal' | 'group' | 'either';
  labelKey: string | null;
  label: string;
  icon: string | null;
  unit: string | null;
  fields: any[];
  sortOrder: number;
  isActive: boolean;
  isProtected: boolean;
  rules: MasterRecordTypeRule[];
  createdAt: string;
  updatedAt: string;
}

export interface MasterMarketplaceCategory extends LocaleLabels {
  id: string;
  code: string;
  labelKey: string | null;
  label: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterMarketplaceCondition extends LocaleLabels {
  id: string;
  code: string;
  labelKey: string | null;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

/** camelCase per-locale label fields from a raw row (label_hi..label_te). */
function mapLocaleLabels(row: any): LocaleLabels {
  return { labelHi: row.label_hi, labelKn: row.label_kn, labelMl: row.label_ml, labelTa: row.label_ta, labelTe: row.label_te };
}

/** DB column names for the per-locale label update field maps, keyed by input field. */
const LOCALE_LABEL_COLUMNS: Record<string, string> = {
  labelHi: 'label_hi', labelKn: 'label_kn', labelMl: 'label_ml', labelTa: 'label_ta', labelTe: 'label_te',
};

/** Optional per-locale label inputs accepted by create/update methods. */
type LocaleLabelInput = { labelHi?: string; labelKn?: string; labelMl?: string; labelTa?: string; labelTe?: string };

function mapSpecies(row: any): MasterSpecies {
  return {
    id: row.id, code: row.code, label: row.label, labelKey: row.label_key,
    labelHi: row.label_hi, labelKn: row.label_kn, labelMl: row.label_ml, labelTa: row.label_ta, labelTe: row.label_te,
    icon: row.icon, category: row.category,
    hasEarTag: row.has_ear_tag, sortOrder: row.sort_order, isActive: row.is_active,
    isProtected: row.is_protected, isMarketplaceEligible: row.is_marketplace_eligible,
    defaultManagementMode: row.default_management_mode || 'individual',
    farmSegment: row.farm_segment || 'pet',
    producesMilk: !!row.produces_milk, producesEggs: !!row.produces_eggs, producesWool: !!row.produces_wool,
    isAquatic: !!row.is_aquatic, litterExpected: !!row.litter_expected,
    gestationDays: row.gestation_days ?? null, incubationDays: row.incubation_days ?? null,
    birthEventTerm: row.birth_event_term || 'birth',
    scientificName: row.scientific_name ?? null, waterType: row.water_type ?? null,
    waterQualityRanges: row.water_quality_ranges ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapGroupType(row: any): MasterGroupType {
  return {
    id: row.id, speciesId: row.species_id ?? null, speciesCode: row.species_code ?? null,
    farmSegment: row.farm_segment ?? null, value: row.value, labelKey: row.label_key, label: row.label,
    icon: row.icon, managementMode: row.management_mode ?? null, suggestedClass: row.suggested_class ?? null,
    isHealthHold: !!row.is_health_hold, yieldsMilk: !!row.yields_milk, yieldsEggs: !!row.yields_eggs,
    sortOrder: row.sort_order, isActive: row.is_active,
    ...mapLocaleLabels(row),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRecordTypeRule(row: any): MasterRecordTypeRule {
  return {
    id: row.id, ruleKey: row.rule_key, farmSegment: row.farm_segment ?? null,
    managementMode: row.management_mode ?? null, requiresSpeciesFlag: row.requires_species_flag ?? null,
    aquatic: row.aquatic ?? null, requiresClassFlag: row.requires_class_flag ?? null,
    requiresGroupFlag: row.requires_group_flag ?? null,
  };
}

function mapRecordType(row: any, rules: MasterRecordTypeRule[]): MasterRecordType {
  return {
    id: row.id, code: row.code, kind: row.kind, subject: row.subject, labelKey: row.label_key, label: row.label,
    icon: row.icon, unit: row.unit ?? null, fields: Array.isArray(row.fields) ? row.fields : [],
    sortOrder: row.sort_order, isActive: row.is_active, isProtected: !!row.is_protected,
    ...mapLocaleLabels(row), rules,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/** Input key -> column for the farm-profile species fields (migration 043), shared by create and update. */
const SPECIES_FARM_COLUMNS: Record<string, string> = {
  defaultManagementMode: 'default_management_mode', farmSegment: 'farm_segment',
  producesMilk: 'produces_milk', producesEggs: 'produces_eggs', producesWool: 'produces_wool',
  isAquatic: 'is_aquatic', litterExpected: 'litter_expected',
  gestationDays: 'gestation_days', incubationDays: 'incubation_days', birthEventTerm: 'birth_event_term',
  scientificName: 'scientific_name', waterType: 'water_type', waterQualityRanges: 'water_quality_ranges',
};

/** Nullable columns where an empty string from a cleared form field means NULL. */
const BLANK_IS_NULL = new Set(['gestation_days', 'incubation_days', 'scientific_name', 'water_type', 'water_quality_ranges', 'management_mode', 'suggested_class', 'unit', 'icon']);

/** Value as it should be bound for `col` - blank to NULL where the column is nullable, JSONB serialised. */
function bindValue(col: string, value: any): any {
  if (BLANK_IS_NULL.has(col) && (value === '' || value === undefined)) return null;
  if (col === 'water_quality_ranges' && value !== null) return JSON.stringify(value);
  return value;
}

type SpeciesFarmInput = {
  defaultManagementMode?: 'individual' | 'batch'; farmSegment?: string;
  producesMilk?: boolean; producesEggs?: boolean; producesWool?: boolean; isAquatic?: boolean; litterExpected?: boolean;
  gestationDays?: number | null; incubationDays?: number | null; birthEventTerm?: string;
  scientificName?: string | null; waterType?: string | null; waterQualityRanges?: Record<string, any> | null;
};

function mapBreed(row: any): MasterBreed {
  return {
    id: row.id, speciesId: row.species_id, speciesCode: row.species_code,
    name: row.name, sortOrder: row.sort_order, isActive: row.is_active,
    ...mapLocaleLabels(row),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapAnimalClass(row: any): MasterAnimalClass {
  return {
    id: row.id, speciesId: row.species_id, speciesCode: row.species_code,
    value: row.value, labelKey: row.label_key, label: row.label,
    impliedGender: row.implied_gender, canBePregnant: row.can_be_pregnant, canProduceMilk: row.can_produce_milk,
    canLayEggs: !!row.can_lay_eggs, isJuvenile: !!row.is_juvenile,
    sortOrder: row.sort_order, isActive: row.is_active,
    ...mapLocaleLabels(row),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapCategory(row: any): MasterMarketplaceCategory {
  return {
    id: row.id, code: row.code, labelKey: row.label_key, label: row.label, icon: row.icon,
    sortOrder: row.sort_order, isActive: row.is_active, isProtected: row.is_protected,
    ...mapLocaleLabels(row),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapCondition(row: any): MasterMarketplaceCondition {
  return {
    id: row.id, code: row.code, labelKey: row.label_key, label: row.label,
    sortOrder: row.sort_order, isActive: row.is_active,
    ...mapLocaleLabels(row),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/** Throws ConflictError if `query` (must return a single `count` column) finds any usage. */
async function assertUnused(query: string, params: any[], entityLabel: string): Promise<void> {
  const result = await database.query(query, params);
  const count = parseInt(result.rows[0]?.count || '0', 10);
  if (count > 0) {
    throw new ConflictError(`Cannot delete ${entityLabel} - it is currently used by ${count} existing record(s). Deactivate it instead.`);
  }
}

class MasterDataService {
  // ═══════════════════════ SPECIES ═══════════════════════

  async listSpecies(activeOnly = false): Promise<MasterSpecies[]> {
    const result = await database.query(
      `SELECT * FROM master_species ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY sort_order, label`,
      []
    );
    return result.rows.map(mapSpecies);
  }

  async createSpecies(input: { code: string; label: string; labelKey?: string; labelHi?: string; labelKn?: string; labelMl?: string; labelTa?: string; labelTe?: string; icon?: string; category?: string; hasEarTag?: boolean; sortOrder?: number; isMarketplaceEligible?: boolean } & SpeciesFarmInput): Promise<MasterSpecies> {
    // A fixed column list (not built dynamically) so the static schema check can read it. The
    // farm-profile values fall back to the same defaults the columns have: segment 'pet' and
    // every capability off, so a species added without them never grows farm sections.
    const result = await database.query(
      `INSERT INTO master_species (code, label, label_key, label_hi, label_kn, label_ml, label_ta, label_te, icon, category, has_ear_tag, sort_order, is_marketplace_eligible,
         default_management_mode, farm_segment, produces_milk, produces_eggs, produces_wool, is_aquatic, litter_expected,
         gestation_days, incubation_days, birth_event_term, scientific_name, water_type, water_quality_ranges)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) RETURNING *`,
      [input.code, input.label, input.labelKey ?? null, input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null, input.icon ?? null, input.category ?? null, input.hasEarTag ?? false, input.sortOrder ?? 0, input.isMarketplaceEligible ?? false,
       input.defaultManagementMode ?? 'individual', input.farmSegment ?? 'pet',
       input.producesMilk ?? false, input.producesEggs ?? false, input.producesWool ?? false, input.isAquatic ?? false, input.litterExpected ?? false,
       bindValue('gestation_days', input.gestationDays), bindValue('incubation_days', input.incubationDays),
       input.birthEventTerm ?? 'birth', bindValue('scientific_name', input.scientificName), bindValue('water_type', input.waterType),
       bindValue('water_quality_ranges', input.waterQualityRanges ?? null)]
    );
    return mapSpecies(result.rows[0]);
  }

  async updateSpecies(id: string, input: { label?: string; labelKey?: string; labelHi?: string; labelKn?: string; labelMl?: string; labelTa?: string; labelTe?: string; icon?: string; category?: string; hasEarTag?: boolean; sortOrder?: number; isMarketplaceEligible?: boolean } & SpeciesFarmInput): Promise<MasterSpecies> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      label: 'label', labelKey: 'label_key',
      labelHi: 'label_hi', labelKn: 'label_kn', labelMl: 'label_ml', labelTa: 'label_ta', labelTe: 'label_te',
      icon: 'icon', category: 'category', hasEarTag: 'has_ear_tag', sortOrder: 'sort_order', isMarketplaceEligible: 'is_marketplace_eligible',
      ...SPECIES_FARM_COLUMNS,
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push(bindValue(col, (input as any)[key])); idx++; }
    }
    if (setClauses.length === 0) {
      const existing = await database.query('SELECT * FROM master_species WHERE id = $1', [id]);
      if (!existing.rows[0]) throw new NotFoundError('Species', id);
      return mapSpecies(existing.rows[0]);
    }
    params.push(id);
    const result = await database.query(`UPDATE master_species SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    if (!result.rows[0]) throw new NotFoundError('Species', id);
    return mapSpecies(result.rows[0]);
  }

  async archiveSpecies(id: string): Promise<void> {
    await database.query('UPDATE master_species SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreSpecies(id: string): Promise<void> {
    await database.query('UPDATE master_species SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async deleteSpecies(id: string): Promise<void> {
    const species = await database.query('SELECT code FROM master_species WHERE id = $1', [id]);
    if (!species.rows[0]) throw new NotFoundError('Species', id);
    const code = species.rows[0].code;
    await assertUnused(
      `SELECT
         (SELECT COUNT(*) FROM animals WHERE species = $1) +
         (SELECT COUNT(*) FROM marketplace_listings WHERE species = $1) +
         (SELECT COUNT(*) FROM animal_groups WHERE species = $1) +
         (SELECT COUNT(*) FROM master_breeds WHERE species_id = $2) +
         (SELECT COUNT(*) FROM master_animal_classes WHERE species_id = $2) +
         (SELECT COUNT(*) FROM master_group_types WHERE species_id = $2) AS count`,
      [code, id], 'this species'
    );
    await database.query('DELETE FROM master_species WHERE id = $1', [id]);
  }

  // ═══════════════════════ BREEDS ═══════════════════════

  async listBreeds(speciesId?: string, activeOnly = false): Promise<MasterBreed[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (speciesId) { params.push(speciesId); conditions.push(`b.species_id = $${params.length}`); }
    if (activeOnly) conditions.push('b.is_active = true');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
      `SELECT b.*, s.code AS species_code FROM master_breeds b
       JOIN master_species s ON s.id = b.species_id
       ${where} ORDER BY b.sort_order, b.name`,
      params
    );
    return result.rows.map(mapBreed);
  }

  async createBreed(input: { speciesId: string; name: string; sortOrder?: number } & LocaleLabelInput): Promise<MasterBreed> {
    const result = await database.query(
      `INSERT INTO master_breeds (species_id, name, sort_order, label_hi, label_kn, label_ml, label_ta, label_te)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [input.speciesId, input.name, input.sortOrder ?? 0,
       input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null]
    );
    return mapBreed(result.rows[0]);
  }

  async updateBreed(id: string, input: { name?: string; sortOrder?: number } & LocaleLabelInput): Promise<MasterBreed> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (input.name !== undefined) { setClauses.push(`name = $${idx}`); params.push(input.name); idx++; }
    if (input.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx}`); params.push(input.sortOrder); idx++; }
    for (const [key, col] of Object.entries(LOCALE_LABEL_COLUMNS)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push((input as any)[key]); idx++; }
    }
    if (setClauses.length === 0) {
      const existing = await database.query('SELECT * FROM master_breeds WHERE id = $1', [id]);
      if (!existing.rows[0]) throw new NotFoundError('Breed', id);
      return mapBreed(existing.rows[0]);
    }

    // animals.breed / animal_groups.breed / group_cycles.breed / marketplace_listings.breed are
    // denormalized text, not FKs (same
    // reasoning as animal_class - see migration 022's header comment). A bare rename here
    // used to leave every existing row holding the old breed string, silently orphaned
    // from the catalog with no error. Renaming now cascades the same text change to every
    // referencing row in the same transaction, so the catalog and the data never drift.
    if (input.name !== undefined) {
      const existing = await database.query(
        `SELECT b.name, s.code AS species_code FROM master_breeds b JOIN master_species s ON s.id = b.species_id WHERE b.id = $1`,
        [id]
      );
      if (!existing.rows[0]) throw new NotFoundError('Breed', id);
      const { name: oldName, species_code: speciesCode } = existing.rows[0];

      if (oldName !== input.name) {
        const client = await database.getPool().connect();
        try {
          await client.query('BEGIN');
          await client.query(`UPDATE animals SET breed = $1 WHERE species = $2 AND breed = $3`, [input.name, speciesCode, oldName]);
          await client.query(`UPDATE animal_groups SET breed = $1 WHERE species = $2 AND breed = $3`, [input.name, speciesCode, oldName]);
          await client.query(`UPDATE group_cycles SET breed = $1 WHERE species = $2 AND breed = $3`, [input.name, speciesCode, oldName]);
          await client.query(`UPDATE marketplace_listings SET breed = $1 WHERE species = $2 AND breed = $3`, [input.name, speciesCode, oldName]);
          params.push(id);
          const result = await client.query(`UPDATE master_breeds SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
          await client.query('COMMIT');
          if (!result.rows[0]) throw new NotFoundError('Breed', id);
          return mapBreed(result.rows[0]);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
    }

    params.push(id);
    const result = await database.query(`UPDATE master_breeds SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    if (!result.rows[0]) throw new NotFoundError('Breed', id);
    return mapBreed(result.rows[0]);
  }

  async archiveBreed(id: string): Promise<void> {
    await database.query('UPDATE master_breeds SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreBreed(id: string): Promise<void> {
    await database.query('UPDATE master_breeds SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async deleteBreed(id: string): Promise<void> {
    const row = await database.query(
      `SELECT b.name, s.code AS species_code FROM master_breeds b JOIN master_species s ON s.id = b.species_id WHERE b.id = $1`,
      [id]
    );
    if (!row.rows[0]) throw new NotFoundError('Breed', id);
    const { name, species_code } = row.rows[0];
    await assertUnused(
      `SELECT
         (SELECT COUNT(*) FROM animals WHERE species = $1 AND breed = $2) +
         (SELECT COUNT(*) FROM animal_groups WHERE species = $1 AND breed = $2) +
         (SELECT COUNT(*) FROM group_cycles WHERE species = $1 AND breed = $2) +
         (SELECT COUNT(*) FROM marketplace_listings WHERE species = $1 AND breed = $2) AS count`,
      [species_code, name], 'this breed'
    );
    await database.query('DELETE FROM master_breeds WHERE id = $1', [id]);
  }

  // ═══════════════════════ ANIMAL CLASSES ═══════════════════════

  async listAnimalClasses(speciesId?: string, activeOnly = false): Promise<MasterAnimalClass[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (speciesId) { params.push(speciesId); conditions.push(`c.species_id = $${params.length}`); }
    if (activeOnly) conditions.push('c.is_active = true');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
      `SELECT c.*, s.code AS species_code FROM master_animal_classes c
       JOIN master_species s ON s.id = c.species_id
       ${where} ORDER BY c.sort_order`,
      params
    );
    return result.rows.map(mapAnimalClass);
  }

  async createAnimalClass(input: {
    speciesId: string; value: string; labelKey?: string; label?: string;
    impliedGender: 'male' | 'female' | 'unknown'; canBePregnant?: boolean; canProduceMilk?: boolean;
    canLayEggs?: boolean; isJuvenile?: boolean; sortOrder?: number;
  } & LocaleLabelInput): Promise<MasterAnimalClass> {
    const result = await database.query(
      `INSERT INTO master_animal_classes (species_id, value, label_key, label, implied_gender, can_be_pregnant, can_produce_milk, sort_order, label_hi, label_kn, label_ml, label_ta, label_te, can_lay_eggs, is_juvenile)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [input.speciesId, input.value, input.labelKey ?? null, input.label ?? null, input.impliedGender, input.canBePregnant ?? false, input.canProduceMilk ?? false, input.sortOrder ?? 0,
       input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null,
       input.canLayEggs ?? false, input.isJuvenile ?? false]
    );
    return mapAnimalClass(result.rows[0]);
  }

  async updateAnimalClass(id: string, input: {
    labelKey?: string; label?: string; impliedGender?: 'male' | 'female' | 'unknown';
    canBePregnant?: boolean; canProduceMilk?: boolean; canLayEggs?: boolean; isJuvenile?: boolean; sortOrder?: number;
  } & LocaleLabelInput): Promise<MasterAnimalClass> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      labelKey: 'label_key', label: 'label', impliedGender: 'implied_gender',
      canBePregnant: 'can_be_pregnant', canProduceMilk: 'can_produce_milk',
      canLayEggs: 'can_lay_eggs', isJuvenile: 'is_juvenile', sortOrder: 'sort_order',
      ...LOCALE_LABEL_COLUMNS,
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push((input as any)[key]); idx++; }
    }
    if (setClauses.length === 0) {
      const existing = await database.query('SELECT * FROM master_animal_classes WHERE id = $1', [id]);
      if (!existing.rows[0]) throw new NotFoundError('Animal class', id);
      return mapAnimalClass(existing.rows[0]);
    }
    params.push(id);
    const result = await database.query(`UPDATE master_animal_classes SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    if (!result.rows[0]) throw new NotFoundError('Animal class', id);
    return mapAnimalClass(result.rows[0]);
  }

  async archiveAnimalClass(id: string): Promise<void> {
    await database.query('UPDATE master_animal_classes SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreAnimalClass(id: string): Promise<void> {
    await database.query('UPDATE master_animal_classes SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async deleteAnimalClass(id: string): Promise<void> {
    const row = await database.query(
      `SELECT c.value, s.code AS species_code FROM master_animal_classes c JOIN master_species s ON s.id = c.species_id WHERE c.id = $1`,
      [id]
    );
    if (!row.rows[0]) throw new NotFoundError('Animal class', id);
    const { value, species_code } = row.rows[0];
    await assertUnused(
      `SELECT
         (SELECT COUNT(*) FROM animals WHERE species = $1 AND animal_class = $2) +
         (SELECT COUNT(*) FROM marketplace_listings WHERE species = $1 AND animal_class = $2) AS count`,
      [species_code, value], 'this class term'
    );
    await database.query('DELETE FROM master_animal_classes WHERE id = $1', [id]);
  }

  // ═══════════════════════ GROUP TYPES (farm profile, migration 043) ═══════════════════════

  async listGroupTypes(filter: { speciesId?: string; farmSegment?: string } = {}, activeOnly = false): Promise<MasterGroupType[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (filter.speciesId) { params.push(filter.speciesId); conditions.push(`g.species_id = $${params.length}`); }
    if (filter.farmSegment) { params.push(filter.farmSegment); conditions.push(`g.farm_segment = $${params.length}`); }
    if (activeOnly) conditions.push('g.is_active = true');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
      `SELECT g.*, s.code AS species_code FROM master_group_types g
       LEFT JOIN master_species s ON s.id = g.species_id
       ${where} ORDER BY s.sort_order NULLS LAST, g.farm_segment NULLS FIRST, g.sort_order, g.label`,
      params
    );
    return result.rows.map(mapGroupType);
  }

  async getGroupType(id: string): Promise<MasterGroupType> {
    const result = await database.query(
      `SELECT g.*, s.code AS species_code FROM master_group_types g LEFT JOIN master_species s ON s.id = g.species_id WHERE g.id = $1`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError('Group type', id);
    return mapGroupType(result.rows[0]);
  }

  async createGroupType(input: {
    speciesId?: string | null; farmSegment?: string | null; value: string; label: string; icon?: string | null;
    managementMode?: 'individual' | 'batch' | '' | null; suggestedClass?: string | null;
    isHealthHold?: boolean; yieldsMilk?: boolean; yieldsEggs?: boolean; sortOrder?: number;
  } & LocaleLabelInput): Promise<MasterGroupType> {
    const speciesId = input.speciesId || null;
    const farmSegment = input.farmSegment || null;
    // A group type belongs to ONE species or to ONE farm segment - never both, never neither.
    if (!!speciesId === !!farmSegment) {
      throw new ValidationError('A group type must belong to either one species or one farm segment - choose exactly one.');
    }
    const duplicate = await database.query(
      `SELECT 1 FROM master_group_types
        WHERE value = $1
          AND (($2::uuid IS NOT NULL AND species_id = $2::uuid) OR ($3::text IS NOT NULL AND farm_segment = $3::text))`,
      [input.value, speciesId, farmSegment]
    );
    if (duplicate.rows.length > 0) {
      throw new ConflictError(`A group type with the code '${input.value}' already exists for this ${speciesId ? 'species' : 'farm segment'}.`);
    }
    const result = await database.query(
      `INSERT INTO master_group_types (species_id, farm_segment, value, label, icon, management_mode, suggested_class, is_health_hold, yields_milk, yields_eggs, sort_order, label_hi, label_kn, label_ml, label_ta, label_te)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
      [speciesId, farmSegment, input.value, input.label, input.icon || null, input.managementMode || null, input.suggestedClass || null,
       input.isHealthHold ?? false, input.yieldsMilk ?? false, input.yieldsEggs ?? false, input.sortOrder ?? 0,
       input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null]
    );
    return this.getGroupType(result.rows[0].id);
  }

  /** The scope (species / segment) and the `value` code are fixed once created: existing groups store the value as text. */
  async updateGroupType(id: string, input: {
    label?: string; icon?: string | null; managementMode?: 'individual' | 'batch' | '' | null; suggestedClass?: string | null;
    isHealthHold?: boolean; yieldsMilk?: boolean; yieldsEggs?: boolean; sortOrder?: number;
  } & LocaleLabelInput): Promise<MasterGroupType> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      label: 'label', icon: 'icon', managementMode: 'management_mode', suggestedClass: 'suggested_class',
      isHealthHold: 'is_health_hold', yieldsMilk: 'yields_milk', yieldsEggs: 'yields_eggs', sortOrder: 'sort_order',
      ...LOCALE_LABEL_COLUMNS,
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push(bindValue(col, (input as any)[key])); idx++; }
    }
    if (setClauses.length > 0) {
      params.push(id);
      const result = await database.query(`UPDATE master_group_types SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id`, params);
      if (!result.rows[0]) throw new NotFoundError('Group type', id);
    }
    return this.getGroupType(id);
  }

  async archiveGroupType(id: string): Promise<void> {
    await database.query('UPDATE master_group_types SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreGroupType(id: string): Promise<void> {
    await database.query('UPDATE master_group_types SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async deleteGroupType(id: string): Promise<void> {
    const row = await database.query(
      `SELECT g.value, g.farm_segment, s.code AS species_code FROM master_group_types g LEFT JOIN master_species s ON s.id = g.species_id WHERE g.id = $1`,
      [id]
    );
    if (!row.rows[0]) throw new NotFoundError('Group type', id);
    const { value, farm_segment, species_code } = row.rows[0];
    // In use = a group of this species (or of any species in this segment) stores this value.
    await assertUnused(
      `SELECT COUNT(*) AS count FROM animal_groups ag
        WHERE ag.group_type = $1
          AND (($2::text IS NOT NULL AND ag.species = $2::text)
            OR ($3::text IS NOT NULL AND ag.species IN (SELECT code FROM master_species WHERE farm_segment = $3::text)))`,
      [value, species_code, farm_segment], 'this group type'
    );
    await database.query('DELETE FROM master_group_types WHERE id = $1', [id]);
  }

  // ═══════════════════════ RECORD TYPES (farm profile, migration 043) ═══════════════════════
  // Record types are captured by application code keyed on `code`, so they are not created or
  // deleted from the admin screen - an admin tunes wording, icon, order and whether it is offered.

  async listRecordTypes(activeOnly = false): Promise<MasterRecordType[]> {
    const types = await database.query(
      `SELECT * FROM master_record_types ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY sort_order, code`,
      []
    );
    const rules = await database.query('SELECT * FROM master_record_type_rules ORDER BY rule_key', []);
    const rulesByType = new Map<string, MasterRecordTypeRule[]>();
    for (const r of rules.rows) {
      if (!rulesByType.has(r.record_type_id)) rulesByType.set(r.record_type_id, []);
      rulesByType.get(r.record_type_id)!.push(mapRecordTypeRule(r));
    }
    return types.rows.map((row: any) => mapRecordType(row, rulesByType.get(row.id) || []));
  }

  async updateRecordType(id: string, input: { label?: string; icon?: string | null; unit?: string | null; sortOrder?: number } & LocaleLabelInput): Promise<MasterRecordType> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = { label: 'label', icon: 'icon', unit: 'unit', sortOrder: 'sort_order', ...LOCALE_LABEL_COLUMNS };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push(bindValue(col, (input as any)[key])); idx++; }
    }
    if (setClauses.length > 0) {
      params.push(id);
      const result = await database.query(`UPDATE master_record_types SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id`, params);
      if (!result.rows[0]) throw new NotFoundError('Record type', id);
    }
    const found = (await this.listRecordTypes(false)).find(r => r.id === id);
    if (!found) throw new NotFoundError('Record type', id);
    return found;
  }

  async archiveRecordType(id: string): Promise<void> {
    await database.query('UPDATE master_record_types SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreRecordType(id: string): Promise<void> {
    await database.query('UPDATE master_record_types SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  // ═══════════════════════ MARKETPLACE CATEGORIES ═══════════════════════

  async listMarketplaceCategories(activeOnly = false): Promise<MasterMarketplaceCategory[]> {
    const result = await database.query(
      `SELECT * FROM master_marketplace_categories ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY sort_order`,
      []
    );
    return result.rows.map(mapCategory);
  }

  async createMarketplaceCategory(input: { code: string; labelKey?: string; label?: string; icon?: string; sortOrder?: number } & LocaleLabelInput): Promise<MasterMarketplaceCategory> {
    const result = await database.query(
      `INSERT INTO master_marketplace_categories (code, label_key, label, icon, sort_order, label_hi, label_kn, label_ml, label_ta, label_te)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [input.code, input.labelKey ?? null, input.label ?? null, input.icon ?? null, input.sortOrder ?? 0,
       input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null]
    );
    return mapCategory(result.rows[0]);
  }

  async updateMarketplaceCategory(id: string, input: { labelKey?: string; label?: string; icon?: string; sortOrder?: number } & LocaleLabelInput): Promise<MasterMarketplaceCategory> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = { labelKey: 'label_key', label: 'label', icon: 'icon', sortOrder: 'sort_order', ...LOCALE_LABEL_COLUMNS };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push((input as any)[key]); idx++; }
    }
    if (setClauses.length === 0) {
      const existing = await database.query('SELECT * FROM master_marketplace_categories WHERE id = $1', [id]);
      if (!existing.rows[0]) throw new NotFoundError('Marketplace category', id);
      return mapCategory(existing.rows[0]);
    }
    params.push(id);
    const result = await database.query(`UPDATE master_marketplace_categories SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    if (!result.rows[0]) throw new NotFoundError('Marketplace category', id);
    return mapCategory(result.rows[0]);
  }

  async archiveMarketplaceCategory(id: string): Promise<void> {
    await database.query('UPDATE master_marketplace_categories SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreMarketplaceCategory(id: string): Promise<void> {
    await database.query('UPDATE master_marketplace_categories SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async deleteMarketplaceCategory(id: string): Promise<void> {
    const row = await database.query('SELECT code, is_protected FROM master_marketplace_categories WHERE id = $1', [id]);
    if (!row.rows[0]) throw new NotFoundError('Marketplace category', id);
    const { code, is_protected } = row.rows[0];
    if (is_protected) {
      throw new ConflictError(`Cannot delete '${code}' - this category is protected because core marketplace logic depends on its exact code. Deactivate it instead if you need to hide it.`);
    }
    await assertUnused('SELECT COUNT(*) AS count FROM marketplace_listings WHERE category = $1', [code], 'this category');
    await database.query('DELETE FROM master_marketplace_categories WHERE id = $1', [id]);
  }

  // ═══════════════════════ MARKETPLACE CONDITIONS ═══════════════════════

  async listMarketplaceConditions(activeOnly = false): Promise<MasterMarketplaceCondition[]> {
    const result = await database.query(
      `SELECT * FROM master_marketplace_conditions ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY sort_order`,
      []
    );
    return result.rows.map(mapCondition);
  }

  async createMarketplaceCondition(input: { code: string; labelKey?: string; label?: string; sortOrder?: number } & LocaleLabelInput): Promise<MasterMarketplaceCondition> {
    const result = await database.query(
      `INSERT INTO master_marketplace_conditions (code, label_key, label, sort_order, label_hi, label_kn, label_ml, label_ta, label_te)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [input.code, input.labelKey ?? null, input.label ?? null, input.sortOrder ?? 0,
       input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null]
    );
    return mapCondition(result.rows[0]);
  }

  async updateMarketplaceCondition(id: string, input: { labelKey?: string; label?: string; sortOrder?: number } & LocaleLabelInput): Promise<MasterMarketplaceCondition> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = { labelKey: 'label_key', label: 'label', sortOrder: 'sort_order', ...LOCALE_LABEL_COLUMNS };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push((input as any)[key]); idx++; }
    }
    if (setClauses.length === 0) {
      const existing = await database.query('SELECT * FROM master_marketplace_conditions WHERE id = $1', [id]);
      if (!existing.rows[0]) throw new NotFoundError('Marketplace condition', id);
      return mapCondition(existing.rows[0]);
    }
    params.push(id);
    const result = await database.query(`UPDATE master_marketplace_conditions SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    if (!result.rows[0]) throw new NotFoundError('Marketplace condition', id);
    return mapCondition(result.rows[0]);
  }

  async archiveMarketplaceCondition(id: string): Promise<void> {
    await database.query('UPDATE master_marketplace_conditions SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async restoreMarketplaceCondition(id: string): Promise<void> {
    await database.query('UPDATE master_marketplace_conditions SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  async deleteMarketplaceCondition(id: string): Promise<void> {
    const row = await database.query('SELECT code FROM master_marketplace_conditions WHERE id = $1', [id]);
    if (!row.rows[0]) throw new NotFoundError('Marketplace condition', id);
    const { code } = row.rows[0];
    await assertUnused('SELECT COUNT(*) AS count FROM marketplace_listings WHERE condition = $1', [code], 'this condition');
    await database.query('DELETE FROM master_marketplace_conditions WHERE id = $1', [id]);
  }
}

export default new MasterDataService();

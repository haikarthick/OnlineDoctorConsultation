import database from '../utils/database';
import { NotFoundError, ConflictError } from '../utils/errors';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MasterSpecies {
  id: string;
  code: string;
  label: string;
  labelKey: string | null;
  /** Per-locale label overrides — admin-typed, take priority over labelKey when present. */
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
  createdAt: string;
  updatedAt: string;
}

export interface MasterBreed {
  id: string;
  speciesId: string;
  speciesCode?: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterAnimalClass {
  id: string;
  speciesId: string;
  speciesCode?: string;
  value: string;
  labelKey: string | null;
  label: string | null;
  impliedGender: 'male' | 'female' | 'unknown';
  canBePregnant: boolean;
  canProduceMilk: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterMarketplaceCategory {
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

export interface MasterMarketplaceCondition {
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

function mapSpecies(row: any): MasterSpecies {
  return {
    id: row.id, code: row.code, label: row.label, labelKey: row.label_key,
    labelHi: row.label_hi, labelKn: row.label_kn, labelMl: row.label_ml, labelTa: row.label_ta, labelTe: row.label_te,
    icon: row.icon, category: row.category,
    hasEarTag: row.has_ear_tag, sortOrder: row.sort_order, isActive: row.is_active,
    isProtected: row.is_protected, isMarketplaceEligible: row.is_marketplace_eligible,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapBreed(row: any): MasterBreed {
  return {
    id: row.id, speciesId: row.species_id, speciesCode: row.species_code,
    name: row.name, sortOrder: row.sort_order, isActive: row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapAnimalClass(row: any): MasterAnimalClass {
  return {
    id: row.id, speciesId: row.species_id, speciesCode: row.species_code,
    value: row.value, labelKey: row.label_key, label: row.label,
    impliedGender: row.implied_gender, canBePregnant: row.can_be_pregnant, canProduceMilk: row.can_produce_milk,
    sortOrder: row.sort_order, isActive: row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapCategory(row: any): MasterMarketplaceCategory {
  return {
    id: row.id, code: row.code, labelKey: row.label_key, label: row.label, icon: row.icon,
    sortOrder: row.sort_order, isActive: row.is_active, isProtected: row.is_protected,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapCondition(row: any): MasterMarketplaceCondition {
  return {
    id: row.id, code: row.code, labelKey: row.label_key, label: row.label,
    sortOrder: row.sort_order, isActive: row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/** Throws ConflictError if `query` (must return a single `count` column) finds any usage. */
async function assertUnused(query: string, params: any[], entityLabel: string): Promise<void> {
  const result = await database.query(query, params);
  const count = parseInt(result.rows[0]?.count || '0', 10);
  if (count > 0) {
    throw new ConflictError(`Cannot delete ${entityLabel} — it is currently used by ${count} existing record(s). Deactivate it instead.`);
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

  async createSpecies(input: { code: string; label: string; labelKey?: string; labelHi?: string; labelKn?: string; labelMl?: string; labelTa?: string; labelTe?: string; icon?: string; category?: string; hasEarTag?: boolean; sortOrder?: number; isMarketplaceEligible?: boolean }): Promise<MasterSpecies> {
    const result = await database.query(
      `INSERT INTO master_species (code, label, label_key, label_hi, label_kn, label_ml, label_ta, label_te, icon, category, has_ear_tag, sort_order, is_marketplace_eligible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [input.code, input.label, input.labelKey ?? null, input.labelHi ?? null, input.labelKn ?? null, input.labelMl ?? null, input.labelTa ?? null, input.labelTe ?? null, input.icon ?? null, input.category ?? null, input.hasEarTag ?? false, input.sortOrder ?? 0, input.isMarketplaceEligible ?? false]
    );
    return mapSpecies(result.rows[0]);
  }

  async updateSpecies(id: string, input: { label?: string; labelKey?: string; labelHi?: string; labelKn?: string; labelMl?: string; labelTa?: string; labelTe?: string; icon?: string; category?: string; hasEarTag?: boolean; sortOrder?: number; isMarketplaceEligible?: boolean }): Promise<MasterSpecies> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      label: 'label', labelKey: 'label_key',
      labelHi: 'label_hi', labelKn: 'label_kn', labelMl: 'label_ml', labelTa: 'label_ta', labelTe: 'label_te',
      icon: 'icon', category: 'category', hasEarTag: 'has_ear_tag', sortOrder: 'sort_order', isMarketplaceEligible: 'is_marketplace_eligible',
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) { setClauses.push(`${col} = $${idx}`); params.push((input as any)[key]); idx++; }
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
         (SELECT COUNT(*) FROM master_breeds WHERE species_id = $2) +
         (SELECT COUNT(*) FROM master_animal_classes WHERE species_id = $2) AS count`,
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

  async createBreed(input: { speciesId: string; name: string; sortOrder?: number }): Promise<MasterBreed> {
    const result = await database.query(
      `INSERT INTO master_breeds (species_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [input.speciesId, input.name, input.sortOrder ?? 0]
    );
    return mapBreed(result.rows[0]);
  }

  async updateBreed(id: string, input: { name?: string; sortOrder?: number }): Promise<MasterBreed> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (input.name !== undefined) { setClauses.push(`name = $${idx}`); params.push(input.name); idx++; }
    if (input.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx}`); params.push(input.sortOrder); idx++; }
    if (setClauses.length === 0) {
      const existing = await database.query('SELECT * FROM master_breeds WHERE id = $1', [id]);
      if (!existing.rows[0]) throw new NotFoundError('Breed', id);
      return mapBreed(existing.rows[0]);
    }

    // animals.breed / marketplace_listings.breed are denormalized text, not FKs (same
    // reasoning as animal_class — see migration 022's header comment). A bare rename here
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
    impliedGender: 'male' | 'female' | 'unknown'; canBePregnant?: boolean; canProduceMilk?: boolean; sortOrder?: number;
  }): Promise<MasterAnimalClass> {
    const result = await database.query(
      `INSERT INTO master_animal_classes (species_id, value, label_key, label, implied_gender, can_be_pregnant, can_produce_milk, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [input.speciesId, input.value, input.labelKey ?? null, input.label ?? null, input.impliedGender, input.canBePregnant ?? false, input.canProduceMilk ?? false, input.sortOrder ?? 0]
    );
    return mapAnimalClass(result.rows[0]);
  }

  async updateAnimalClass(id: string, input: {
    labelKey?: string; label?: string; impliedGender?: 'male' | 'female' | 'unknown';
    canBePregnant?: boolean; canProduceMilk?: boolean; sortOrder?: number;
  }): Promise<MasterAnimalClass> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      labelKey: 'label_key', label: 'label', impliedGender: 'implied_gender',
      canBePregnant: 'can_be_pregnant', canProduceMilk: 'can_produce_milk', sortOrder: 'sort_order',
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

  // ═══════════════════════ MARKETPLACE CATEGORIES ═══════════════════════

  async listMarketplaceCategories(activeOnly = false): Promise<MasterMarketplaceCategory[]> {
    const result = await database.query(
      `SELECT * FROM master_marketplace_categories ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY sort_order`,
      []
    );
    return result.rows.map(mapCategory);
  }

  async createMarketplaceCategory(input: { code: string; labelKey?: string; label?: string; icon?: string; sortOrder?: number }): Promise<MasterMarketplaceCategory> {
    const result = await database.query(
      `INSERT INTO master_marketplace_categories (code, label_key, label, icon, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.code, input.labelKey ?? null, input.label ?? null, input.icon ?? null, input.sortOrder ?? 0]
    );
    return mapCategory(result.rows[0]);
  }

  async updateMarketplaceCategory(id: string, input: { labelKey?: string; label?: string; icon?: string; sortOrder?: number }): Promise<MasterMarketplaceCategory> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = { labelKey: 'label_key', label: 'label', icon: 'icon', sortOrder: 'sort_order' };
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
      throw new ConflictError(`Cannot delete '${code}' — this category is protected because core marketplace logic depends on its exact code. Deactivate it instead if you need to hide it.`);
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

  async createMarketplaceCondition(input: { code: string; labelKey?: string; label?: string; sortOrder?: number }): Promise<MasterMarketplaceCondition> {
    const result = await database.query(
      `INSERT INTO master_marketplace_conditions (code, label_key, label, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.code, input.labelKey ?? null, input.label ?? null, input.sortOrder ?? 0]
    );
    return mapCondition(result.rows[0]);
  }

  async updateMarketplaceCondition(id: string, input: { labelKey?: string; label?: string; sortOrder?: number }): Promise<MasterMarketplaceCondition> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = { labelKey: 'label_key', label: 'label', sortOrder: 'sort_order' };
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

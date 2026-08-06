import database from '../utils/database';
import logger from '../utils/logger';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface VaccineProtocol {
  id: string;
  name: string;
  disease: string;
  species: string[];
  applicableGender: 'all' | 'male' | 'female';
  minAgeWeeks: number | null;
  maxAgeWeeks: number | null;
  vaccineCategory: 'core' | 'non_core' | 'mandatory_govt' | 'legally_mandated';
  isZoonotic: boolean;
  initialDoseAgeWeeks: number | null;
  boosterIntervalDays: number;
  seriesDoseCount: number;
  seriesIntervalDays: number;
  route: string;
  dosageMl: string | null;
  site: string | null;
  regulatoryBody: string | null;
  regulatoryStandard: string | null;
  seasonalWindow: string | null;
  country: string;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaccineProtocolChange {
  id: string;
  protocolId: string;
  protocolName?: string;
  changedField: string;
  oldValue: string | null;
  newValue: string | null;
  changeReason: string | null;
  regulatoryStandard: string | null;
  effectiveDate: string;
  changedBy: string | null;
  changedByName?: string;
  createdAt: string;
}

export interface CreateProtocolInput {
  name: string;
  disease: string;
  species: string[];
  applicableGender?: 'all' | 'male' | 'female';
  minAgeWeeks?: number | null;
  maxAgeWeeks?: number | null;
  vaccineCategory?: 'core' | 'non_core' | 'mandatory_govt' | 'legally_mandated';
  isZoonotic?: boolean;
  initialDoseAgeWeeks?: number | null;
  boosterIntervalDays?: number;
  seriesDoseCount?: number;
  seriesIntervalDays?: number;
  route?: string;
  dosageMl?: string | null;
  site?: string | null;
  regulatoryBody?: string | null;
  regulatoryStandard?: string | null;
  seasonalWindow?: string | null;
  country?: string;
  notes?: string | null;
  createdBy?: string;
}

export interface AddProtocolChangeInput {
  protocolId: string;
  changedField: string;
  oldValue?: string | null;
  newValue: string;
  changeReason?: string | null;
  regulatoryStandard?: string | null;
  effectiveDate?: string;
  changedBy?: string;
}

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(row: any): VaccineProtocol {
  return {
    id: row.id,
    name: row.name,
    disease: row.disease,
    species: row.species || [],
    applicableGender: row.applicable_gender,
    minAgeWeeks: row.min_age_weeks,
    maxAgeWeeks: row.max_age_weeks,
    vaccineCategory: row.vaccine_category,
    isZoonotic: row.is_zoonotic,
    initialDoseAgeWeeks: row.initial_dose_age_weeks,
    boosterIntervalDays: row.booster_interval_days,
    seriesDoseCount: row.series_dose_count,
    seriesIntervalDays: row.series_interval_days,
    route: row.route,
    dosageMl: row.dosage_ml,
    site: row.site,
    regulatoryBody: row.regulatory_body,
    regulatoryStandard: row.regulatory_standard,
    seasonalWindow: row.seasonal_window,
    country: row.country,
    isActive: row.is_active,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChangeRow(row: any): VaccineProtocolChange {
  return {
    id: row.id,
    protocolId: row.protocol_id,
    protocolName: row.protocol_name,
    changedField: row.changed_field,
    oldValue: row.old_value,
    newValue: row.new_value,
    changeReason: row.change_reason,
    regulatoryStandard: row.regulatory_standard,
    effectiveDate: row.effective_date,
    changedBy: row.changed_by,
    changedByName: row.changed_by_name,
    createdAt: row.created_at,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

class VaccineProtocolService {
  // ── LIST / GET ────────────────────────────────────────────────

  async listProtocols(filters: {
    species?: string;
    activeOnly?: boolean;
    category?: string;
    country?: string;
  } = {}): Promise<VaccineProtocol[]> {
    let query = `SELECT * FROM vaccine_protocols WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters.activeOnly !== false) {
      query += ` AND is_active = true`;
    }
    if (filters.species) {
      query += ` AND LOWER($${idx}) = ANY(SELECT LOWER(s) FROM unnest(species) s)`;
      params.push(filters.species);
      idx++;
    }
    if (filters.category) {
      query += ` AND vaccine_category = $${idx}`;
      params.push(filters.category);
      idx++;
    }
    if (filters.country) {
      query += ` AND (country = $${idx} OR country = 'ALL')`;
      params.push(filters.country);
      idx++;
    }

    query += ` ORDER BY vaccine_category, name`;

    const result = await database.query(query, params);
    return result.rows.map(mapRow);
  }

  async getProtocol(id: string): Promise<VaccineProtocol | null> {
    const result = await database.query(
      `SELECT * FROM vaccine_protocols WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  /**
   * Get protocols applicable to an animal based on species, gender, age.
   * ageWeeks = null → ignore age filter
   */
  async getProtocolsForAnimal(
    species: string,
    gender: string,
    ageWeeks: number | null
  ): Promise<VaccineProtocol[]> {
    let query = `
      SELECT * FROM vaccine_protocols
      WHERE is_active = true
        AND $1 = ANY(species)
        AND (applicable_gender = 'all' OR applicable_gender = $2)
    `;
    const params: any[] = [species, gender === 'male' ? 'male' : 'female'];
    let idx = 3;

    if (ageWeeks !== null) {
      query += ` AND (min_age_weeks IS NULL OR min_age_weeks <= $${idx})`;
      params.push(ageWeeks);
      idx++;
      query += ` AND (max_age_weeks IS NULL OR max_age_weeks >= $${idx})`;
      params.push(ageWeeks);
      idx++;
    }

    query += ` ORDER BY vaccine_category, name`;
    const result = await database.query(query, params);
    return result.rows.map(mapRow);
  }

  // ── CREATE / UPDATE / DELETE ──────────────────────────────────

  async createProtocol(input: CreateProtocolInput): Promise<VaccineProtocol> {
    const result = await database.query(
      `INSERT INTO vaccine_protocols (
        name, disease, species, applicable_gender, min_age_weeks, max_age_weeks,
        vaccine_category, is_zoonotic, initial_dose_age_weeks, booster_interval_days,
        series_dose_count, series_interval_days, route, dosage_ml, site,
        regulatory_body, regulatory_standard, seasonal_window, country, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        input.name, input.disease, input.species || [],
        input.applicableGender || 'all',
        input.minAgeWeeks ?? null, input.maxAgeWeeks ?? null,
        input.vaccineCategory || 'core',
        input.isZoonotic ?? false,
        input.initialDoseAgeWeeks ?? null,
        input.boosterIntervalDays ?? 365,
        input.seriesDoseCount ?? 1,
        input.seriesIntervalDays ?? 21,
        input.route || 'intramuscular',
        input.dosageMl ?? null, input.site ?? null,
        input.regulatoryBody ?? null, input.regulatoryStandard ?? null,
        input.seasonalWindow ?? null,
        input.country || 'ALL',
        input.notes ?? null, input.createdBy ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  async updateProtocol(
    id: string,
    input: Partial<CreateProtocolInput>,
    changedBy?: string
  ): Promise<VaccineProtocol> {
    // First fetch current values to log changes
    const current = await this.getProtocol(id);
    if (!current) throw new Error('Protocol not found');

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', disease: 'disease', species: 'species',
      applicableGender: 'applicable_gender', minAgeWeeks: 'min_age_weeks',
      maxAgeWeeks: 'max_age_weeks', vaccineCategory: 'vaccine_category',
      isZoonotic: 'is_zoonotic', initialDoseAgeWeeks: 'initial_dose_age_weeks',
      boosterIntervalDays: 'booster_interval_days', seriesDoseCount: 'series_dose_count',
      seriesIntervalDays: 'series_interval_days', route: 'route',
      dosageMl: 'dosage_ml', site: 'site', regulatoryBody: 'regulatory_body',
      regulatoryStandard: 'regulatory_standard', seasonalWindow: 'seasonal_window',
      country: 'country', notes: 'notes',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in input && (input as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx}`);
        params.push((input as any)[key]);
        idx++;
      }
    }

    if (setClauses.length === 0) return current;

    params.push(id);
    const result = await database.query(
      `UPDATE vaccine_protocols SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING *`,
      params
    );
    return mapRow(result.rows[0]);
  }

  async archiveProtocol(id: string): Promise<void> {
    await database.query(
      `UPDATE vaccine_protocols SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async restoreProtocol(id: string): Promise<void> {
    await database.query(
      `UPDATE vaccine_protocols SET is_active = true, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  // ── REGULATORY CHANGE TRACKING ────────────────────────────────

  async addProtocolChange(input: AddProtocolChangeInput): Promise<VaccineProtocolChange> {
    const result = await database.query(
      `INSERT INTO vaccine_protocol_changes (
        protocol_id, changed_field, old_value, new_value,
        change_reason, regulatory_standard, effective_date, changed_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        input.protocolId, input.changedField,
        input.oldValue ?? null, input.newValue,
        input.changeReason ?? null, input.regulatoryStandard ?? null,
        input.effectiveDate ?? new Date().toISOString().split('T')[0],
        input.changedBy ?? null,
      ]
    );
    return mapChangeRow(result.rows[0]);
  }

  async getProtocolChangeHistory(protocolId: string): Promise<VaccineProtocolChange[]> {
    const result = await database.query(
      `SELECT pc.*,
         vp.name AS "protocol_name",
         u.first_name || ' ' || u.last_name AS "changed_by_name"
       FROM vaccine_protocol_changes pc
       JOIN vaccine_protocols vp ON vp.id = pc.protocol_id
       LEFT JOIN users u ON u.id = pc.changed_by
       WHERE pc.protocol_id = $1
       ORDER BY pc.effective_date DESC, pc.created_at DESC`,
      [protocolId]
    );
    return result.rows.map(mapChangeRow);
  }

  // ── ASSIGNMENT ────────────────────────────────────────────────

  async assignProtocolToAnimal(
    animalId: string,
    protocolId: string,
    assignedBy: string,
    notes?: string
  ): Promise<{ id: string; animalId: string; protocolId: string }> {
    const result = await database.query(
      `INSERT INTO animal_vaccine_assignments (animal_id, protocol_id, assigned_by, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (animal_id, protocol_id) DO UPDATE SET waived = false, notes = EXCLUDED.notes
       RETURNING id, animal_id, protocol_id`,
      [animalId, protocolId, assignedBy, notes ?? null]
    );
    return {
      id: result.rows[0].id,
      animalId: result.rows[0].animal_id,
      protocolId: result.rows[0].protocol_id,
    };
  }

  async waiverProtocol(
    animalId: string,
    protocolId: string,
    reason: string
  ): Promise<void> {
    await database.query(
      `UPDATE animal_vaccine_assignments SET waived = true, waiver_reason = $3
       WHERE animal_id = $1 AND protocol_id = $2`,
      [animalId, protocolId, reason]
    );
    // Mark pending schedule rows as waived
    await database.query(
      `UPDATE vaccine_schedule SET status = 'waived'
       WHERE animal_id = $1 AND protocol_id = $2 AND status = 'pending'`,
      [animalId, protocolId]
    );
  }

  async getAnimalAssignments(animalId: string): Promise<any[]> {
    const result = await database.query(
      `SELECT ava.*, vp.name AS protocol_name, vp.disease, vp.vaccine_category,
              vp.booster_interval_days, vp.is_zoonotic, vp.species
       FROM animal_vaccine_assignments ava
       JOIN vaccine_protocols vp ON vp.id = ava.protocol_id
       WHERE ava.animal_id = $1
       ORDER BY vp.vaccine_category, vp.name`,
      [animalId]
    );
    return result.rows;
  }

  // ── CERTIFICATE LOG ───────────────────────────────────────────

  async logCertificateDownload(input: {
    animalId: string;
    vaccinationRecordId?: string | null;
    generatedBy: string;
    certificateType?: 'single' | 'passport' | 'batch';
    fileName?: string;
  }): Promise<{ id: string; generatedAt: string }> {
    const result = await database.query(
      `INSERT INTO vaccine_certificate_log
         (animal_id, vaccination_record_id, generated_by, certificate_type, file_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, generated_at`,
      [
        input.animalId,
        input.vaccinationRecordId ?? null,
        input.generatedBy,
        input.certificateType ?? 'single',
        input.fileName ?? null,
      ]
    );
    return {
      id: result.rows[0].id,
      generatedAt: result.rows[0].generated_at,
    };
  }

  async getCertificateLogs(animalId: string): Promise<any[]> {
    const result = await database.query(
      `SELECT cl.id,
         cl.animal_id AS "animalId",
         cl.vaccination_record_id AS "vaccinationRecordId",
         cl.certificate_type AS "certificateType",
         cl.file_name AS "fileName",
         cl.generated_at AS "generatedAt",
         a.name AS "animalName",
         u.first_name || ' ' || u.last_name AS "generatedByName",
         vr.vaccine_name AS "vaccineName"
       FROM vaccine_certificate_log cl
       JOIN users u ON u.id = cl.generated_by
       LEFT JOIN animals a ON a.id = cl.animal_id
       LEFT JOIN vaccination_records vr ON vr.id = cl.vaccination_record_id
       WHERE cl.animal_id = $1
       ORDER BY cl.generated_at DESC`,
      [animalId]
    );
    return result.rows;
  }

  // ── ADMIN STATS ───────────────────────────────────────────────

  async getProtocolStats(): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
    bySpecies: Record<string, number>;
  }> {
    const [totalRes, statsRes, speciesRes] = await Promise.all([
      database.query(`SELECT COUNT(*) AS total FROM vaccine_protocols`),
      database.query(
        `SELECT vaccine_category, COUNT(*) AS cnt FROM vaccine_protocols GROUP BY vaccine_category`
      ),
      database.query(
        `SELECT UNNEST(species) AS sp, COUNT(*) AS cnt FROM vaccine_protocols WHERE is_active = true GROUP BY sp`
      ),
    ]);

    const activeRes = await database.query(
      `SELECT COUNT(*) AS total FROM vaccine_protocols WHERE is_active = true`
    );

    const byCategory: Record<string, number> = {};
    for (const row of statsRes.rows) {
      byCategory[row.vaccine_category] = parseInt(row.cnt);
    }
    const bySpecies: Record<string, number> = {};
    for (const row of speciesRes.rows) {
      bySpecies[row.sp] = parseInt(row.cnt);
    }

    return {
      total: parseInt(totalRes.rows[0].total),
      active: parseInt(activeRes.rows[0].total),
      byCategory,
      bySpecies,
    };
  }

  /**
   * Vaccination passport for a whole batch group (herd/flock). The vaccine history is the
   * GROUP's - one vaccination_records row with group_id, not one row per animal. Coverage is
   * measured against the group's placed/current population (rates, not row counts).
   */
  async getGroupVaccinationPassport(groupId: string): Promise<any> {
    const [groupRes, cycleRes, vaxRes] = await Promise.all([
      database.query(
        `SELECT id, name, group_type, species, management_mode, enterprise_id,
                COALESCE(current_count, 0) AS current_count
         FROM animal_groups WHERE id = $1`, [groupId]
      ),
      database.query(
        `SELECT id, cycle_number, status, placed_at, closed_at, head_count
         FROM group_cycles WHERE group_id = $1 ORDER BY cycle_number DESC LIMIT 1`, [groupId]
      ),
      database.query(
        `SELECT vaccine_name, vaccine_type AS vaccine_type, dosage, batch_number, manufacturer,
                date_administered, next_due_date, head_count_treated, cycle_id, campaign_id,
                site_of_administration, administered_by, created_at
         FROM vaccination_records
         WHERE group_id = $1
         ORDER BY date_administered ASC`, [groupId]
      ),
    ]);

    const group = groupRes.rows[0];
    if (!group) throw new Error('Group not found');
    const cycle = cycleRes.rows[0] || null;
    const placedCount = cycle?.head_count ?? group.current_count;

    // Aggregate per vaccine type
    const byVaccine: Record<string, any> = {};
    for (const r of vaxRes.rows) {
      const key = r.vaccine_name || 'Unknown vaccine';
      if (!byVaccine[key]) {
        byVaccine[key] = {
          vaccineName: key,
          vaccineType: r.vaccine_type || null,
          applications: 0,
          headCountTreated: 0,
          lastAdministeredAt: null,
          nextDueDate: null,
          batchNumbers: new Set<string>(),
          fromCampaign: false,
          cyclesCovered: new Set<string>(),
        };
      }
      const v = byVaccine[key];
      v.applications += 1;
      v.headCountTreated += r.head_count_treated ? parseInt(r.head_count_treated) : 0;
      if (v.lastAdministeredAt === null || new Date(r.date_administered) > new Date(v.lastAdministeredAt)) {
        v.lastAdministeredAt = r.date_administered;
        v.nextDueDate = r.next_due_date || v.nextDueDate;
      }
      if (r.batch_number) v.batchNumbers.add(r.batch_number);
      if (r.campaign_id) v.fromCampaign = true;
      if (r.cycle_id) v.cyclesCovered.add(r.cycle_id);
    }

    const vaccines = Object.values(byVaccine).map((v: any) => ({
      vaccineName: v.vaccineName,
      vaccineType: v.vaccineType,
      applications: v.applications,
      headCountTreated: v.headCountTreated,
      batchNumbers: Array.from(v.batchNumbers),
      cyclesCovered: Array.from(v.cyclesCovered),
      fromCampaign: v.fromCampaign,
      lastAdministeredAt: v.lastAdministeredAt,
      nextDueDate: v.nextDueDate,
      coveragePercent: placedCount > 0 ? Math.min(100, Math.round((v.headCountTreated / placedCount) * 100)) : null,
    }));

    return {
      group: {
        id: group.id,
        name: group.name,
        groupType: group.group_type,
        species: group.species,
        managementMode: group.management_mode,
        currentCount: group.current_count,
      },
      cycle: cycle ? {
        id: cycle.id,
        cycleNumber: cycle.cycle_number,
        status: cycle.status,
        placedAt: cycle.placed_at,
        closedAt: cycle.closed_at,
        headCount: cycle.head_count,
        placedCount,
      } : null,
      vaccines,
      totalApplications: vaxRes.rows.length,
    };
  }
}

export default new VaccineProtocolService();

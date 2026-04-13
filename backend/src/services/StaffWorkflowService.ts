import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import logger from '../utils/logger';

const WORKFLOW_STAGES = ['triage', 'examination', 'treatment', 'observation', 'discharge'] as const;

class StaffWorkflowService {

  // ═══════════════════ ANIMAL SEARCH (for workflow integration) ═══════════════════

  async searchAnimals(query: string, limit = 15) {
    const result = await database.query(`
      SELECT a.id, a.name, a.species, a.breed, a.weight, a.date_of_birth,
        a.gender, a.microchip_id, a.color,
        u.id AS owner_id, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
        u.phone AS owner_phone, u.email AS owner_email
      FROM animals a
      JOIN users u ON u.id = a.owner_id
      WHERE (a.name ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1
        OR a.microchip_id ILIKE $1 OR a.species ILIKE $1)
      ORDER BY a.name ASC
      LIMIT $2
    `, [`%${query}%`, limit]);
    return result.rows;
  }

  async searchVets(query: string, excludeUserId?: string, limit = 20) {
    const params: unknown[] = [];
    let whereClause = `u.role = 'veterinarian' AND u.is_active = true`;

    if (excludeUserId) {
      params.push(excludeUserId);
      whereClause += ` AND u.id != $${params.length}`;
    }

    if (query.trim()) {
      params.push(`%${query.trim()}%`);
      const p = params.length;
      whereClause += ` AND (
        u.first_name ILIKE $${p} OR u.last_name ILIKE $${p} OR u.email ILIKE $${p}
        OR vp.clinic_name ILIKE $${p} OR vp.license_number ILIKE $${p}
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(vp.specializations, '{}')) s WHERE s ILIKE $${p})
      )`;
    }

    params.push(limit);
    const limitParam = params.length;

    const result = await database.query(`
      SELECT u.id, u.first_name, u.last_name, u.email,
        vp.specializations, vp.years_of_experience,
        vp.clinic_name, vp.rating, vp.total_reviews, vp.license_number,
        vp.is_verified, vp.is_available, vp.consultation_fee, vp.currency
      FROM users u
      LEFT JOIN vet_profiles vp ON vp.user_id = u.id
      WHERE ${whereClause}
      ORDER BY vp.is_verified DESC NULLS LAST, vp.rating DESC NULLS LAST, u.first_name ASC
      LIMIT $${limitParam}
    `, params);
    return result.rows;
  }

  async getAnimalMedicalSummary(animalId: string) {
    const [animal, records, prescriptions, vaccinations, allergies] = await Promise.all([
      database.query(`
        SELECT a.*, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
          u.phone AS owner_phone, u.email AS owner_email
        FROM animals a JOIN users u ON u.id = a.owner_id WHERE a.id = $1
      `, [animalId]),
      database.query(`
        SELECT mr.id, mr.record_type, mr.title, mr.severity,
          mr.content, mr.created_at, u.first_name AS vet_first_name, u.last_name AS vet_last_name
        FROM medical_records mr
        LEFT JOIN users u ON u.id = mr.veterinarian_id
        WHERE mr.animal_id = $1 ORDER BY mr.created_at DESC LIMIT 10
      `, [animalId]),
      database.query(`
        SELECT p.id, p.instructions, p.medications, p.created_at, p.valid_until,
          u.first_name AS vet_first_name, u.last_name AS vet_last_name
        FROM prescriptions p
        LEFT JOIN users u ON u.id = p.veterinarian_id
        WHERE p.animal_id = $1 ORDER BY p.created_at DESC LIMIT 5
      `, [animalId]),
      database.query(`
        SELECT id, vaccine_name, date_administered, next_due_date, batch_number
        FROM vaccination_records WHERE animal_id = $1 ORDER BY date_administered DESC LIMIT 5
      `, [animalId]),
      database.query(`
        SELECT id, allergen, severity, reaction, identified_date
        FROM allergy_records WHERE animal_id = $1 ORDER BY identified_date DESC
      `, [animalId]),
    ]);
    return {
      animal: animal.rows[0] || null,
      recentRecords: records.rows,
      recentPrescriptions: prescriptions.rows,
      recentVaccinations: vaccinations.rows,
      allergies: allergies.rows,
    };
  }

  // ═══════════════════ STAFF POSITIONS ═══════════════════

  async listStaffPositions(hospitalId: string) {
    const result = await database.query(`
      SELECT sp.*, u.first_name, u.last_name, u.email, u.role, u.avatar_url
      FROM staff_positions sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.hospital_id = $1
      ORDER BY sp.position, u.last_name
    `, [hospitalId]);
    return result.rows;
  }

  async addStaffPosition(data: { hospitalId: string; userId: string; position: string; department?: string; notes?: string }) {
    const id = uuidv4();
    const result = await database.query(`
      INSERT INTO staff_positions (id, hospital_id, user_id, position, department, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, data.hospitalId, data.userId, data.position, data.department || null, data.notes || null]);
    logger.info('Staff position added', { id, hospitalId: data.hospitalId, position: data.position });
    return result.rows[0];
  }

  async updateStaffPosition(id: string, data: { position?: string; department?: string; isActive?: boolean; notes?: string }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.position !== undefined) { fields.push(`position = $${idx++}`); values.push(data.position); }
    if (data.department !== undefined) { fields.push(`department = $${idx++}`); values.push(data.department); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
    if (fields.length === 0) return null;
    values.push(id);
    const result = await database.query(
      `UPDATE staff_positions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async removeStaffPosition(id: string) {
    await database.query('DELETE FROM staff_positions WHERE id = $1', [id]);
  }

  // ═══════════════════ APPOINTMENT QUEUE ═══════════════════

  async getQueue(hospitalId: string, status?: string) {
    let sql = `
      SELECT aq.*,
        u_owner.first_name AS owner_first_name, u_owner.last_name AS owner_last_name,
        u_vet.first_name AS vet_first_name, u_vet.last_name AS vet_last_name,
        a.name AS animal_name, a.species AS animal_species, a.breed AS animal_breed,
        e.name AS "enterpriseName", e.enterprise_type AS "enterpriseType",
        ag.name AS "groupName", ag.group_type AS "groupType"
      FROM appointment_queue aq
      LEFT JOIN users u_owner ON u_owner.id = aq.owner_id
      LEFT JOIN users u_vet ON u_vet.id = aq.assigned_vet_id
      LEFT JOIN animals a ON a.id = aq.animal_id
      LEFT JOIN enterprises e ON e.id = a.enterprise_id
      LEFT JOIN animal_groups ag ON ag.id = a.group_id
      WHERE aq.hospital_id = $1
    `;
    const params: unknown[] = [hospitalId];
    if (status) {
      sql += ` AND aq.status = $2`;
      params.push(status);
    } else {
      sql += ` AND aq.status NOT IN ('discharged','no_show')`;
    }
    sql += ` ORDER BY
      CASE aq.priority
        WHEN 'emergency' THEN 1
        WHEN 'urgent' THEN 2
        WHEN 'high' THEN 3
        WHEN 'normal' THEN 4
        WHEN 'low' THEN 5
      END,
      aq.checked_in_at ASC`;
    const result = await database.query(sql, params);
    return result.rows;
  }

  async checkInToQueue(data: {
    hospitalId: string; animalId?: string; ownerId?: string; bookingId?: string;
    assignedVetId?: string; priority?: string; reason?: string;
  }) {
    // Prevent duplicate active check-ins for the same animal today
    if (data.animalId) {
      const dupCheck = await database.query(
        `SELECT queue_number, status FROM appointment_queue
         WHERE hospital_id = $1 AND animal_id = $2
           AND DATE(checked_in_at) = CURRENT_DATE
           AND status NOT IN ('discharged', 'no_show')
         LIMIT 1`,
        [data.hospitalId, data.animalId]
      );
      if (dupCheck.rows.length > 0) {
        const existing = dupCheck.rows[0];
        throw new Error(`DUPLICATE_CHECKIN:${existing.queue_number}:${existing.status}`);
      }
    }

    // Get next queue number for today
    const countResult = await database.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_num
       FROM appointment_queue WHERE hospital_id = $1 AND DATE(checked_in_at) = CURRENT_DATE`,
      [data.hospitalId]
    );
    const queueNumber = countResult.rows[0].next_num;
    const id = uuidv4();
    const result = await database.query(`
      INSERT INTO appointment_queue (id, hospital_id, booking_id, animal_id, owner_id, assigned_vet_id,
        queue_number, priority, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, data.hospitalId, data.bookingId || null, data.animalId || null,
        data.ownerId || null, data.assignedVetId || null, queueNumber,
        data.priority || 'normal', data.reason || null]);
    logger.info('Patient checked into queue', { id, hospitalId: data.hospitalId, queueNumber });
    return result.rows[0];
  }

  async triagePatient(queueId: string, data: { triageLevel: number; triageNotes?: string; triagedBy: string; priority?: string }) {
    const result = await database.query(`
      UPDATE appointment_queue
      SET status = 'in_triage', triage_level = $1, triage_notes = $2, triaged_by = $3,
          priority = COALESCE($4, priority), called_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [data.triageLevel, data.triageNotes || null, data.triagedBy, data.priority || null, queueId]);
    return result.rows[0] || null;
  }

  async updateQueueStatus(queueId: string, status: string, userId: string) {
    // Fetch queue entry first — needed for auto-creates
    const queueEntry = await database.query(
      `SELECT q.*, h.name AS hospital_name
       FROM appointment_queue q
       JOIN vet_hospitals h ON h.id = q.hospital_id
       WHERE q.id = $1`,
      [queueId]
    );
    const qe = queueEntry.rows[0];

    if (status === 'discharged' || status === 'no_show') {
      const result = await database.query(
        `UPDATE appointment_queue SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [status, queueId]
      );
      // Auto-create medical record on queue discharge (cross-module data visibility)
      if (status === 'discharged' && qe?.animal_id) {
        try {
          const contentParts = [
            `Queue Visit — ${qe.hospital_name || 'Hospital'}`,
            qe.reason ? `Reason: ${qe.reason}` : null,
            qe.priority !== 'normal' ? `Priority: ${qe.priority}` : null,
            qe.triage_notes ? `Triage Notes: ${qe.triage_notes}` : null,
          ].filter(Boolean).join('\n');
          await database.query(`
            INSERT INTO medical_records (id, user_id, animal_id, veterinarian_id, record_type, title, content, created_at)
            VALUES ($1, $2, $3, $4, 'follow_up', $5, $6, NOW())
          `, [uuidv4(), qe.owner_id || userId, qe.animal_id, userId,
              `Hospital Visit: ${qe.hospital_name || 'Walk-in Queue'}`,
              contentParts || 'Hospital queue visit discharge']);
          logger.info('Medical record auto-created from queue discharge', { queueId, animalId: qe.animal_id });
        } catch (err: any) {
          logger.warn('Failed to auto-create medical record on queue discharge', { queueId, error: err.message });
        }
      }
      return result.rows[0] || null;
    }
    if (status === 'in_triage' || status === 'in_examination') {
      const result = await database.query(
        `UPDATE appointment_queue SET status = $1, called_at = COALESCE(called_at, CURRENT_TIMESTAMP) WHERE id = $2 RETURNING *`,
        [status, queueId]
      );
      // Auto-create a linked clinical case when examination starts (cross-module data visibility)
      if (status === 'in_examination' && qe?.hospital_id) {
        try {
          const existing = await database.query(
            'SELECT id FROM workflow_cases WHERE queue_entry_id = $1 LIMIT 1',
            [queueId]
          );
          if (!existing.rows[0]) {
            const caseId = uuidv4();
            await database.query(`
              INSERT INTO workflow_cases (id, queue_entry_id, hospital_id, animal_id, owner_id,
                assigned_vet_id, priority, chief_complaint, current_stage, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'examination', 'active')
            `, [caseId, queueId, qe.hospital_id, qe.animal_id || null, qe.owner_id || null,
                userId, qe.priority || 'normal', qe.reason || null]);
            await database.query(`
              INSERT INTO workflow_transitions (id, case_id, from_stage, to_stage, transitioned_by, notes)
              VALUES ($1, $2, 'triage', 'examination', $3, 'Auto-created from queue entry')
            `, [uuidv4(), caseId, userId]);
            logger.info('Clinical case auto-created from queue examination', { queueId, caseId });
          }
        } catch (err: any) {
          logger.warn('Failed to auto-create clinical case from queue', { queueId, error: err.message });
        }
      }
      return result.rows[0] || null;
    }
    const result = await database.query(
      `UPDATE appointment_queue SET status = $1 WHERE id = $2 RETURNING *`,
      [status, queueId]
    );
    return result.rows[0] || null;
  }

  async getQueueStats(hospitalId: string) {
    const result = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('discharged','no_show')) AS active_count,
        COUNT(*) FILTER (WHERE status = 'waiting') AS waiting_count,
        COUNT(*) FILTER (WHERE status = 'in_triage') AS in_triage_count,
        COUNT(*) FILTER (WHERE status = 'in_examination') AS in_exam_count,
        COUNT(*) FILTER (WHERE status = 'in_treatment') AS in_treatment_count,
        COUNT(*) FILTER (WHERE priority = 'emergency' AND status NOT IN ('discharged','no_show')) AS emergency_count,
        AVG(EXTRACT(EPOCH FROM (COALESCE(called_at, CURRENT_TIMESTAMP) - checked_in_at))/60)
          FILTER (WHERE status NOT IN ('discharged','no_show')) AS avg_wait_minutes,
        COUNT(*) FILTER (WHERE DATE(checked_in_at) = CURRENT_DATE) AS today_total
      FROM appointment_queue
      WHERE hospital_id = $1 AND DATE(checked_in_at) = CURRENT_DATE
    `, [hospitalId]);
    return result.rows[0];
  }

  // ═══════════════════ WORKFLOW CASES ═══════════════════

  async createWorkflowCase(data: {
    hospitalId: string; queueEntryId?: string; bookingId?: string;
    animalId?: string; ownerId?: string; assignedVetId?: string;
    assignedStaffId?: string; priority?: string; chiefComplaint?: string;
    createdBy: string;
  }) {
    const id = uuidv4();
    const result = await database.query(`
      INSERT INTO workflow_cases (id, queue_entry_id, hospital_id, booking_id, animal_id, owner_id,
        assigned_vet_id, assigned_staff_id, priority, chief_complaint)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [id, data.queueEntryId || null, data.hospitalId, data.bookingId || null,
        data.animalId || null, data.ownerId || null, data.assignedVetId || null,
        data.assignedStaffId || null, data.priority || 'normal', data.chiefComplaint || null]);

    // Log the initial transition
    await database.query(`
      INSERT INTO workflow_transitions (id, case_id, from_stage, to_stage, transitioned_by, notes)
      VALUES ($1, $2, NULL, 'triage', $3, 'Case created')
    `, [uuidv4(), id, data.createdBy]);

    logger.info('Workflow case created', { id, hospitalId: data.hospitalId });
    return result.rows[0];
  }

  async listWorkflowCases(hospitalId: string, filters?: { stage?: string; status?: string; vetId?: string }) {
    let sql = `
      SELECT wc.*,
        u_vet.first_name AS vet_first_name, u_vet.last_name AS vet_last_name,
        u_staff.first_name AS staff_first_name, u_staff.last_name AS staff_last_name,
        u_owner.first_name AS owner_first_name, u_owner.last_name AS owner_last_name,
        a.name AS animal_name, a.species AS animal_species, a.breed AS animal_breed,
        e.name AS "enterpriseName", e.enterprise_type AS "enterpriseType",
        ag.name AS "groupName", ag.group_type AS "groupType"
      FROM workflow_cases wc
      LEFT JOIN users u_vet ON u_vet.id = wc.assigned_vet_id
      LEFT JOIN users u_staff ON u_staff.id = wc.assigned_staff_id
      LEFT JOIN users u_owner ON u_owner.id = wc.owner_id
      LEFT JOIN animals a ON a.id = wc.animal_id
      LEFT JOIN enterprises e ON e.id = a.enterprise_id
      LEFT JOIN animal_groups ag ON ag.id = a.group_id
      WHERE wc.hospital_id = $1
    `;
    const params: unknown[] = [hospitalId];
    let paramIdx = 2;
    if (filters?.stage) { sql += ` AND wc.current_stage = $${paramIdx++}`; params.push(filters.stage); }
    if (filters?.status) { sql += ` AND wc.status = $${paramIdx++}`; params.push(filters.status); }
    if (filters?.vetId) { sql += ` AND wc.assigned_vet_id = $${paramIdx++}`; params.push(filters.vetId); }
    sql += ` ORDER BY
      CASE wc.priority WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 WHEN 'high' THEN 3 WHEN 'normal' THEN 4 ELSE 5 END,
      wc.started_at DESC`;
    const result = await database.query(sql, params);
    return result.rows;
  }

  async transitionWorkflowStage(caseId: string, toStage: string, userId: string, notes?: string) {
    // Get the current case
    const current = await database.query('SELECT * FROM workflow_cases WHERE id = $1', [caseId]);
    if (!current.rows[0]) return null;
    const fromStage = current.rows[0].current_stage;

    const updates: Record<string, unknown> = { current_stage: toStage };
    if (toStage === 'discharge') {
      updates.status = 'completed';
      updates.completed_at = new Date();
    }

    const result = await database.query(`
      UPDATE workflow_cases SET current_stage = $1, status = COALESCE($2, status),
        completed_at = $3
      WHERE id = $4 RETURNING *
    `, [toStage, toStage === 'discharge' ? 'completed' : null,
        toStage === 'discharge' ? new Date() : null, caseId]);

    // Log transition
    await database.query(`
      INSERT INTO workflow_transitions (id, case_id, from_stage, to_stage, transitioned_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [uuidv4(), caseId, fromStage, toStage, userId, notes || null]);

    // Auto-create medical record on discharge if animal is linked
    if (toStage === 'discharge' && result.rows[0]?.animal_id) {
      const c = result.rows[0];
      try {
        const contentParts = [
          c.chief_complaint ? `Chief Complaint: ${c.chief_complaint}` : null,
          c.diagnosis ? `Diagnosis: ${c.diagnosis}` : null,
          c.treatment_plan ? `Treatment: ${c.treatment_plan}` : null,
          c.discharge_summary || notes ? `Notes: ${c.discharge_summary || notes}` : null,
        ].filter(Boolean).join('\n');
        await database.query(`
          INSERT INTO medical_records (id, user_id, animal_id, veterinarian_id, record_type, title, content, created_at)
          VALUES ($1, $2, $3, $4, 'follow_up', $5, $6, NOW())
        `, [uuidv4(), c.owner_id || userId, c.animal_id, c.assigned_vet_id || userId,
            `Workflow Discharge: ${c.chief_complaint || 'Clinical case'}`,
            contentParts || 'Clinical workflow discharge']);
        logger.info('Medical record auto-created from workflow discharge', { caseId, animalId: c.animal_id });
      } catch (err: any) {
        logger.warn('Failed to auto-create medical record on discharge', { caseId, error: err.message });
      }
    }

    logger.info('Workflow stage transition', { caseId, fromStage, toStage, userId });
    return result.rows[0];
  }

  async updateWorkflowCase(caseId: string, data: {
    assignedVetId?: string; assignedStaffId?: string; priority?: string;
    diagnosis?: string; treatmentPlan?: string; dischargeSummary?: string;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.assignedVetId !== undefined) { fields.push(`assigned_vet_id = $${idx++}`); values.push(data.assignedVetId); }
    if (data.assignedStaffId !== undefined) { fields.push(`assigned_staff_id = $${idx++}`); values.push(data.assignedStaffId); }
    if (data.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(data.priority); }
    if (data.diagnosis !== undefined) { fields.push(`diagnosis = $${idx++}`); values.push(data.diagnosis); }
    if (data.treatmentPlan !== undefined) { fields.push(`treatment_plan = $${idx++}`); values.push(data.treatmentPlan); }
    if (data.dischargeSummary !== undefined) { fields.push(`discharge_summary = $${idx++}`); values.push(data.dischargeSummary); }
    if (fields.length === 0) return null;
    values.push(caseId);
    const result = await database.query(
      `UPDATE workflow_cases SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async getWorkflowCaseDetail(caseId: string) {
    const caseResult = await database.query(`
      SELECT wc.*,
        u_vet.first_name AS vet_first_name, u_vet.last_name AS vet_last_name,
        u_staff.first_name AS staff_first_name, u_staff.last_name AS staff_last_name,
        u_owner.first_name AS owner_first_name, u_owner.last_name AS owner_last_name,
        a.name AS animal_name, a.species AS animal_species, a.breed AS animal_breed, a.weight AS animal_weight
      FROM workflow_cases wc
      LEFT JOIN users u_vet ON u_vet.id = wc.assigned_vet_id
      LEFT JOIN users u_staff ON u_staff.id = wc.assigned_staff_id
      LEFT JOIN users u_owner ON u_owner.id = wc.owner_id
      LEFT JOIN animals a ON a.id = wc.animal_id
      WHERE wc.id = $1
    `, [caseId]);
    if (!caseResult.rows[0]) return null;

    const transitions = await database.query(`
      SELECT wt.*, u.first_name, u.last_name
      FROM workflow_transitions wt
      LEFT JOIN users u ON u.id = wt.transitioned_by
      WHERE wt.case_id = $1
      ORDER BY wt.created_at ASC
    `, [caseId]);

    return { ...caseResult.rows[0], transitions: transitions.rows };
  }

  async getWorkflowDashboard(hospitalId: string) {
    const stageCountsResult = await database.query(`
      SELECT current_stage, COUNT(*)::int AS count
      FROM workflow_cases
      WHERE hospital_id = $1 AND status = 'active'
      GROUP BY current_stage
    `, [hospitalId]);

    const priorityResult = await database.query(`
      SELECT priority, COUNT(*)::int AS count
      FROM workflow_cases
      WHERE hospital_id = $1 AND status = 'active'
      GROUP BY priority
    `, [hospitalId]);

    const todayResult = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_cases,
        COUNT(*) FILTER (WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE)::int AS completed_today,
        COUNT(*)::int AS total_today
      FROM workflow_cases
      WHERE hospital_id = $1 AND DATE(started_at) = CURRENT_DATE
    `, [hospitalId]);

    const avgDuration = await database.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60)::int AS avg_minutes
      FROM workflow_cases
      WHERE hospital_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
        AND DATE(completed_at) >= CURRENT_DATE - INTERVAL '7 days'
    `, [hospitalId]);

    return {
      stageCounts: stageCountsResult.rows,
      priorityCounts: priorityResult.rows,
      today: todayResult.rows[0],
      avgCaseDurationMinutes: avgDuration.rows[0]?.avg_minutes || 0,
    };
  }

  // ═══════════════════ REFERRALS ═══════════════════

  async createReferral(data: {
    caseId?: string; hospitalId: string; fromVetId: string; toVetId: string;
    animalId?: string; reason: string; specialtyNeeded?: string;
    priority?: string; clinicalNotes?: string;
  }) {
    // Validation
    if (data.fromVetId === data.toVetId) {
      throw new Error('Cannot create a referral to yourself');
    }
    if (!data.reason?.trim()) {
      throw new Error('Reason for referral is required');
    }
    const vetCheck = await database.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'veterinarian' AND is_active = true`,
      [data.toVetId]
    );
    if (vetCheck.rows.length === 0) {
      throw new Error('Selected veterinarian not found or is inactive');
    }
    const id = uuidv4();
    const result = await database.query(`
      INSERT INTO referrals (id, case_id, hospital_id, from_vet_id, to_vet_id, animal_id,
        reason, specialty_needed, priority, clinical_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [id, data.caseId || null, data.hospitalId, data.fromVetId, data.toVetId,
        data.animalId || null, data.reason, data.specialtyNeeded || null,
        data.priority || 'normal', data.clinicalNotes || null]);

    // Update case status if linked
    if (data.caseId) {
      await database.query(
        `UPDATE workflow_cases SET status = 'referred' WHERE id = $1`,
        [data.caseId]
      );
    }

    logger.info('Referral created', { id, fromVetId: data.fromVetId, toVetId: data.toVetId });
    return result.rows[0];
  }

  async listReferrals(hospitalId: string, filters?: { status?: string; vetId?: string }) {
    let sql = `
      SELECT r.*,
        u_from.first_name AS from_vet_first, u_from.last_name AS from_vet_last,
        u_to.first_name AS to_vet_first, u_to.last_name AS to_vet_last,
        a.name AS animal_name, a.species AS animal_species
      FROM referrals r
      LEFT JOIN users u_from ON u_from.id = r.from_vet_id
      LEFT JOIN users u_to ON u_to.id = r.to_vet_id
      LEFT JOIN animals a ON a.id = r.animal_id
      WHERE r.hospital_id = $1
    `;
    const params: unknown[] = [hospitalId];
    let paramIdx = 2;
    if (filters?.status) { sql += ` AND r.status = $${paramIdx++}`; params.push(filters.status); }
    if (filters?.vetId) { sql += ` AND (r.from_vet_id = $${paramIdx} OR r.to_vet_id = $${paramIdx++})`; params.push(filters.vetId); }
    sql += ` ORDER BY r.created_at DESC`;
    const result = await database.query(sql, params);
    return result.rows;
  }

  async updateReferralStatus(referralId: string, status: string, responseNotes?: string) {
    const timestampField = status === 'accepted' ? ', accepted_at = CURRENT_TIMESTAMP'
      : status === 'completed' ? ', completed_at = CURRENT_TIMESTAMP' : '';
    const result = await database.query(`
      UPDATE referrals SET status = $1, response_notes = COALESCE($2, response_notes)${timestampField}
      WHERE id = $3 RETURNING *
    `, [status, responseNotes || null, referralId]);
    return result.rows[0] || null;
  }

  // ═══════════════════ INPATIENT ADMISSIONS ═══════════════════

  async admitPatient(data: {
    hospitalId: string; animalId: string; ownerId: string; admittedBy: string;
    caseId?: string; admissionType: string; roomNumber?: string; bedNumber?: string;
    careInstructions?: string; medications?: unknown[]; specialNeeds?: string;
    estimatedDischarge?: string; dailyRate?: number;
  }) {
    // Prevent duplicate active admission for same animal at same hospital
    const existing = await database.query(
      `SELECT id, status FROM inpatient_admissions
       WHERE animal_id = $1 AND hospital_id = $2
       AND status NOT IN ('discharged', 'transferred', 'deceased')
       LIMIT 1`,
      [data.animalId, data.hospitalId]
    );
    if (existing.rows[0]) {
      const existingStatus = existing.rows[0].status;
      throw Object.assign(new Error(`DUPLICATE_ADMIT:${existingStatus}`), { code: 'DUPLICATE_ADMIT' });
    }
    const id = uuidv4();
    const result = await database.query(`
      INSERT INTO inpatient_admissions (id, hospital_id, animal_id, owner_id, admitted_by,
        case_id, admission_type, room_number, bed_number, care_instructions,
        medications, special_needs, estimated_discharge, daily_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [id, data.hospitalId, data.animalId, data.ownerId, data.admittedBy,
        data.caseId || null, data.admissionType, data.roomNumber || null,
        data.bedNumber || null, data.careInstructions || null,
        JSON.stringify(data.medications || []), data.specialNeeds || null,
        data.estimatedDischarge || null, data.dailyRate || 0]);
    logger.info('Patient admitted', { id, hospitalId: data.hospitalId, animalId: data.animalId });
    return result.rows[0];
  }

  async listInpatients(hospitalId: string, status?: string) {
    let sql = `
      SELECT ip.*,
        a.name AS animal_name, a.species AS animal_species, a.breed AS animal_breed, a.weight AS animal_weight,
        u_owner.first_name AS owner_first_name, u_owner.last_name AS owner_last_name, u_owner.phone AS owner_phone,
        u_vet.first_name AS admitted_by_first, u_vet.last_name AS admitted_by_last,
        e.name AS enterprise_name, e.id AS enterprise_id,
        e.name AS "enterpriseName", ag.name AS "groupName"
      FROM inpatient_admissions ip
      JOIN animals a ON a.id = ip.animal_id
      JOIN users u_owner ON u_owner.id = ip.owner_id
      JOIN users u_vet ON u_vet.id = ip.admitted_by
      LEFT JOIN enterprises e ON e.id = ip.enterprise_id
      LEFT JOIN animal_groups ag ON ag.id = a.group_id
      WHERE ip.hospital_id = $1
    `;
    const params: unknown[] = [hospitalId];
    if (status) {
      sql += ` AND ip.status = $2`;
      params.push(status);
    } else {
      sql += ` AND ip.status != 'discharged'`;
    }
    sql += ` ORDER BY ip.admitted_at DESC`;
    const result = await database.query(sql, params);
    return result.rows;
  }

  async updateInpatientStatus(admissionId: string, status: string, userId?: string, notes?: string) {
    let sql = `UPDATE inpatient_admissions SET status = $1`;
    const params: unknown[] = [status];
    let idx = 2;
    if (status === 'discharged') {
      sql += `, discharged_at = CURRENT_TIMESTAMP, discharged_by = $${idx++}, discharge_notes = $${idx++}`;
      params.push(userId || null, notes || null);
    }
    sql += ` WHERE id = $${idx++} RETURNING *`;
    params.push(admissionId);
    const result = await database.query(sql, params);
    const admission = result.rows[0];

    // Auto-create medical record on inpatient discharge
    if (status === 'discharged' && admission?.animal_id) {
      try {
        const contentParts = [
          `Admission Type: ${admission.admission_type?.replace(/_/g, ' ') || 'N/A'}`,
          admission.care_instructions ? `Care Instructions: ${admission.care_instructions}` : null,
          notes ? `Discharge Notes: ${notes}` : null,
          admission.discharge_notes ? `Notes: ${admission.discharge_notes}` : null,
        ].filter(Boolean).join('\n');
        await database.query(`
          INSERT INTO medical_records (id, user_id, animal_id, veterinarian_id, record_type, title, content, created_at)
          VALUES ($1, $2, $3, $4, 'other', $5, $6, NOW())
        `, [uuidv4(), admission.owner_id || userId, admission.animal_id, userId || admission.admitted_by,
            `Inpatient Discharge: ${admission.admission_type?.replace(/_/g, ' ') || 'Admission'}`,
            contentParts || 'Inpatient discharge record']);
        logger.info('Medical record auto-created from inpatient discharge', { admissionId, animalId: admission.animal_id });
      } catch (err: any) {
        logger.warn('Failed to auto-create medical record on inpatient discharge', { admissionId, error: err.message });
      }
    }

    return admission || null;
  }

  async addVitalsLog(admissionId: string, vitals: { temperature?: number; heartRate?: number; weight?: number; notes?: string; recordedBy: string }) {
    const current = await database.query('SELECT vitals_log FROM inpatient_admissions WHERE id = $1', [admissionId]);
    if (!current.rows[0]) return null;
    const log = current.rows[0].vitals_log || [];
    log.push({ ...vitals, timestamp: new Date().toISOString() });
    const result = await database.query(
      `UPDATE inpatient_admissions SET vitals_log = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(log), admissionId]
    );
    return result.rows[0];
  }

  async updateInpatientDetails(admissionId: string, data: {
    roomNumber?: string; bedNumber?: string; careInstructions?: string;
    medications?: unknown[]; specialNeeds?: string; estimatedDischarge?: string; dailyRate?: number;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.roomNumber !== undefined) { fields.push(`room_number = $${idx++}`); values.push(data.roomNumber); }
    if (data.bedNumber !== undefined) { fields.push(`bed_number = $${idx++}`); values.push(data.bedNumber); }
    if (data.careInstructions !== undefined) { fields.push(`care_instructions = $${idx++}`); values.push(data.careInstructions); }
    if (data.medications !== undefined) { fields.push(`medications = $${idx++}`); values.push(JSON.stringify(data.medications)); }
    if (data.specialNeeds !== undefined) { fields.push(`special_needs = $${idx++}`); values.push(data.specialNeeds); }
    if (data.estimatedDischarge !== undefined) { fields.push(`estimated_discharge = $${idx++}`); values.push(data.estimatedDischarge); }
    if (data.dailyRate !== undefined) { fields.push(`daily_rate = $${idx++}`); values.push(data.dailyRate); }
    if (fields.length === 0) return null;
    values.push(admissionId);
    const result = await database.query(
      `UPDATE inpatient_admissions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async getInpatientDashboard(hospitalId: string) {
    const result = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'discharged')::int AS total_occupied,
        COUNT(*) FILTER (WHERE status = 'admitted')::int AS admitted,
        COUNT(*) FILTER (WHERE status = 'in_treatment')::int AS in_treatment,
        COUNT(*) FILTER (WHERE status = 'recovering')::int AS recovering,
        COUNT(*) FILTER (WHERE status = 'ready_to_discharge')::int AS ready_to_discharge,
        COUNT(*) FILTER (WHERE admission_type = 'icu' AND status != 'discharged')::int AS icu_count,
        COUNT(*) FILTER (WHERE status = 'discharged' AND DATE(discharged_at) = CURRENT_DATE)::int AS discharged_today
      FROM inpatient_admissions
      WHERE hospital_id = $1
    `, [hospitalId]);
    return result.rows[0];
  }

  // Cross-module data visibility: all hospital visits for an animal (for Medical Records page)
  async getAnimalHospitalVisits(animalId: string) {
    const [queueVisits, inpatientAdmissions] = await Promise.all([
      database.query(`
        SELECT q.id, q.hospital_id, q.status, q.priority, q.triage_level, q.reason,
          q.triage_notes, q.checked_in_at, q.completed_at, q.queue_number,
          h.name AS hospital_name,
          u.first_name AS vet_first_name, u.last_name AS vet_last_name,
          wc.id AS case_id, wc.current_stage AS case_stage, wc.chief_complaint, wc.diagnosis
        FROM appointment_queue q
        JOIN vet_hospitals h ON h.id = q.hospital_id
        LEFT JOIN users u ON u.id = q.assigned_vet_id
        LEFT JOIN workflow_cases wc ON wc.queue_entry_id = q.id
        WHERE q.animal_id = $1
        ORDER BY q.checked_in_at DESC
        LIMIT 50
      `, [animalId]),
      database.query(`
        SELECT ia.id, ia.hospital_id, ia.admission_type, ia.status, ia.room_number, ia.bed_number,
          ia.admitted_at, ia.discharged_at, ia.care_instructions, ia.discharge_notes,
          ia.daily_rate, ia.vitals_log,
          h.name AS hospital_name,
          u.first_name AS vet_first_name, u.last_name AS vet_last_name
        FROM inpatient_admissions ia
        JOIN vet_hospitals h ON h.id = ia.hospital_id
        LEFT JOIN users u ON u.id = ia.admitted_by
        WHERE ia.animal_id = $1
        ORDER BY ia.admitted_at DESC
        LIMIT 50
      `, [animalId]),
    ]);
    return {
      queueVisits: queueVisits.rows,
      inpatientAdmissions: inpatientAdmissions.rows,
    };
  }
}

export default new StaffWorkflowService();

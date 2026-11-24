import WithdrawalService from './withdrawal/WithdrawalService';
import { needsWithdrawalChoice, withdrawalAnswered, wholeDays } from './withdrawal/withdrawalMath';
import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { Prescription, CreatePrescriptionDTO, Medication } from '../models/types';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

class PrescriptionService {
  async createPrescription(veterinarianId: string, data: CreatePrescriptionDTO, vetRole?: string): Promise<Prescription> {
    const id = uuidv4();
    const now = new Date();

        // Auto-lookup petOwnerId and subject (animal or group) from consultation if not provided.
    // A batch prescription targets a whole group (herd/flock) in one row - never a fan-out
    // into one prescription per head (see BATCH_ANIMAL_MANAGEMENT_PLAN.md).
    let petOwnerId = data.petOwnerId;
    let animalId = data.animalId || null;
    let groupId = data.groupId || null;
    if (data.consultationId && (!petOwnerId || (!animalId && !groupId))) {
      try {
        const consultResult = await database.query(
          `SELECT user_id, animal_id, group_id FROM consultations WHERE id = $1`,
          [data.consultationId]
        );
        if (consultResult.rows.length > 0) {
          if (!petOwnerId) petOwnerId = consultResult.rows[0].user_id;
          if (!animalId && !groupId) {
            animalId = consultResult.rows[0].animal_id || null;
            groupId = consultResult.rows[0].group_id || null;
          }
        }
      } catch (err) {
        logger.warn('Could not lookup consultation for prescription', { consultationId: data.consultationId, error: err });
      }
    }

    // One subject, said in words: an animal OR a group. (The database also enforces it; this is what the person reads.)
    if (animalId && groupId) throw new ValidationError('A prescription is for one animal or for one group, not both.');
    if (!animalId && !groupId) throw new ValidationError('Choose the animal or the group this prescription is for. This appointment has none linked to it.');

    // A vet writes for the patient's own animal, or one they already have an appointment / network relationship with - never
    // for a stranger's animal (a prescription lands in that animal's record and is shown to its owner).
    if (animalId && vetRole !== 'admin') {
      const ok = await database.query(
        `SELECT 1 FROM animals a WHERE a.id = $1 AND (
             a.owner_id = $2
          OR EXISTS (SELECT 1 FROM enterprises e WHERE e.id = a.enterprise_id AND e.owner_id = $2)
          OR EXISTS (SELECT 1 FROM bookings b WHERE b.animal_id = a.id AND b.veterinarian_id = $3)
          OR EXISTS (SELECT 1 FROM consultations c WHERE c.animal_id = a.id AND c.veterinarian_id = $3)
          OR EXISTS (SELECT 1 FROM animal_care_contexts acc JOIN hospital_network_members hnm ON hnm.network_id = acc.network_id
                      WHERE acc.animal_id = a.id AND acc.is_active = true AND hnm.user_id = $3 AND hnm.is_active = true)
        )`,
        [animalId, petOwnerId, veterinarianId]
      );
      if (ok.rows.length === 0) throw new ForbiddenError('You can prescribe only for an animal that belongs to this patient, or one you already have an appointment for. Choose one of the owner\'s animals.');
    }

    // A vet writes only for a group they are booked or in consultation for (a prescription lands in that farm's group
    // record); a platform admin may write for any.
    if (groupId && vetRole !== 'admin') {
      const FarmAccessService = (await import('./FarmAccessService')).default;
      if (!(await FarmAccessService.consultingVetMayRead(veterinarianId, { groupId }))) {
        throw new ForbiddenError('You can prescribe for a group only when you are booked or in consultation for it. Ask the farm owner to book you for it.');
      }
    }

    // A food-producing animal or herd: every medicine / medicated-feed line carries the label's treatment days and its milk / egg
    // and meat withdrawal days (or an explicit "none"), so the farmer's side is automatic. A pet, a diet or a supplement is exempt.
    if (await WithdrawalService.isFoodProducing({ animalId, groupId })) {
      for (const line of data.medications as any[]) {
        if (!needsWithdrawalChoice(line)) continue;
        const label = String(line.name || 'This medicine');
        if (wholeDays(line.treatmentDays) < 1) throw new ValidationError(`${label}: enter how many days the treatment lasts.`);
        if (!withdrawalAnswered(line)) {
          throw new ValidationError(`${label}: enter the milk / egg and the meat withdrawal days from the product label, or choose "None". The farm needs this to know when milk and meat are safe.`);
        }
      }
    }
    // A "none" answer is stored as 0 days, so a reader never has to guess.
    (data as any).medications = (data.medications as any[]).map(l => (l.withdrawalNone === true ? { ...l, withdrawalMilkDays: 0, withdrawalMeatDays: 0 } : l));

    // For standalone prescriptions (no consultation), petOwnerId must be supplied directly
    if (!petOwnerId && !data.petOwnerId) {
      throw new NotFoundError('petOwnerId is required for prescriptions not linked to a consultation', data.consultationId || 'standalone');
    }

    // The vet may start the course on another day (a course that began yesterday, or starts tomorrow) - within reason.
    let courseStartOn: string | null = null;
    if (data.courseStartOn) {
      const t = Date.parse(data.courseStartOn);
      if (Number.isNaN(t)) throw new ValidationError('The course start day is not a valid date.');
      const days = Math.round((t - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
      if (days < -30 || days > 14) throw new ValidationError('The course start day must be within the last 30 days or the next 14 days.');
      courseStartOn = data.courseStartOn;
    }

    // Default validUntil to 30 days from now if not provided
    const validUntil = data.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Auto-assign primary pharmacy if network prescription
    let targetPharmacyId: string | null = null;
    let isNetworkCoordinated = false;
    const networkId: string | null = (data as any).networkId || null;
    if (networkId) {
      try {
        const pharmaResult = await database.query(
          `SELECT id FROM hospital_pharmacies WHERE network_id = $1 AND is_primary_pharmacy = true AND is_active = true LIMIT 1`,
          [networkId]
        );
        if (pharmaResult.rows[0]) {
          targetPharmacyId = pharmaResult.rows[0].id;
          isNetworkCoordinated = true;
        }
            } catch (err) {
        logger.warn('Could not auto-assign pharmacy for network prescription', { networkId, error: err });
      }
    }

    // A group prescription belongs to the group's open production cycle, and records how many were treated (the group's head
    // count unless the vet says fewer) so the obligation survives later changes to the group.
    let cycleId = data.cycleId || null;
    let headCountTreated = data.headCountTreated ?? null;
    if (groupId) {
      if (!cycleId) {
        const cyc = await database.query(`SELECT id FROM group_cycles WHERE group_id = $1 AND status = 'active' LIMIT 1`, [groupId]);
        cycleId = cyc.rows[0]?.id || null;
      }
      if (headCountTreated === null) {
        const g = await database.query(`SELECT current_count FROM animal_groups WHERE id = $1`, [groupId]);
        headCountTreated = g.rows[0] ? Number(g.rows[0].current_count) : null;
      }
    }

    const result = await database.query(
      `INSERT INTO prescriptions (id, consultation_id, veterinarian_id, pet_owner_id, animal_id,
       group_id, cycle_id, head_count_treated,
       medications, instructions, valid_until, is_active, network_id, is_network_coordinated, target_pharmacy_id, review_status, created_at, updated_at, course_start_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id, consultation_id as "consultationId", veterinarian_id as "veterinarianId",
       pet_owner_id as "petOwnerId", animal_id as "animalId", group_id as "groupId",
       cycle_id as "cycleId", head_count_treated as "headCountTreated", medications, instructions,
       valid_until as "validUntil", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [id, data.consultationId, veterinarianId, petOwnerId, animalId, groupId, cycleId, headCountTreated,
       JSON.stringify(data.medications), data.instructions, validUntil, true,
       networkId, isNetworkCoordinated, targetPharmacyId,
       isNetworkCoordinated ? 'pending_review' : null,
       now, now, courseStartOn]
    );

    logger.info('Prescription created', { prescriptionId: id, consultationId: data.consultationId });
    // Tell the farm that milk / meat must be held back (the same dates the banner and the due list will show).
    await WithdrawalService.notifyStarted({ id, animalId, groupId, medications: data.medications as any[] }).catch(() => undefined);

    // Notify the network's pharmacists that a new prescription is awaiting review
    if (isNetworkCoordinated && targetPharmacyId) {
      try {
        const [vetRow, animalRow, pharmacists] = await Promise.all([
          database.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [veterinarianId]),
          animalId ? database.query(`SELECT name FROM animals WHERE id = $1`, [animalId]) : Promise.resolve({ rows: [] as any[] }),
          database.query(
            `SELECT hnm.user_id FROM hospital_network_members hnm
             JOIN users u ON u.id = hnm.user_id
             WHERE hnm.network_id = $1 AND hnm.is_active = true AND u.role = 'pharmacist'
               AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
            [networkId]
          ),
        ]);
        const vetName = vetRow.rows[0] ? `${vetRow.rows[0].first_name} ${vetRow.rows[0].last_name}` : 'A veterinarian';
        const animalName = animalRow.rows[0]?.name || 'a patient';
        if (pharmacists.rows.length > 0) {
          const NSvc = (await import('./NotificationService')).default;
          await Promise.all(pharmacists.rows.map((p: any) =>
            NSvc.createNotification(
              p.user_id, 'prescription', 'New Prescription for Review',
              `${vetName} sent a prescription for ${animalName} for your review.`,
              'all', { prescriptionId: id, targetPharmacyId }
            )
          ));
        }
      } catch (err) {
        logger.warn('Failed to notify pharmacists of new prescription', { prescriptionId: id, error: err });
      }
    }

    // If diagnosis or followUpDate provided, update the consultation record
    if (data.consultationId && (data.diagnosis || data.followUpDate)) {
      try {
        const updates: string[] = [];
        const vals: any[] = [data.consultationId];
        let idx = 2;
        if (data.diagnosis) {
          updates.push(`diagnosis = $${idx++}`);
          vals.push(data.diagnosis);
        }
        if (data.followUpDate) {
          updates.push(`follow_up_date = $${idx++}`);
          vals.push(data.followUpDate);
        }
        updates.push('updated_at = NOW()');
        await database.query(
          `UPDATE consultations SET ${updates.join(', ')} WHERE id = $1`,
          vals
        );
        logger.info('Consultation updated with prescription diagnosis/followUp', { consultationId: data.consultationId });
      } catch (err) {
        logger.warn('Failed to update consultation with prescription data', { error: err });
      }
    }

    return result.rows[0];
  }

  async getPrescription(id: string): Promise<Prescription> {
    const result = await database.query(
            `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(v.first_name || ' ' || v.last_name, 'Unknown') as "vetName",
       COALESCE(o.first_name || ' ' || o.last_name, 'Unknown') as "petOwnerName",
       a.name as "animalName", a.species as "animalSpecies", a.breed as "animalBreed",
       a.unique_id as "animalUniqueId",
       a.date_of_birth as "animalDob", a.gender as "animalGender", a.animal_class as "animalClass",
       a.breeding_status as "animalBreedingStatus", a.expected_due_date as "animalDueDate",
       a.avg_daily_milk_litres as "animalAvgMilkLitres", a.parity as "animalParity",
       a.dry_off_date as "animalDryOffDate", COALESCE(a.current_weight, a.weight) as "animalWeight",
       g.name as "groupName", g.management_mode as "groupManagementMode",
       gc.name as "cycleName", gc.cycle_number as "cycleNumber",
       c.diagnosis, c.symptom_description as "chiefComplaints",
       vp.license_number as "vetLicense",
       vp.specializations as "vetSpecializations",
       vp.qualifications as "vetQualifications",
       vp.clinic_name as "vetClinicName",
       vp.clinic_address as "vetClinicAddress"
       FROM prescriptions p
       LEFT JOIN users v ON v.id = p.veterinarian_id
       LEFT JOIN users o ON o.id = p.pet_owner_id
       LEFT JOIN animals a ON a.id = p.animal_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN group_cycles gc ON gc.id = p.cycle_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       LEFT JOIN vet_profiles vp ON vp.user_id = p.veterinarian_id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) throw new NotFoundError('Prescription', id);
    
    const row = result.rows[0];
    if (typeof row.medications === 'string') {
      row.medications = JSON.parse(row.medications);
    }
    return row;
  }

  async listByConsultation(consultationId: string): Promise<Prescription[]> {
    const result = await database.query(
            `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(v.first_name || ' ' || v.last_name, 'Unknown') as "vetName",
       COALESCE(o.first_name || ' ' || o.last_name, 'Unknown') as "petOwnerName",
       a.name as "animalName", g.name as "groupName",
       c.diagnosis
       FROM prescriptions p
       LEFT JOIN users v ON v.id = p.veterinarian_id
       LEFT JOIN users o ON o.id = p.pet_owner_id
       LEFT JOIN animals a ON a.id = p.animal_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       WHERE p.consultation_id = $1 ORDER BY p.created_at DESC`,
      [consultationId]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async listByPetOwner(petOwnerId: string, params?: { limit?: number; offset?: number }): Promise<Prescription[]> {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;

    const result = await database.query(
            `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.review_status as "reviewStatus",
       p.is_network_coordinated as "isNetworkCoordinated",
       p.reviewed_at as "reviewedAt", p.review_notes as "reviewNotes",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as "vetName",
       a.name as "animalName", a.species as "animalSpecies", a.breed as "animalBreed",
       a.unique_id as "animalUniqueId",
       a.gender as "animalGender", a.animal_class as "animalClass",
       a.breeding_status as "animalBreedingStatus", a.expected_due_date as "animalDueDate",
       a.avg_daily_milk_litres as "animalAvgMilkLitres", a.parity as "animalParity",
       a.dry_off_date as "animalDryOffDate", COALESCE(a.current_weight, a.weight) as "animalWeight",
       g.name as "groupName", g.management_mode as "groupManagementMode",
       gc.name as "cycleName", gc.cycle_number as "cycleNumber",
       c.diagnosis,
       hp.pharmacy_name as "pharmacyName",
       dr.dispensing_status as "dispensingStatus",
       dr.created_at as "dispensedAt",
       dr.dispensing_method as "dispensingMethod"
       FROM prescriptions p
       LEFT JOIN users u ON u.id = p.veterinarian_id
       LEFT JOIN animals a ON a.id = p.animal_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN group_cycles gc ON gc.id = p.cycle_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       LEFT JOIN hospital_pharmacies hp ON hp.id = p.target_pharmacy_id
       LEFT JOIN dispensing_records dr ON dr.prescription_id = p.id AND dr.dispensing_status != 'cancelled'
       WHERE p.pet_owner_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [petOwnerId, limit, offset]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async listByVeterinarian(veterinarianId: string, params?: { limit?: number; offset?: number }): Promise<Prescription[]> {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;

    const result = await database.query(
            `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.review_status as "reviewStatus",
       p.is_network_coordinated as "isNetworkCoordinated",
       p.reviewed_at as "reviewedAt", p.review_notes as "reviewNotes",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as "petOwnerName",
       a.name as "animalName", a.species as "animalSpecies", a.breed as "animalBreed",
       a.unique_id as "animalUniqueId",
       a.gender as "animalGender", a.animal_class as "animalClass",
       a.breeding_status as "animalBreedingStatus", a.expected_due_date as "animalDueDate",
       a.avg_daily_milk_litres as "animalAvgMilkLitres", a.parity as "animalParity",
       a.dry_off_date as "animalDryOffDate", COALESCE(a.current_weight, a.weight) as "animalWeight",
       g.name as "groupName", g.management_mode as "groupManagementMode",
       gc.name as "cycleName", gc.cycle_number as "cycleNumber",
       c.diagnosis,
       hp.pharmacy_name as "pharmacyName",
       dr.dispensing_status as "dispensingStatus",
       dr.created_at as "dispensedAt"
       FROM prescriptions p
       LEFT JOIN users u ON u.id = p.pet_owner_id
       LEFT JOIN animals a ON a.id = p.animal_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN group_cycles gc ON gc.id = p.cycle_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       LEFT JOIN hospital_pharmacies hp ON hp.id = p.target_pharmacy_id
       LEFT JOIN dispensing_records dr ON dr.prescription_id = p.id AND dr.dispensing_status != 'cancelled'
       WHERE p.veterinarian_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [veterinarianId, limit, offset]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async listByAnimal(animalId: string, params?: { limit?: number; offset?: number }): Promise<{ prescriptions: Prescription[]; total: number }> {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const result = await database.query(
            `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.review_status as "reviewStatus", p.is_network_coordinated as "isNetworkCoordinated",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as "veterinarianName",
       g.name as "groupName",
       c.diagnosis,
       hp.pharmacy_name as "pharmacyName",
       dr.dispensing_status as "dispensingStatus", dr.dispensing_method as "dispensingMethod",
       dr.created_at as "dispensedAt"
       FROM prescriptions p
       LEFT JOIN users u ON u.id = p.veterinarian_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       LEFT JOIN hospital_pharmacies hp ON hp.id = p.target_pharmacy_id
       LEFT JOIN dispensing_records dr ON dr.prescription_id = p.id AND dr.dispensing_status != 'cancelled'
       WHERE p.animal_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [animalId, limit, offset]
    );
    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM prescriptions WHERE animal_id = $1`,
      [animalId]
    );
    return {
      prescriptions: result.rows.map((row: any) => {
        if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
        return row;
      }),
            total: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  async listByGroup(groupId: string, params?: { limit?: number; offset?: number }): Promise<{ prescriptions: Prescription[]; total: number }> {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const result = await database.query(
      `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.review_status as "reviewStatus", p.is_network_coordinated as "isNetworkCoordinated",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as "veterinarianName",
       g.name as "groupName", gc.name as "cycleName", gc.cycle_number as "cycleNumber",
       c.diagnosis,
       hp.pharmacy_name as "pharmacyName",
       dr.dispensing_status as "dispensingStatus", dr.dispensing_method as "dispensingMethod",
       dr.created_at as "dispensedAt"
       FROM prescriptions p
       LEFT JOIN users u ON u.id = p.veterinarian_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN group_cycles gc ON gc.id = p.cycle_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       LEFT JOIN hospital_pharmacies hp ON hp.id = p.target_pharmacy_id
       LEFT JOIN dispensing_records dr ON dr.prescription_id = p.id AND dr.dispensing_status != 'cancelled'
       WHERE p.group_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );
    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM prescriptions WHERE group_id = $1`,
      [groupId]
    );
    return {
      prescriptions: result.rows.map((row: any) => {
        if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
        return row;
      }),
      total: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  async listAll(params?: { limit?: number; offset?: number }): Promise<Prescription[]> {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const result = await database.query(
            `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.group_id as "groupId",
       p.cycle_id as "cycleId", p.head_count_treated as "headCountTreated",
       p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(v.first_name || ' ' || v.last_name, 'Unknown') as "vetName",
       COALESCE(o.first_name || ' ' || o.last_name, 'Unknown') as "petOwnerName",
       a.name as "animalName", a.species as "animalSpecies", a.breed as "animalBreed",
       a.gender as "animalGender", a.animal_class as "animalClass",
       a.breeding_status as "animalBreedingStatus", a.expected_due_date as "animalDueDate",
       a.avg_daily_milk_litres as "animalAvgMilkLitres", a.parity as "animalParity",
       a.dry_off_date as "animalDryOffDate", COALESCE(a.current_weight, a.weight) as "animalWeight",
       g.name as "groupName",
       c.diagnosis
       FROM prescriptions p
       LEFT JOIN users v ON v.id = p.veterinarian_id
       LEFT JOIN users o ON o.id = p.pet_owner_id
       LEFT JOIN animals a ON a.id = p.animal_id
       LEFT JOIN animal_groups g ON g.id = p.group_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async deactivatePrescription(id: string): Promise<Prescription> {
    const result = await database.query(
      `UPDATE prescriptions SET is_active = $1, updated_at = $2 WHERE id = $3
       RETURNING id, consultation_id as "consultationId", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [false, new Date(), id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Prescription', id);
    return result.rows[0];
  }
}

export default new PrescriptionService();

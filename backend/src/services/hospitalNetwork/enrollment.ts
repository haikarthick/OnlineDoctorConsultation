import database from '../../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors';
import logger from '../../utils/logger';
import NotificationService from '../NotificationService';
import type { WalkInInviteDTO } from './types';
import { generateNetworkPatientId } from './consentAndPatientId';
import { getNetworkMember } from './members';
  export async function enrollAnimal(data: { animalId: string; networkId: string; hospitalId?: string; enrolledBy: string; notes?: string }): Promise<{ id: string; animalId: string; networkId: string; networkPatientId: string; platformUniqueId: string | null; enrollmentStatus: string }> {
    try {
      // Fix 4a: Verify hospital belongs to this network (only when hospitalId provided)
      if (data.hospitalId) {
        const hospitalInNetwork = await database.query(
          `SELECT id FROM hospital_network_members 
           WHERE network_id = $1 AND hospital_id = $2 AND is_active = true LIMIT 1`,
          [data.networkId, data.hospitalId]
        );
        if (hospitalInNetwork.rows.length === 0) {
          throw new ValidationError('Hospital is not a member of this network');
        }
      }

      // Fix 4b: Verify enrolledBy user has permission (network member or hospital staff)
      const userPermission = await database.query(
        `SELECT hnm.network_role 
         FROM hospital_network_members hnm 
         WHERE hnm.network_id = $1 AND hnm.user_id = $2 AND hnm.is_active = true
         UNION
         SELECT 'hospital_staff' AS network_role
         FROM hospital_staff hs
         WHERE hs.hospital_id = $3 AND hs.user_id = $2 AND hs.is_active = true
         LIMIT 1`,
        [data.networkId, data.enrolledBy, data.hospitalId ?? null]
      );
      if (userPermission.rows.length === 0) {
        throw new ForbiddenError('You do not have permission to enroll patients in this network');
      }

      const animalRes = await database.query(
        `SELECT a.id, a.species, a.unique_id, a.name AS animal_name, a.owner_id,
                u.name AS owner_name
         FROM animals a JOIN users u ON a.owner_id = u.id
         WHERE a.id = $1 AND a.is_active = true`, [data.animalId]
      );
      if (!animalRes.rows[0]) throw new NotFoundError('Animal');
      const animal = animalRes.rows[0];

      // Ownership / consent check: only the owner, or a network admin with consent, can enroll
      const ownerCheck = await database.query(
        `SELECT 1 FROM animals WHERE id = $1 AND owner_id = $2`,
        [data.animalId, data.enrolledBy]
      );
      const consentCheck = await database.query(
        `SELECT 1 FROM patient_data_consent
         WHERE animal_id = $1 AND granted_to_network_id = $2 AND is_active = true
           AND (valid_until IS NULL OR valid_until > NOW())`,
        [data.animalId, data.networkId]
      );
      const userRoleRes = await database.query(
        `SELECT network_role FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
        [data.networkId, data.enrolledBy]
      );
      const userNetworkRole = userRoleRes.rows[0]?.network_role;
      const isOwner = ownerCheck.rows.length > 0;
      const hasConsent = consentCheck.rows.length > 0;
      const isNetworkAdmin = ['corporate_admin', 'hospital_director'].includes(userNetworkRole);

      // A network admin may only request enrollment for a patient who already
      // has SOME footprint with this network (referral, walk-in visit, or
      // inpatient stay at one of its hospitals) -- prevents a corporate_admin
      // from cold-enrolling an arbitrary platform animal they've never
      // actually interacted with, just by guessing/knowing its id.
      let hasNetworkFootprint = false;
      if (isNetworkAdmin && !isOwner && !hasConsent) {
        const footprintCheck = await database.query(
          `SELECT 1 FROM referrals r WHERE r.animal_id = $1
             AND r.hospital_id IN (SELECT hospital_id FROM hospital_network_hospitals WHERE network_id = $2)
           UNION
           SELECT 1 FROM appointment_queue q WHERE q.animal_id = $1
             AND q.hospital_id IN (SELECT hospital_id FROM hospital_network_hospitals WHERE network_id = $2)
           UNION
           SELECT 1 FROM inpatient_admissions ia WHERE ia.animal_id = $1
             AND ia.hospital_id IN (SELECT hospital_id FROM hospital_network_hospitals WHERE network_id = $2)
           LIMIT 1`,
          [data.animalId, data.networkId]
        );
        hasNetworkFootprint = footprintCheck.rows.length > 0;
      }

      if (!isOwner && !hasConsent && !(isNetworkAdmin && hasNetworkFootprint)) {
        throw new ForbiddenError(
          'This patient has no prior visit, referral, or admission with your network. ' +
          'Use "Register Walk-In" for a new patient, or ask the owner to share their enrollment code.'
        );
      }

      const networkPatientId = await generateNetworkPatientId(data.networkId, animal.species);
      const netRes = await database.query(`SELECT name FROM hospital_networks WHERE id = $1`, [data.networkId]);
      const networkName = netRes.rows[0]?.name ?? 'Hospital Network';

      const result = await database.query(
        `INSERT INTO animal_care_contexts
           (animal_id, network_id, hospital_id, platform_unique_id, corporate_patient_id,
            enrolled_by, notes, visibility, enrollment_status, enrollment_requested_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'private', 'pending_consent', CURRENT_TIMESTAMP)
         ON CONFLICT (animal_id, network_id) DO UPDATE
           SET corporate_patient_id = EXCLUDED.corporate_patient_id,
               hospital_id = EXCLUDED.hospital_id,
               is_active = true,
               enrollment_status = 'pending_consent',
               enrollment_requested_at = CURRENT_TIMESTAMP,
               enrollment_responded_at = NULL
         RETURNING id, animal_id AS "animalId", network_id AS "networkId",
                   corporate_patient_id AS "networkPatientId",
                   platform_unique_id AS "platformUniqueId",
                   enrollment_status AS "enrollmentStatus"`,
        [data.animalId, data.networkId, data.hospitalId ?? null, animal.unique_id, networkPatientId, data.enrolledBy, data.notes ?? null]
      );

      // Notify the animal owner about the enrollment request
      try {
        const notifTitle = 'Network Enrollment Request';
        const notifMessage = `${networkName} has requested to enroll your animal "${animal.animal_name}" into their network. Please review and accept or decline.`;
        await NotificationService.createNotification(
          animal.owner_id, 'enrollment_requested', notifTitle, notifMessage, 'all',
          { networkId: data.networkId, networkName, animalId: data.animalId, animalName: animal.animal_name }
        );
      } catch (notifErr: any) {
        logger.warn('Failed to send enrollment notification', { error: notifErr.message });
      }
      logger.info('Enrollment request created', { networkName, animalName: animal.animal_name, ownerId: animal.owner_id });

      return result.rows[0];
    } catch (err: any) {
      throw new DatabaseError(`Enroll animal failed: ${err.message}`);
    }
  }

  export async function getNetworkPatients(networkId: string, limit = 50, offset = 0, branchScopeHospitalId: string | null = null): Promise<{ total: number; patients: any[] }> {
    try {
      // Branch-scoped roles (hospital_director / hospital_staff) only see patients in their own branch.
      const branchClause = branchScopeHospitalId ? ` AND acc.hospital_id = $2` : '';
      const countParams: any[] = branchScopeHospitalId ? [networkId, branchScopeHospitalId] : [networkId];
      const countRes = await database.query(
        `SELECT COUNT(*) AS total FROM animal_care_contexts acc WHERE acc.network_id = $1 AND acc.is_active = true${branchClause}`,
        countParams
      );
      const limitIdx = branchScopeHospitalId ? 3 : 2;
      const rowParams: any[] = branchScopeHospitalId
        ? [networkId, branchScopeHospitalId, limit, offset]
        : [networkId, limit, offset];
      const rows = await database.query(
        `SELECT acc.id, acc.animal_id AS "animalId", acc.corporate_patient_id AS "networkPatientId",
                acc.platform_unique_id AS "platformUniqueId", acc.enrolled_at AS "enrolledAt",
                acc.hospital_id AS "hospitalId", acc.visibility,
                a.name AS "animalName", a.species, a.breed, a.gender,
                u.name AS "ownerName"
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN users u ON a.owner_id = u.id
         WHERE acc.network_id = $1 AND acc.is_active = true${branchClause}
         ORDER BY acc.enrolled_at DESC
         LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
        rowParams
      );
      return { total: parseInt(countRes.rows[0].total), patients: rows.rows };
    } catch (err: any) {
      throw new DatabaseError(`Get network patients failed: ${err.message}`);
    }
  }

  export async function acceptEnrollment(contextId: string, ownerId: string, consentScope?: string): Promise<void> {
    try {
      const check = await database.query(
        `SELECT acc.id, acc.animal_id, acc.network_id, acc.corporate_patient_id,
                a.owner_id, a.name AS animal_name, hn.name AS network_name
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN hospital_networks hn ON acc.network_id = hn.id
         WHERE acc.id = $1 AND a.owner_id = $2 AND acc.enrollment_status = 'pending_consent'`,
        [contextId, ownerId]
      );
      if (!check.rows[0]) throw new NotFoundError('Enrollment request not found or already responded');
      const ctx = check.rows[0];

      await database.query(
        `UPDATE animal_care_contexts
         SET enrollment_status = 'active', enrollment_responded_at = CURRENT_TIMESTAMP, is_active = true
         WHERE id = $1`,
        [contextId]
      );

      await database.query(
        `INSERT INTO patient_data_consent
           (animal_id, owner_id, granted_to_network_id, consent_scope,
            allow_medical_records, allow_vaccination_records, allow_prescriptions,
            allow_lab_results, allow_genetic_data, include_hospital_records,
            allow_view, allow_create_notes, allow_prescribe, is_active)
         VALUES ($1, $2, $3, $4, true, true, true, false, false, false, true, true, false, true)
         ON CONFLICT DO NOTHING`,
        [ctx.animal_id, ownerId, ctx.network_id, consentScope ?? 'basic_history']
      );
    } catch (err: any) {
      throw new DatabaseError(`Accept enrollment failed: ${err.message}`);
    }
  }

  export async function declineEnrollment(contextId: string, ownerId: string): Promise<void> {
    try {
      const result = await database.query(
        `UPDATE animal_care_contexts acc
         SET enrollment_status = 'declined', enrollment_responded_at = CURRENT_TIMESTAMP, is_active = false
         FROM animals a
         WHERE acc.id = $1 AND acc.animal_id = a.id AND a.owner_id = $2
           AND acc.enrollment_status = 'pending_consent'
         RETURNING acc.id`,
        [contextId, ownerId]
      );
      if (!result.rows[0]) throw new NotFoundError('Enrollment request');
    } catch (err: any) {
      throw new DatabaseError(`Decline enrollment failed: ${err.message}`);
    }
  }

  export async function getMyEnrollments(ownerId: string): Promise<any[]> {
    try {
      const result = await database.query(
        `SELECT acc.id, acc.animal_id AS "animalId", acc.network_id AS "networkId",
                acc.hospital_id AS "hospitalId", acc.corporate_patient_id AS "networkPatientId",
                acc.platform_unique_id AS "platformUniqueId", acc.enrollment_status AS "enrollmentStatus",
                acc.enrollment_requested_at AS "enrollmentRequestedAt",
                acc.enrollment_responded_at AS "enrollmentRespondedAt",
                acc.visibility, acc.notes,
                a.name AS "animalName", a.species, a.breed,
                hn.name AS "networkName", hn.id_prefix AS "networkPrefix",
                vh.name AS "hospitalName",
                u_by.first_name || ' ' || u_by.last_name AS "enrolledByName"
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN hospital_networks hn ON acc.network_id = hn.id
         LEFT JOIN vet_hospitals vh ON acc.hospital_id = vh.id
         LEFT JOIN users u_by ON acc.enrolled_by = u_by.id
         WHERE a.owner_id = $1
         ORDER BY acc.enrollment_requested_at DESC`,
        [ownerId]
      );
      return result.rows;
    } catch (err: any) {
      throw new DatabaseError(`Get my enrollments failed: ${err.message}`);
    }
  }

  export async function inviteWalkInPatient(data: WalkInInviteDTO, invitedBy: string): Promise<{ id: string; inviteToken: string }> {
    try {
      const crypto = await import('crypto');
      const token = crypto.randomBytes(48).toString('hex');
      const result = await database.query(
        `INSERT INTO hospital_patient_invites
           (network_id, hospital_id, invited_by, patient_name, patient_email, patient_phone,
            animal_name, animal_species, invite_token, message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, invite_token AS "inviteToken"`,
        [data.networkId, data.hospitalId ?? null, invitedBy, data.patientName, data.patientEmail,
         data.patientPhone ?? null, data.animalName ?? null, data.animalSpecies ?? null, token, data.message ?? null]
      );
      return result.rows[0];
    } catch (err: any) {
      throw new DatabaseError(`Invite walk-in patient failed: ${err.message}`);
    }
  }

  // Fix 6: Accept a walk-in patient invite by token, with expiry and status validation
  export async function acceptWalkInInvite(token: string, acceptedByUserId: string): Promise<{ id: string; networkId: string; hospitalId: string | null }> {
    try {
      const inviteRes = await database.query(
        `SELECT * FROM hospital_patient_invites WHERE invite_token = $1 LIMIT 1`,
        [token]
      );
      if (inviteRes.rows.length === 0) {
        throw new NotFoundError('Invitation not found. Please check the link and try again.');
      }
      const invite = inviteRes.rows[0];

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw new ValidationError('This invitation has expired. Please request a new invitation.');
      }
      if (invite.status !== 'pending') {
        throw new ConflictError(`This invitation has already been ${invite.status}.`);
      }

      await database.query(
        `UPDATE hospital_patient_invites
         SET status = 'accepted', accepted_at = NOW(), accepted_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [acceptedByUserId, invite.id]
      );
      return { id: invite.id, networkId: invite.network_id, hospitalId: invite.hospital_id };
    } catch (err: any) {
      throw new DatabaseError(err.message);
    }
  }

  // Direct walk-in registration: Staff registers patient on-site, treatment starts immediately.
  // No invite or consent needed - patient is enrolled as 'active' with 'walkin' visibility.
  // If the patient later wants online portal access, staff can send an invite separately.
  export async function registerWalkInPatientDirect(data: {
    networkId: string; hospitalId: string; registeredBy: string;
    patientName: string; patientPhone?: string; patientEmail?: string; patientAddress?: string;
    animalName: string; animalSpecies: string; animalBreed?: string;
    animalGender?: string; animalClass?: string; animalDob?: string; animalWeight?: number;
    animalColor?: string; animalMicrochipId?: string; animalRegistrationNumber?: string;
    animalIsNeutered?: boolean; animalMedicalNotes?: string; animalAvatarUrl?: string;
    animalInsuranceProvider?: string; animalInsurancePolicyNumber?: string; animalInsuranceExpiry?: string;
    animalEarTagId?: string;
    reasonForVisit?: string;
    consentCollected?: boolean; consentMethod?: string;
  }): Promise<{ patientId: string; networkPatientId: string; animalId: string; ownerId: string | null }> {
    try {
      // Verify the registering user is a network member
      const member = await getNetworkMember(data.networkId, data.registeredBy);
      if (!member) throw new ForbiddenError('You are not a member of this network');

      // Create a placeholder user for the walk-in patient (or find existing by email/phone)
      let ownerId: string | null = null;
      if (data.patientEmail) {
        const existing = await database.query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`, [data.patientEmail]
        );
        if (existing.rows.length > 0) ownerId = existing.rows[0].id;
      }

      // If no existing user found, create a walk-in placeholder account
      if (!ownerId) {
        const crypto = await import('crypto');
        const placeholderPassword = crypto.randomBytes(32).toString('hex');
        const nameParts = data.patientName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Walk-In';
        const lastName = nameParts.slice(1).join(' ') || 'Patient';
        const userRes = await database.query(
          `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, 'pet_owner', true)
           ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
           RETURNING id`,
          [firstName, lastName, data.patientEmail || `walkin-${Date.now()}@placeholder.local`,
           data.patientPhone || null, placeholderPassword]
        );
        ownerId = userRes.rows[0].id;
      }

      // Create the animal record
      const animalUniqueId = `VC-${data.animalSpecies.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const animalRes = await database.query(
        `INSERT INTO animals
           (name, species, breed, owner_id, unique_id, is_active,
            gender, date_of_birth, weight, color, microchip_id, registration_number,
            is_neutered, medical_notes, avatar_url,
            insurance_provider, insurance_policy_number, insurance_expiry,
            ear_tag_id, animal_class)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING id`,
        [
          data.animalName, data.animalSpecies, data.animalBreed || null, ownerId, animalUniqueId,
          data.animalGender || null,
          data.animalDob || null,
          data.animalWeight ?? null,
          data.animalColor || null,
          data.animalMicrochipId || null,
          data.animalRegistrationNumber || null,
          data.animalIsNeutered ?? false,
          data.animalMedicalNotes || null,
          data.animalAvatarUrl || null,
          data.animalInsuranceProvider || null,
          data.animalInsurancePolicyNumber || null,
          data.animalInsuranceExpiry || null,
          data.animalEarTagId || null,
          data.animalClass || null,
        ]
      );
      const animalId = animalRes.rows[0].id;

      // Enroll - active if consent was collected, pending_consent otherwise
      const enrollmentStatus = data.consentCollected === true ? 'active' : 'pending_consent';
      const networkPatientId = await generateNetworkPatientId(data.networkId, data.animalSpecies);
      const contextRes = await database.query(
        `INSERT INTO animal_care_contexts
           (animal_id, network_id, hospital_id, platform_unique_id, corporate_patient_id,
            enrolled_by, visibility, enrollment_status, enrollment_requested_at, enrollment_responded_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'network_only', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)
         ON CONFLICT (animal_id, network_id) DO UPDATE
           SET enrollment_status = $7, enrollment_responded_at = CURRENT_TIMESTAMP,
               hospital_id = EXCLUDED.hospital_id, is_active = true
         RETURNING id`,
        [animalId, data.networkId, data.hospitalId, animalUniqueId, networkPatientId,
         data.registeredBy, enrollmentStatus, data.reasonForVisit || 'Walk-in registration']
      );

      // Notify owner about walk-in registration (if they have an email)
      if (data.patientEmail && ownerId) {
        try {
          const networkRes = await database.query(`SELECT name FROM hospital_networks WHERE id = $1`, [data.networkId]);
          const networkName = networkRes.rows[0]?.name ?? 'the hospital';
          await NotificationService.createNotification(
            ownerId, 'walkin_registered',
            'Walk-in Registration Completed',
            `Your animal "${data.animalName}" has been registered at ${networkName}. ${data.consentCollected ? 'Consent was collected at registration.' : 'Please log in to review and confirm the enrollment.'}`,
            data.consentCollected ? 'in_app' : 'all',
            { networkId: data.networkId, animalId, consentRequired: !data.consentCollected }
          );
        } catch (notifErr: any) {
          logger.warn('Failed to send walk-in registration notification', { error: notifErr.message });
        }
      }

      logger.info('Walk-in patient registered directly', { networkPatientId, animalName: data.animalName, hospitalId: data.hospitalId });

      return {
        patientId: contextRes.rows[0].id,
        ownerId,
        networkPatientId,
        animalId
      };
    } catch (err: any) {
      if (err instanceof ForbiddenError || err instanceof ValidationError) throw err;
      throw new DatabaseError(`Walk-in registration failed: ${err.message}`);
    }
  }

  export async function getPendingEnrollments(networkId: string): Promise<any[]> {
    try {
      const result = await database.query(
        `SELECT acc.id, acc.animal_id AS "animalId", acc.enrollment_status AS "enrollmentStatus",
                acc.corporate_patient_id AS "networkPatientId",
                acc.enrollment_requested_at AS "enrollmentRequestedAt",
                acc.enrollment_responded_at AS "enrollmentRespondedAt",
                a.name AS "animalName", a.species, a.breed,
                u.name AS "ownerName", u.email AS "ownerEmail"
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN users u ON a.owner_id = u.id
         WHERE acc.network_id = $1
         ORDER BY acc.enrollment_status, acc.enrollment_requested_at DESC`,
        [networkId]
      );
      return result.rows;
    } catch (err: any) {
      throw new DatabaseError(`Get pending enrollments failed: ${err.message}`);
    }
  }


import database from '../../utils/database';
import { DatabaseError, ForbiddenError } from '../../utils/errors';
import logger from '../../utils/logger';
import type { PatientConsent, PatientConsentDTO } from './types';
import { mapConsentRow } from './rowMappersAndDeactivate';
  // ─── Patient Consent ──────────────────────────────────────────
  export async function createConsent(data: PatientConsentDTO, ownerId: string): Promise<PatientConsent> {
    try {
      const result = await database.query(
        `INSERT INTO patient_data_consent
           (animal_id, owner_id, granted_to_user_id, granted_to_hospital_id, granted_to_network_id,
            consent_scope, allow_medical_records, allow_vaccination_records, allow_prescriptions,
            allow_lab_results, allow_genetic_data, include_hospital_records,
            allow_view, allow_create_notes, allow_prescribe,
            valid_from, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          data.animalId,
          ownerId,
          data.grantedToUserId ?? null,
          data.grantedToHospitalId ?? null,
          data.grantedToNetworkId ?? null,
          data.consentScope,
          data.allowMedicalRecords ?? true,
          data.allowVaccinationRecords ?? true,
          data.allowPrescriptions ?? true,
          data.allowLabResults ?? false,
          data.allowGeneticData ?? false,
          data.includeHospitalRecords ?? false,
          data.allowView ?? true,
          data.allowCreateNotes ?? false,
          data.allowPrescribe ?? false,
          data.validFrom ?? new Date(),
          data.validUntil ?? null,
        ]
      );
      return mapConsentRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create patient consent', { error: error.message });
      throw new DatabaseError('Failed to create patient consent');
    }
  }

  export async function listConsents(animalId: string, ownerId: string): Promise<PatientConsent[]> {
    const result = await database.query(
      `SELECT pdc.*,
              a.name AS "animalName",
              u.first_name || ' ' || u.last_name AS "grantedToUserName",
              vh.name AS "grantedToHospitalName",
              hn.name AS "grantedToNetworkName"
       FROM patient_data_consent pdc
       JOIN animals a ON pdc.animal_id = a.id
       LEFT JOIN users u ON pdc.granted_to_user_id = u.id
       LEFT JOIN vet_hospitals vh ON pdc.granted_to_hospital_id = vh.id
       LEFT JOIN hospital_networks hn ON pdc.granted_to_network_id = hn.id
       WHERE pdc.animal_id = $1 AND pdc.owner_id = $2
       ORDER BY pdc.created_at DESC`,
      [animalId, ownerId]
    );
    return result.rows.map((r: any) => mapConsentRow(r));
  }

  export async function revokeConsent(consentId: string, ownerId: string, reason: string): Promise<void> {
    const result = await database.query(
      `UPDATE patient_data_consent
       SET is_active = false, revoked_at = NOW(), revoked_reason = $3, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2`,
      [consentId, ownerId, reason]
    );
    if (result.rowCount === 0) {
      throw new ForbiddenError('Consent not found or you do not own it');
    }
  }

  // ─── Row Mappers ──────────────────────────────────────────────
  export async function generateNetworkPatientId(networkId: string, species: string): Promise<string> {
    const netRes = await database.query(
      `SELECT id_prefix FROM hospital_networks WHERE id = $1`, [networkId]
    );
    const prefix = (netRes.rows[0]?.id_prefix ?? 'NET').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

    const SPECIES_CODES: Record<string, string> = {
      dog: 'DOG', canine: 'DOG', cat: 'CAT', feline: 'CAT',
      rabbit: 'RAB', hamster: 'HAM', 'guinea pig': 'GNP', gerbil: 'GRB',
      chinchilla: 'CHN', ferret: 'FRT', hedgehog: 'HDG', 'sugar glider': 'SGL',
      parrot: 'PAR', budgerigar: 'BDG', budgie: 'BDG', cockatiel: 'CCT',
      lovebird: 'LVB', finch: 'FNC', canary: 'CNR', mynah: 'MYN', myna: 'MYN',
      pigeon: 'PGN', dove: 'PGN', bird: 'BRD',
      tortoise: 'TOR', turtle: 'TRT', gecko: 'GCK', 'bearded dragon': 'BDR',
      chameleon: 'CHL', snake: 'SNK', frog: 'FRG', axolotl: 'AXL',
      'ornamental fish': 'FSH', fish: 'FSH', koi: 'KOI', arowana: 'ARW', goldfish: 'GLD',
      cattle: 'COW', cow: 'COW', bovine: 'COW', buffalo: 'BUF', 'water buffalo': 'BUF',
      horse: 'HRS', equine: 'HRS', donkey: 'DNK', mule: 'DNK',
      sheep: 'SHP', ovine: 'SHP', goat: 'GOT', caprine: 'GOT',
      pig: 'PIG', swine: 'PIG', porcine: 'PIG', camel: 'CAM', yak: 'YAK', deer: 'DER',
      chicken: 'CHK', poultry: 'CHK', duck: 'DUK', turkey: 'TRK', quail: 'QAL',
      emu: 'EMU', ostrich: 'OST', peacock: 'PCK', peafowl: 'PCK',
      llama: 'LLA', alpaca: 'ALP',
    };
    const code = SPECIES_CODES[species.toLowerCase()] ?? species.toUpperCase().slice(0, 3);
    const year = new Date().getFullYear() % 100;

    const seqRes = await database.query(
      `INSERT INTO network_patient_id_sequences (network_id, species, year, last_seq)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (network_id, species, year)
       DO UPDATE SET last_seq = network_patient_id_sequences.last_seq + 1
       RETURNING last_seq`,
      [networkId, species.toLowerCase(), year]
    );
    const seq = seqRes.rows[0].last_seq;
    return `${prefix}-${code}-${year.toString().padStart(2, '0')}-${seq.toString().padStart(6, '0')}`;
  }


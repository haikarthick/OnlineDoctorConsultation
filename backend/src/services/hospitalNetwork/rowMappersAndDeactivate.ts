import database from '../../utils/database';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import type { HospitalNetwork, NetworkMember, PatientConsent } from './types';
  // Fix 7: Deactivate a network (only network corporate_admin or platform admin)
  export async function deactivateNetwork(networkId: string, userId: string, userRole: string): Promise<any> {
    if (userRole !== 'admin') {
      const membership = await database.query(
        `SELECT network_role FROM hospital_network_members
         WHERE network_id = $1 AND user_id = $2 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
        [networkId, userId]
      );
      if (membership.rows.length === 0 || membership.rows[0].network_role !== 'corporate_admin') {
        throw new ForbiddenError('Only network administrators can deactivate a network');
      }
    }
    const result = await database.query(
      `UPDATE hospital_networks SET is_active = false, updated_at = NOW() 
       WHERE id = $1 RETURNING id, name, is_active AS "isActive"`,
      [networkId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Hospital network');
    return result.rows[0];
  }

  export function mapNetworkRow(row: any): HospitalNetwork {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legal_name,
      registrationNumber: row.registration_number,
      taxId: row.tax_id,
      networkType: row.network_type,
      country: row.country,
      headquartersAddress: row.headquarters_address,
      headquartersCity: row.headquarters_city,
      headquartersState: row.headquarters_state,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      website: row.website,
      logoUrl: row.logo_url,
      dpoName: row.dpo_name,
      dpoEmail: row.dpo_email,
      dataResidencyRegion: row.data_residency_region,
      isActive: row.is_active,
      isApproved: row.is_approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      metadata: row.metadata,
      idPrefix: row.id_prefix,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedByName: row.approvedByName,
      memberCount: row.memberCount !== undefined ? parseInt(row.memberCount) : undefined,
      hospitalCount: row.hospitalCount !== undefined ? parseInt(row.hospitalCount) : undefined,
      createdBy: row.created_by,
    };
  }

  export function mapMemberRow(row: any): NetworkMember {
    return {
      id: row.id,
      networkId: row.network_id,
      userId: row.user_id,
      networkRole: row.network_role,
      hospitalId: row.hospital_id,
      isActive: row.is_active,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      notes: row.notes,
      userName: row.userName,
      userEmail: row.userEmail,
      userRole: row.userRole,
      hospitalName: row.hospitalName,
    };
  }

  export function mapConsentRow(row: any): PatientConsent {
    return {
      id: row.id,
      animalId: row.animal_id,
      ownerId: row.owner_id,
      grantedToUserId: row.granted_to_user_id,
      grantedToHospitalId: row.granted_to_hospital_id,
      grantedToNetworkId: row.granted_to_network_id,
      consentScope: row.consent_scope,
      allowMedicalRecords: row.allow_medical_records,
      allowVaccinationRecords: row.allow_vaccination_records,
      allowPrescriptions: row.allow_prescriptions,
      allowLabResults: row.allow_lab_results,
      allowGeneticData: row.allow_genetic_data,
      includeHospitalRecords: row.include_hospital_records,
      allowView: row.allow_view,
      allowCreateNotes: row.allow_create_notes,
      allowPrescribe: row.allow_prescribe,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      isActive: row.is_active,
      revokedAt: row.revoked_at,
      revokedReason: row.revoked_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      animalName: row.animalName,
      grantedToUserName: row.grantedToUserName,
      grantedToHospitalName: row.grantedToHospitalName,
      grantedToNetworkName: row.grantedToNetworkName,
    };
  }


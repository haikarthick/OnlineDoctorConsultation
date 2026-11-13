export interface HospitalNetwork {
  id: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  networkType: string;
  country?: string;
  headquartersAddress?: string;
  headquartersCity?: string;
  headquartersState?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  dpoName?: string;
  dpoEmail?: string;
  dataResidencyRegion?: string;
  isActive: boolean;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  // joined
  approvedByName?: string;
  memberCount?: number;
  hospitalCount?: number;
  idPrefix?: string;
}

export interface HospitalNetworkCreateDTO {
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  networkType?: string;
  country?: string;
  headquartersAddress?: string;
  headquartersCity?: string;
  headquartersState?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  dpoName?: string;
  dpoEmail?: string;
  dataResidencyRegion?: string;
  metadata?: any;
  idPrefix?: string;
}

export interface NetworkMember {
  id: string;
  networkId: string;
  userId: string;
  networkRole: string;
  hospitalId?: string;
  isActive: boolean;
  grantedBy?: string;
  grantedAt: Date;
  notes?: string;
  // joined
  userName?: string;
  userEmail?: string;
  userRole?: string;
  hospitalName?: string;
}

export interface NetworkDashboard {
  totalMembers: number;
  totalHospitals: number;
  totalPatients: number;
  activeConsents: number;
  recentAccessLogs: number;
  membersByRole: Record<string, number>;
}

export interface AccessLogEntry {
  accessedBy: string;
  accessorRole: string;
  accessorNetworkId?: string;
  animalId?: string;
  recordType?: string;
  recordId?: string;
  accessType: string;
  consentId?: string;
  ipAddress?: string;
  userAgent?: string;
  accessGranted: boolean;
  denialReason?: string;
}

export interface PatientConsent {
  id: string;
  animalId: string;
  ownerId: string;
  grantedToUserId?: string;
  grantedToHospitalId?: string;
  grantedToNetworkId?: string;
  consentScope: string;
  allowMedicalRecords: boolean;
  allowVaccinationRecords: boolean;
  allowPrescriptions: boolean;
  allowLabResults: boolean;
  allowGeneticData: boolean;
  includeHospitalRecords: boolean;
  allowView: boolean;
  allowCreateNotes: boolean;
  allowPrescribe: boolean;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  // joined
  animalName?: string;
  grantedToUserName?: string;
  grantedToHospitalName?: string;
  grantedToNetworkName?: string;
}

export interface PatientConsentDTO {
  animalId: string;
  grantedToUserId?: string;
  grantedToHospitalId?: string;
  grantedToNetworkId?: string;
  consentScope: string;
  allowMedicalRecords?: boolean;
  allowVaccinationRecords?: boolean;
  allowPrescriptions?: boolean;
  allowLabResults?: boolean;
  allowGeneticData?: boolean;
  includeHospitalRecords?: boolean;
  allowView?: boolean;
  allowCreateNotes?: boolean;
  allowPrescribe?: boolean;
  validFrom?: Date;
  validUntil?: Date;
}

export interface EnrollmentRequest {
  id: string;
  animalId: string;
  networkId: string;
  hospitalId?: string;
  enrollmentStatus: string;
  corporatePatientId?: string;
  platformUniqueId?: string;
  enrollmentRequestedAt: Date;
  enrollmentRespondedAt?: Date;
  enrolledBy?: string;
  notes?: string;
  animalName?: string;
  species?: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  networkName?: string;
  hospitalName?: string;
  enrolledByName?: string;
}

export interface WalkInInviteDTO {
  networkId: string;
  hospitalId?: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  animalName?: string;
  animalSpecies?: string;
  message?: string;
}


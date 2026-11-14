export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  accountStatus: 'active' | 'pending_approval' | 'frozen' | 'suspended'
  freezeReason?: string
  createdAt: string
}

export interface PendingUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  createdAt: string
  licenseNumber?: string
  yearsOfExperience?: number
  specializations?: string[]
  qualifications?: string[]
  clinicName?: string
  consultationFee?: number
}

export interface VetProfileData {
  consultationFee: string
  bio: string
  specializations: string
  qualifications: string
  languages: string
  clinicName: string
  clinicAddress: string
  licenseNumber: string
  yearsOfExperience: string
  availableDays: string
  availableHoursStart: string
  availableHoursEnd: string
  isAvailable: boolean
  acceptsEmergency: boolean
  profileImage: string
}

export const EMPTY_VET_FORM: VetProfileData = {
  consultationFee: '', bio: '', specializations: '', qualifications: '', languages: '',
  clinicName: '', clinicAddress: '', licenseNumber: '', yearsOfExperience: '',
  availableDays: '', availableHoursStart: '', availableHoursEnd: '',
  isAvailable: true, acceptsEmergency: false, profileImage: '',
}

export const getRoleBadge = (role: string) => {
  const map: Record<string, string> = { admin: 'danger', veterinarian: 'active', pet_owner: 'pending', farmer: 'inactive', corporate_admin: 'info' }
  return <span className={`badge badge-${map[role] || 'inactive'}`}>{role.replace('_', ' ')}</span>
}

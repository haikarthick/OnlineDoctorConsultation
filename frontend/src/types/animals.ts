// ─── Animal / Pet ───────────────────────────────────────────
export interface Animal {
  id: string
  ownerId: string
  uniqueId?: string
  name: string
  species: string
  breed?: string
  gender?: string
  dateOfBirth?: string
  weight?: number
  color?: string
  microchipId?: string
  earTagId?: string
  registrationNumber?: string
  isNeutered?: boolean
  insuranceProvider?: string
  insurancePolicyNumber?: string
  insuranceExpiry?: string
  allergies?: string[]
  medicalNotes?: string
  profileImage?: string
  isActive?: boolean
  ownerName?: string
  animalClass?: string
  sireId?: string
  damId?: string
  sireName?: string
  damName?: string
  breedingStatus?: string
  lastBreedingDate?: string
  expectedDueDate?: string
  createdAt: string
  updatedAt: string
}

// ─── Notification ───────────────────────────────────────────
export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'booking' | 'consultation' | 'payment' | 'review' | 'system' | 'reminder' | 'video_call'
  referenceId?: string
  isRead: boolean
  actionUrl?: string
  priority: string
  createdAt: string
}


export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'farmer' | 'pet_owner' | 'veterinarian' | 'admin';
  phone: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateDTO {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  role: string;
}

export interface Consultation {
  id: string;
  userId: string;
  veterinarianId: string;
  animalType: string;
  symptomDescription: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  diagnosis?: string;
  prescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecord {
  id: string;
  userId: string;
  consultationId: string;
  recordType: 'diagnosis' | 'prescription' | 'lab_report' | 'vaccination';
  content: string;
  fileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Core User Types ─────────────────────────────────────────
export type UserRole = 'farmer' | 'pet_owner' | 'veterinarian' | 'admin';
export type ConsultationStatus = 'pending' | 'confirmed' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'missed';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type VideoSessionStatus = 'waiting' | 'active' | 'paused' | 'ended' | 'failed';
export type AppointmentPriority = 'low' | 'normal' | 'high' | 'emergency';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  passwordHash: string;
  isActive: boolean;
  isVerified: boolean;
  avatar?: string;
  lastLoginAt?: Date;
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

// ─── Consultation & Booking ──────────────────────────────────
export interface Consultation {
  id: string;
  userId: string;
  veterinarianId: string;
  animalId?: string;
  animalType: string;
  symptomDescription: string;
  status: ConsultationStatus;
  priority: AppointmentPriority;
  bookingId?: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // minutes
  diagnosis?: string;
  prescription?: string;
  followUpDate?: Date;
  notes?: string;
  videoSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  petOwnerId: string;
  veterinarianId: string;
  animalId?: string;
  enterpriseId?: string;
  groupId?: string;
  consultationId?: string;
  scheduledDate: Date;
  timeSlotStart: string; // HH:mm
  timeSlotEnd: string;
  status: BookingStatus;
  bookingType: 'video_call' | 'in_person' | 'phone' | 'chat';
  priority: AppointmentPriority;
  reasonForVisit: string;
  symptoms?: string;
  notes?: string;
  cancellationReason?: string;
  rescheduledFrom?: string;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Vet Schedule & Availability ────────────────────────────
export interface VetSchedule {
  id: string;
  veterinarianId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm
  endTime: string;
  slotDuration: number; // minutes
  maxAppointments: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  bookingId?: string;
}

export interface VetAvailability {
  veterinarianId: string;
  date: string;
  slots: TimeSlot[];
}

// ─── Video Consultation ─────────────────────────────────────
export interface VideoSession {
  id: string;
  consultationId: string;
  roomId: string;
  hostUserId: string;
  participantUserId: string;
  status: VideoSessionStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // seconds
  recordingUrl?: string;
  chatLog?: ChatMessage[];
  quality?: 'low' | 'medium' | 'high' | 'hd';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  message: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  timestamp: Date;
}

// ─── Medical Records ────────────────────────────────────────
export interface MedicalRecord {
  id: string;
  userId: string;
  animalId?: string;
  consultationId: string;
  veterinarianId?: string;
  recordType: 'diagnosis' | 'prescription' | 'lab_report' | 'vaccination' | 'surgery' | 'follow_up';
  title?: string;
  content: string;
  medications?: Medication[];
  attachments?: string[];
  fileUrl?: string;
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

// ─── Prescription ───────────────────────────────────────────
export interface Prescription {
  id: string;
  consultationId: string;
  veterinarianId: string;
  petOwnerId: string;
  animalId?: string;
  medications: Medication[];
  instructions: string;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Reviews & Ratings ──────────────────────────────────────
export interface Review {
  id: string;
  consultationId: string;
  reviewerId: string;
  veterinarianId: string;
  rating: number; // 1-5
  comment?: string;
  responseFromVet?: string;
  isPublic: boolean;
  isVerified: boolean;
  helpfulCount: number;
  reportCount: number;
  status: 'active' | 'hidden' | 'flagged' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Payments ───────────────────────────────────────────────
export interface Payment {
  id: string;
  consultationId: string;
  bookingId?: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: 'credit_card' | 'debit_card' | 'bank_transfer' | 'wallet' | 'insurance';
  transactionId?: string;
  invoiceNumber?: string;
  taxAmount?: number;
  discountAmount?: number;
  refundAmount?: number;
  refundReason?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Notifications ──────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'consultation' | 'payment' | 'review' | 'system' | 'reminder' | 'video_call';
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  actionUrl?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Admin Types ────────────────────────────────────────────
export interface AdminDashboardStats {
  totalUsers: number;
  totalPetOwners: number;
  totalVeterinarians: number;
  activeUsers: number;
  totalVets: number;
  totalConsultations: number;
  activeConsultations: number;
  completedConsultations: number;
  cancelledConsultations: number;
  totalRevenue: number;
  totalPayments: number;
  pendingPayments: number;
  totalReviews: number;
  averageRating: number;
  totalBookings: number;
  todayBookings: number;
  activeVideoSessions: number;
  systemHealth: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: 'general' | 'booking' | 'payment' | 'notification' | 'video' | 'security';
  description?: string;
  updatedBy?: string;
  updatedAt: Date;
}

// ─── Vet Profile Extended ───────────────────────────────────
export interface VetProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  specializations: string[];
  qualifications: string[];
  experience: number; // years
  bio?: string;
  consultationFee: number;
  currency: string;
  rating: number;
  totalReviews: number;
  totalConsultations: number;
  isAvailable: boolean;
  acceptsEmergency: boolean;
  languages: string[];
  clinicName?: string;
  clinicAddress?: string;
  profileImage?: string;
  certificates?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Animal / Pet ───────────────────────────────────────────
export interface Animal {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  gender?: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date;
  weight?: number;
  color?: string;
  microchipId?: string;
  insuranceInfo?: string;
  allergies?: string[];
  medicalNotes?: string;
  profileImage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DTOs ───────────────────────────────────────────────────
export interface CreateBookingDTO {
  veterinarianId: string;
  animalId?: string;
  enterpriseId?: string;
  groupId?: string;
  scheduledDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  bookingType: 'video_call' | 'in_person' | 'phone' | 'chat';
  priority?: AppointmentPriority;
  reasonForVisit: string;
  symptoms?: string;
  notes?: string;
}

export interface CreateVideoSessionDTO {
  consultationId: string;
  participantUserId: string;
}

export interface CreatePrescriptionDTO {
  consultationId: string;
  petOwnerId?: string;
  animalId?: string;
  medications: Medication[];
  instructions: string;
  validUntil?: string;
  diagnosis?: string;
  followUpDate?: string;
}

export interface CreateReviewDTO {
  consultationId: string;
  veterinarianId: string;
  rating: number;
  comment?: string;
  isPublic?: boolean;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

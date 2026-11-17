import type { ConsultationStatus, BookingStatus, AppointmentPriority, VideoSessionStatus } from './core'

// ─── Consultation & Booking ─────────────────────────────────
export interface Consultation {
  id: string
  userId: string
  veterinarianId: string
  animalId?: string
  animalType: string
  symptomDescription: string
  status: ConsultationStatus
  priority: AppointmentPriority
  bookingId?: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  duration?: number
  diagnosis?: string
  prescription?: string
  followUpDate?: string
  notes?: string
  videoSessionId?: string
  title?: string
  petOwnerName?: string
  vetName?: string
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: string
  petOwnerId: string
  veterinarianId: string
  animalId?: string
  consultationId?: string
  scheduledDate: string
  timeSlotStart: string
  timeSlotEnd: string
  status: BookingStatus
  bookingType: 'video_call' | 'in_person' | 'phone' | 'chat'
  consultationType?: string
  priority: AppointmentPriority
  reasonForVisit: string
  reason?: string
  symptoms?: string
  notes?: string
  cancellationReason?: string
  cancelledBy?: string
  cancelledAt?: string
  confirmedAt?: string
  petOwnerName?: string
  vetName?: string
  createdAt: string
  updatedAt: string
}

export interface TimeSlot {
  startTime: string
  endTime: string
  isAvailable: boolean
  bookingId?: string
}

export interface VetAvailability {
  veterinarianId: string
  date: string
  slots: TimeSlot[]
}

// ─── Video Session ──────────────────────────────────────────
export interface VideoSession {
  id: string
  consultationId: string
  roomId: string
  hostUserId: string
  participantUserId: string
  status: VideoSessionStatus
  startedAt?: string
  endedAt?: string
  duration?: number
  recordingUrl?: string
  quality?: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  message: string
  messageType: 'text' | 'image' | 'file' | 'system'
  timestamp: string
}


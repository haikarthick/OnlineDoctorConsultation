import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────
export type TimeFormatType = '12h' | '24h'

export interface CancellationPolicy {
  autoRefundOnDoctorCancel: boolean
  patientFreeWindowHours: number
  partialRefundPercent: number
  partialRefundWindowHours: number
  goodwillBonusPercent: number
  doctorMaxCancellationsPerMonth: number
}

export interface AppSettings {
  timeFormat: TimeFormatType
  joinWindowMinutes: number
  maxReschedules: number
  patientNoShowRescheduleLimit: number
  paymentGatewayMode: string
  currency: string
  cancellationPolicy: CancellationPolicy
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', JPY: '¥', CNY: '¥',
  KES: 'KSh', ZAR: 'R', BRL: 'R$', SGD: 'S$', AED: 'د.إ', SAR: '﷼', MYR: 'RM',
  THB: '฿', PHP: '₱', IDR: 'Rp', NZD: 'NZ$', CHF: 'CHF',
}

function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code
}

interface SettingsContextType {
  settings: AppSettings
  /** Format a Date or ISO string as time only (e.g. "3:15 PM" or "15:15") */
  formatTime: (d: string | Date) => string
  /** Format a Date or ISO string as date only (e.g. "Feb 16, 2026") */
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string
  /** Format a Date or ISO string as full date+time */
  formatDateTime: (d: string | Date) => string
  /** Check if a booking is within the join window (joinWindowMinutes before start through end) */
  isJoinable: (scheduledDate: string, timeSlotStart: string, timeSlotEnd: string) => boolean
  /** Format a HH:MM time slot string respecting admin time format (e.g. "16:00" → "4 PM" or "16:00") */
  formatSlotTime: (time24: string) => string
  /** Reload settings from server */
  reloadSettings: () => Promise<void>
  /** Calculate estimated refund for a booking based on timing */
  estimateRefund: (appointmentDate: string, appointmentTime: string, amount: number) => { percent: number; amount: number; reason: string }
  /** Format a number as currency using the platform currency setting */
  formatCurrency: (amount: number | string) => string
}

const defaults: AppSettings = {
  timeFormat: '12h',
  joinWindowMinutes: 5,
  maxReschedules: 1,
  patientNoShowRescheduleLimit: 1,
  paymentGatewayMode: 'demo',
  currency: 'INR',
  cancellationPolicy: {
    autoRefundOnDoctorCancel: true,
    patientFreeWindowHours: 24,
    partialRefundPercent: 50,
    partialRefundWindowHours: 2,
    goodwillBonusPercent: 10,
    doctorMaxCancellationsPerMonth: 3,
  },
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaults)

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/settings/public')
      if (res.ok) {
        const json = await res.json()
        const list: { key: string; value: string }[] = json.data || []
        const tfEntry = list.find(s => s.key === 'display.timeFormat')
        const jwEntry = list.find(s => s.key === 'consultation.joinWindowMinutes')
        const mrEntry = list.find(s => s.key === 'booking.maxReschedules')
        const pnEntry = list.find(s => s.key === 'booking.patientNoShowRescheduleLimit')
        const gmEntry = list.find(s => s.key === 'payment.gatewayMode')
        const curEntry = list.find(s => s.key === 'payment.currency')
        const findCancellation = (k: string) => list.find(s => s.key === `cancellation.${k}`)?.value
        setSettings({
          timeFormat: (tfEntry?.value === '24h' ? '24h' : '12h') as TimeFormatType,
          joinWindowMinutes: jwEntry?.value ? parseInt(jwEntry.value, 10) || 5 : 5,
          maxReschedules: mrEntry?.value ? parseInt(mrEntry.value, 10) : 1,
          patientNoShowRescheduleLimit: pnEntry?.value ? parseInt(pnEntry.value, 10) : 1,
          paymentGatewayMode: gmEntry?.value || 'demo',
          currency: curEntry?.value || 'INR',
          cancellationPolicy: {
            autoRefundOnDoctorCancel: findCancellation('autoRefundOnDoctorCancel') !== 'false',
            patientFreeWindowHours: parseInt(findCancellation('patientFreeWindowHours') || '24', 10),
            partialRefundPercent: parseInt(findCancellation('partialRefundPercent') || '50', 10),
            partialRefundWindowHours: parseInt(findCancellation('partialRefundWindowHours') || '2', 10),
            goodwillBonusPercent: parseInt(findCancellation('goodwillBonusPercent') || '10', 10),
            doctorMaxCancellationsPerMonth: parseInt(findCancellation('doctorMaxCancellationsPerMonth') || '3', 10),
          },
        })
      }
    } catch {
      // Silently fall back to defaults
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  // ─── Formatting helpers ──────────────────────────────────
  const formatTime = useCallback((d: string | Date): string => {
    try {
      const date = typeof d === 'string' ? new Date(d) : d
      if (isNaN(date.getTime())) return String(d)
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: settings.timeFormat === '12h',
      })
    } catch { return String(d) }
  }, [settings.timeFormat])

  const formatDate = useCallback((d: string | Date, opts?: Intl.DateTimeFormatOptions): string => {
    try {
      const date = typeof d === 'string' ? new Date(d) : d
      if (isNaN(date.getTime())) return String(d)
      return date.toLocaleDateString('en-US', opts || {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    } catch { return String(d) }
  }, [])

  const formatDateTime = useCallback((d: string | Date): string => {
    try {
      const date = typeof d === 'string' ? new Date(d) : d
      if (isNaN(date.getTime())) return String(d)
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: settings.timeFormat === '12h',
      })
    } catch { return String(d) }
  }, [settings.timeFormat])

  // ─── Join window check ───────────────────────────────────
  const isJoinable = useCallback((scheduledDate: string, timeSlotStart: string, timeSlotEnd: string): boolean => {
    try {
      const now = new Date()
      // Parse scheduled date + time slot start => start datetime
      // scheduledDate may be "YYYY-MM-DD" or ISO "2026-02-15T18:30:00.000Z"
      // Use local date methods to avoid UTC timezone shift
      const d = new Date(scheduledDate)
      const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const startDateTime = new Date(`${datePart}T${timeSlotStart}:00`)
      const endDateTime = new Date(`${datePart}T${timeSlotEnd}:00`)

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) return true // fallback: allow

      const windowMs = settings.joinWindowMinutes * 60 * 1000
      const joinOpensAt = new Date(startDateTime.getTime() - windowMs)

      // Joinable from (start - windowMinutes) through end time
      return now >= joinOpensAt && now <= endDateTime
    } catch {
      return true // fallback: allow if parsing fails
    }
  }, [settings.joinWindowMinutes])

  // ─── Refund estimation for patient cancellation ──────────
  const estimateRefund = useCallback((appointmentDate: string, appointmentTime: string, amount: number) => {
    try {
      const d = new Date(appointmentDate)
      const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const appointmentDateTime = new Date(`${datePart}T${appointmentTime}:00`)
      const now = new Date()
      const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      const policy = settings.cancellationPolicy

      if (hoursUntil >= policy.patientFreeWindowHours) {
        return { percent: 100, amount, reason: `Full refund (cancelled ${policy.patientFreeWindowHours}+ hours before appointment)` }
      } else if (hoursUntil >= policy.partialRefundWindowHours) {
        const refundAmount = Math.round((amount * policy.partialRefundPercent) / 100)
        return { percent: policy.partialRefundPercent, amount: refundAmount, reason: `${policy.partialRefundPercent}% partial refund (cancelled ${Math.round(hoursUntil)} hours before appointment)` }
      } else {
        return { percent: 0, amount: 0, reason: `No refund (cancelled less than ${policy.partialRefundWindowHours} hours before appointment)` }
      }
    } catch {
      return { percent: 100, amount, reason: 'Full refund' }
    }
  }, [settings.cancellationPolicy])

  // ─── Slot time formatting (HH:MM strings) ───────────────
  const formatSlotTime = useCallback((time24: string): string => {
    try {
      const [h, m] = time24.split(':').map(Number)
      if (settings.timeFormat === '24h') {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
      const period = h >= 12 ? 'PM' : 'AM'
      const hour = h % 12 || 12
      return `${hour}${m > 0 ? ':' + String(m).padStart(2, '0') : ''} ${period}`
    } catch { return time24 }
  }, [settings.timeFormat])

  // ─── Currency formatting ─────────────────────────────────
  const formatCurrency = useCallback((amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return `${getCurrencySymbol(settings.currency)}0`
    return `${getCurrencySymbol(settings.currency)}${num.toLocaleString()}`
  }, [settings.currency])

  return (
    <SettingsContext.Provider value={{ settings, formatTime, formatDate, formatDateTime, isJoinable, formatSlotTime, reloadSettings: loadSettings, estimateRefund, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────
export const useSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

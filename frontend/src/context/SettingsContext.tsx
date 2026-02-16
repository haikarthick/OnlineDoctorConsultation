import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────
export type TimeFormatType = '12h' | '24h'

export interface AppSettings {
  timeFormat: TimeFormatType
  joinWindowMinutes: number
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
  /** Reload settings from server */
  reloadSettings: () => Promise<void>
}

const defaults: AppSettings = { timeFormat: '12h', joinWindowMinutes: 5 }

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
        setSettings({
          timeFormat: (tfEntry?.value === '24h' ? '24h' : '12h') as TimeFormatType,
          joinWindowMinutes: jwEntry?.value ? parseInt(jwEntry.value, 10) || 5 : 5,
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

  return (
    <SettingsContext.Provider value={{ settings, formatTime, formatDate, formatDateTime, isJoinable, reloadSettings: loadSettings }}>
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

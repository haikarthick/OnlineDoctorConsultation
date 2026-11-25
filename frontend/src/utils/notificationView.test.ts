import { describe, it, expect } from 'vitest'
import { dayKey, notificationTarget, notificationTitle, AppNotification } from './notificationView'

const base: AppNotification = { id: '1', type: 'system', title: 'Hello', message: 'World', isRead: false, createdAt: '2026-11-25T10:00:00Z' }

describe('notificationView', () => {
  it('opens the screen each kind of notification is about', () => {
    expect(notificationTarget({ ...base, type: 'system', metadata: { type: 'nutrition_flag' } })).toBe('/nutrition')
    expect(notificationTarget({ ...base, type: 'booking' })).toBe('/my-bookings')
    expect(notificationTarget({ ...base, type: 'prescription' })).toBe('/prescriptions')
    expect(notificationTarget({ ...base, type: 'payment' })).toBe('/payments')
    expect(notificationTarget({ ...base, metadata: { type: 'farm_due' } })).toBe('/farm-records')
    expect(notificationTarget({ ...base, type: 'payment', metadata: { withdrawalId: 'w1' } })).toBe('/wallet')
  })
  it('a notification with nothing to open only gets marked read', () => {
    expect(notificationTarget(base)).toBeNull()
  })
  it('falls back to the server sentence when no translated code exists', () => {
    expect(notificationTitle({ ...base, metadata: { i18n: { title: { code: 'NOT_A_CODE' } } } })).toBe('Hello')
  })
  it('groups by day', () => {
    const now = new Date(2026, 10, 25, 15, 0)
    expect(dayKey(new Date(2026, 10, 25, 1, 0).toISOString(), now)).toBe('today')
    expect(dayKey(new Date(2026, 10, 24, 23, 0).toISOString(), now)).toBe('yesterday')
    expect(dayKey('garbage', now)).toBe('earlier')
  })
})

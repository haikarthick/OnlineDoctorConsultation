import i18n from 'i18next'

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  metadata?: Record<string, any> | null
}

interface CodedText { code?: string; params?: Record<string, string | number> }

function say(coded: CodedText | undefined, fallback: string): string {
  if (coded?.code && i18n.exists(`serverMessages.${coded.code}`)) {
    // A parameter that is itself a message code (for example "where the money went") is said in the person's language too.
    const params: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(coded.params || {})) {
      params[k] = typeof v === 'string' && /^[A-Z][A-Z0-9_]{5,}$/.test(v) && i18n.exists(`serverMessages.${v}`) ? i18n.t(`serverMessages.${v}`) : v
    }
    return i18n.t(`serverMessages.${coded.code}`, params)
  }
  return fallback
}

/** The title in the person's language when the server sent a code we translate, else the server's own sentence. */
export function notificationTitle(n: AppNotification): string {
  return say(n.metadata?.i18n?.title, n.title)
}

export function notificationBody(n: AppNotification): string {
  return say(n.metadata?.i18n?.body, n.message)
}

/**
 * Where a tap on a notification goes. ONE place decides; a notification with nothing to open returns null (the tap only marks it read).
 * Every path here is a screen every recipient of that kind of notification can already open.
 */
export function notificationTarget(n: AppNotification): string | null {
  const m = n.metadata || {}
  const kind = String(m.type || n.type || '')
  if (kind.startsWith('nutrition')) return '/nutrition'
  if (kind === 'farm_due') return '/farm-records'
  if (kind.startsWith('farm_ownership')) return '/enterprises'
  if (kind.startsWith('farm_invite')) return '/enterprises'
  if (kind === 'booking' || m.bookingId) return '/my-bookings'
  if (kind === 'prescription' || m.prescriptionId) return '/prescriptions'
  if (m.withdrawalId || kind.includes('withdraw')) return '/wallet'
  if (kind === 'payment' || m.paymentId) return '/payments'
  if (kind.includes('vaccin') || m.scheduleId) return '/vaccination-passport'
  return null
}

/** Groups newest-first notifications under "Today", "Yesterday" or a dated heading. */
export function dayKey(iso: string, now = new Date()): 'today' | 'yesterday' | string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'earlier'
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86400000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  return d.toISOString().slice(0, 10)
}

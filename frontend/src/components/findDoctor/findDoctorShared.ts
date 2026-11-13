import { VetProfile, TimeSlot } from '../../types'

export interface VetWithAvailability extends VetProfile {
  availableSlots?: TimeSlot[]
  totalAvailableSlots?: number
  nextAvailableTime?: string
}

export type ViewMode = 'grid' | 'list'
export type SortOption = 'rating' | 'fee_asc' | 'fee_desc' | 'experience' | 'consultations' | 'reviews' | 'name'
export type TimeOfDay = '' | 'morning' | 'afternoon' | 'evening'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'rating', label: '⭐ Highest Rated' },
  { value: 'experience', label: '📅 Most Experienced' },
  { value: 'consultations', label: '🏥 Most Consultations' },
  { value: 'reviews', label: '💬 Most Reviewed' },
  { value: 'fee_asc', label: '💰 Fee: Low to High' },
  { value: 'fee_desc', label: '💰 Fee: High to Low' },
  { value: 'name', label: '🔤 Name A-Z' },
]

export const TIME_RANGES: Record<string, { label: string; from: string; to: string; desc: string }> = {
  morning:   { label: '🌅 Morning',   from: '08:00', to: '12:00', desc: '8am-12pm' },
  afternoon: { label: '☀️ Afternoon', from: '12:00', to: '17:00', desc: '12pm-5pm' },
  evening:   { label: '🌆 Evening',   from: '17:00', to: '20:00', desc: '5pm-8pm'  },
}

export function getDateChips() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { dateStr, label }
  })
}

/** Filter out past time slots for today using browser local time + 15min buffer */
export function filterPastSlots(slots: TimeSlot[], forDate: string): TimeSlot[] {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (forDate !== todayStr) return slots
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + 15
  return slots.filter(s => {
    const [h, m] = (s.startTime || '00:00').split(':').map(Number)
    return h * 60 + m > nowMinutes
  })
}

export function formatDateLabel(dateStr: string): string {
  if (!dateStr) return ''
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === today)    return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

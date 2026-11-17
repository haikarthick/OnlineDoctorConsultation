export interface NavSection {
  id: string
  label: string
  icon: string
}

export const NAV_SECTIONS: NavSection[] = [
  { id: 'maintenance', label: '🚧 Maintenance', icon: '🚧' },
  { id: 'display', label: '🕐 Display', icon: '🕐' },
  { id: 'consultation', label: '🩺 Consultation', icon: '🩺' },
  { id: 'booking', label: '📅 Booking', icon: '📅' },
  { id: 'payment', label: '💳 Payment', icon: '💳' },
  { id: 'cancellation', label: '🔄 Cancellation', icon: '🔄' },
  { id: 'other', label: '⚙️ Other', icon: '⚙️' },
]

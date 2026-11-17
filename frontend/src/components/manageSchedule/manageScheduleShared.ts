export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
export const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
}
export const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
}

export interface DateOverride {
  id: string; overrideDate: string; overrideType: 'unavailable' | 'custom_hours';
  startTime?: string; endTime?: string; slotDuration?: number; reason?: string;
}
export interface BlockedSlot {
  id: string; blockDate?: string; startTime: string; endTime: string;
  reason?: string; isRecurring: boolean; recurringDay?: string;
}
export interface Holiday {
  id: string; holidayDate: string; name: string; holidayType: string;
  isFullDay: boolean; startTime?: string; endTime?: string;
}
export interface CalendarDay {
  date: string; status: 'available' | 'unavailable' | 'custom' | 'holiday' | 'no_schedule';
  reason?: string;
}

// CSS modifier key for a calendar/legend status ('no_schedule' -> 'none' to match .status-none)
export const statusKey = (status: string) => status === 'no_schedule' ? 'none' : status

export const buildCalendarGrid = (calMonth: { year: number; month: number }, calendarDays: CalendarDay[]) => {
  const firstDay = new Date(calMonth.year, calMonth.month - 1, 1)
  const lastDay = new Date(calMonth.year, calMonth.month, 0)
  const startPad = firstDay.getDay() // 0=Sun
  const days: (CalendarDay | null)[] = []
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calMonth.year}-${String(calMonth.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const cd = calendarDays.find(c => c.date === dateStr)
    days.push(cd || { date: dateStr, status: 'no_schedule' })
  }
  return days
}

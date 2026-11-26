/** The cells of a month calendar, Sunday first: `null` for the blanks before the 1st, then the day numbers. `month` is 1-12. */
export function monthCells(year: number, month: number): Array<number | null> {
  const lead = new Date(year, month - 1, 1).getDay()
  const days = new Date(year, month, 0).getDate()
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)]
}

/** YYYY-MM-DD from parts - built by hand because toISOString() converts to UTC and shifts the day east of Greenwich. */
export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The month before / after (`month` 1-12). */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export type DayState = 'past' | 'open' | 'full' | 'unknown'

/**
 * What a day on the booking calendar looks like. `known` is the server's answer for the day (undefined while it is loading or if it could
 * not be loaded); an unknown future day stays tappable so a failed check never stops a booking - the time step has the real slots.
 */
export function dayState(iso: string, todayIso: string, known: { hasAvailability: boolean } | undefined): DayState {
  if (iso < todayIso) return 'past'
  if (!known) return 'unknown'
  return known.hasAvailability ? 'open' : 'full'
}

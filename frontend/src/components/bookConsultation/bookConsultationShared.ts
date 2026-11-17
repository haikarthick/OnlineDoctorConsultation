export interface Enterprise { id: string; name: string; type: string; location?: string }
export interface AnimalGroup { id: string; name: string; type: string; animalCount?: number }

/** Filter out past time slots for today using browser local time + 15min buffer */
export const filterFutureSlots = <T extends { startTime: string; isAvailable: boolean }>(slots: T[], forDate: string): T[] => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return slots.filter(s => {
    if (!s.isAvailable) return false
    if (forDate !== todayStr) return true
    const [h, m] = (s.startTime || '00:00').split(':').map(Number)
    return h * 60 + m > now.getHours() * 60 + now.getMinutes() + 15
  })
}

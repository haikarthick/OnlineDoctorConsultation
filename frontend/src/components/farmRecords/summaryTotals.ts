/** One row of GET /farm-records/summary: a record type's total on one day. */
export interface SummaryRow {
  recordType: string
  recordDate: string
  total: number | null
  entries: number
}

export interface SummaryTotal {
  recordType: string
  /** Sum of the quantities written down (0 when the type carries no quantity, e.g. a "done" tick). */
  total: number
  /** On how many different days something of this type was written down. */
  days: number
  entries: number
  /** True when at least one entry had a quantity, so a total means something. */
  hasQuantity: boolean
}

/**
 * The last-N-days card: per record type, the total, the days it was written down and the entries. Which types appear is whatever the farm
 * actually wrote (milk on a dairy farm, eggs in a poultry house, feed everywhere) - nothing here names a species. `order` is the master
 * data's own record-type order so the card reads the same as the day's entry screen.
 */
export function summaryTotals(rows: SummaryRow[], order: string[] = []): SummaryTotal[] {
  const map = new Map<string, { total: number; dates: Set<string>; entries: number; hasQuantity: boolean }>()
  for (const r of rows) {
    const cur = map.get(r.recordType) || { total: 0, dates: new Set<string>(), entries: 0, hasQuantity: false }
    if (r.total !== null && r.total !== undefined) { cur.total += Number(r.total); cur.hasQuantity = true }
    cur.dates.add(r.recordDate)
    cur.entries += Number(r.entries) || 0
    map.set(r.recordType, cur)
  }
  const rank = (code: string) => { const i = order.indexOf(code); return i === -1 ? order.length : i }
  return [...map.entries()]
    .map(([recordType, v]) => ({ recordType, total: v.total, days: v.dates.size, entries: v.entries, hasQuantity: v.hasQuantity }))
    .sort((a, b) => rank(a.recordType) - rank(b.recordType) || a.recordType.localeCompare(b.recordType))
}

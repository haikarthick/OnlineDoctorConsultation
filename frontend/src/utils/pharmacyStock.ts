/**
 * Pharmacy stock-level maths.
 *
 * "Low stock" is a property of a MEDICATION, not of an individual batch. The
 * inventory table lists one row per batch, so comparing a single row's quantity
 * against the medication-level reorder point over-reports badly: five batches of
 * 10 units against a reorder point of 20 reported five shortages while 50 units
 * sat on the shelf.
 *
 * The backend's `/pharmacies/:id/low-stock-alerts` route is the reference
 * implementation - `GROUP BY pm.id HAVING SUM(pi.quantity) <= pm.reorder_point`.
 * These helpers mirror it so the UI and the API agree on what "low" means.
 */

export interface StockRow {
  med_id: string
  quantity: number
  reorder_point: number
  min_stock_level: number
}

/** Total quantity per medication, summed across every batch. */
export function totalStockByMedication(rows: readonly StockRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const qty = Number(row.quantity)
    totals.set(row.med_id, (totals.get(row.med_id) || 0) + (Number.isFinite(qty) ? qty : 0))
  }
  return totals
}

/**
 * The threshold a medication is judged against. `reorder_point` is the primary
 * signal; `min_stock_level` is the fallback for medications that never had a
 * reorder point set. 0 is a legitimate threshold, so only null/undefined/NaN
 * fall through - `||` would have treated a deliberate 0 as "unset".
 */
export function stockThreshold(row: Pick<StockRow, 'reorder_point' | 'min_stock_level'>): number {
  // Note `Number(null)` is 0, which is finite - so null/undefined have to be
  // ruled out before coercing, or an unset reorder point would read as a
  // deliberate threshold of 0 and nothing would ever be flagged.
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return num(row.reorder_point) ?? num(row.min_stock_level) ?? 0
}

/**
 * Whether the medication this row belongs to is at or below its reorder point,
 * counting every batch of that medication - not just this one.
 */
export function isLowStock(row: StockRow, totals: Map<string, number>): boolean {
  return (totals.get(row.med_id) || 0) <= stockThreshold(row)
}

import { describe, it, expect } from 'vitest'
import { totalStockByMedication, stockThreshold, isLowStock, StockRow } from './pharmacyStock'

const row = (over: Partial<StockRow> = {}): StockRow => ({
  med_id: 'med-1',
  quantity: 10,
  reorder_point: 20,
  min_stock_level: 5,
  ...over,
})

describe('totalStockByMedication', () => {
  it('sums every batch of the same medication', () => {
    const totals = totalStockByMedication([
      row({ quantity: 10 }), row({ quantity: 10 }), row({ quantity: 30 }),
    ])
    expect(totals.get('med-1')).toBe(50)
  })

  it('keeps medications separate', () => {
    const totals = totalStockByMedication([
      row({ med_id: 'a', quantity: 3 }),
      row({ med_id: 'b', quantity: 7 }),
    ])
    expect(totals.get('a')).toBe(3)
    expect(totals.get('b')).toBe(7)
  })

  it('treats a non-numeric quantity as zero rather than producing NaN', () => {
    const totals = totalStockByMedication([
      row({ quantity: 5 }),
      row({ quantity: undefined as unknown as number }),
    ])
    expect(totals.get('med-1')).toBe(5)
  })

  it('returns an empty map for no rows', () => {
    expect(totalStockByMedication([]).size).toBe(0)
  })
})

describe('stockThreshold', () => {
  it('prefers the reorder point', () => {
    expect(stockThreshold({ reorder_point: 20, min_stock_level: 5 })).toBe(20)
  })

  it('falls back to min_stock_level when the reorder point is unset', () => {
    expect(stockThreshold({ reorder_point: null as unknown as number, min_stock_level: 5 })).toBe(5)
  })

  it('honours a deliberate reorder point of 0 instead of falling through', () => {
    // `reorder_point || min_stock_level` would wrongly return 5 here.
    expect(stockThreshold({ reorder_point: 0, min_stock_level: 5 })).toBe(0)
  })

  it('is 0 when neither threshold is set', () => {
    expect(stockThreshold({
      reorder_point: null as unknown as number,
      min_stock_level: undefined as unknown as number,
    })).toBe(0)
  })
})

describe('isLowStock', () => {
  it('does NOT flag a well-stocked medication split across many batches', () => {
    // The regression this file exists for: 5 batches x 10 units, reorder point
    // 20. Per-batch logic flagged all five; the medication holds 50 units.
    const rows = Array.from({ length: 5 }, () => row({ quantity: 10, reorder_point: 20 }))
    const totals = totalStockByMedication(rows)
    expect(rows.some(r => isLowStock(r, totals))).toBe(false)
  })

  it('flags a medication whose batches together fall to the reorder point', () => {
    const rows = [row({ quantity: 8, reorder_point: 20 }), row({ quantity: 12, reorder_point: 20 })]
    const totals = totalStockByMedication(rows)
    expect(rows.every(r => isLowStock(r, totals))).toBe(true) // 20 <= 20
  })

  it('flags when the total is below the reorder point', () => {
    const rows = [row({ quantity: 1, reorder_point: 20 })]
    expect(isLowStock(rows[0], totalStockByMedication(rows))).toBe(true)
  })

  it('treats a medication with no batches at all as low', () => {
    // Nothing on the shelf is the most severe shortage, not an absent one.
    expect(isLowStock(row({ quantity: 0 }), new Map())).toBe(true)
  })

  it('judges each medication against its own total', () => {
    const rows = [
      row({ med_id: 'plenty', quantity: 100, reorder_point: 10 }),
      row({ med_id: 'scarce', quantity: 2, reorder_point: 10 }),
    ]
    const totals = totalStockByMedication(rows)
    expect(isLowStock(rows[0], totals)).toBe(false)
    expect(isLowStock(rows[1], totals)).toBe(true)
  })
})

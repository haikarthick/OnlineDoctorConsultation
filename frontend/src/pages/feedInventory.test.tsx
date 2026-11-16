import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FeedInventory from './FeedInventory'

const t = ((key: string, o?: any) => (o && o.name ? `${key}:${o.name}` : key)) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
vi.mock('../hooks/useAutoRefresh', () => ({ useAutoRefresh: () => undefined }))
vi.mock('../context/SettingsContext', () => ({ useSettings: () => ({ formatCurrency: (n: number | string) => `Rs${Number(n).toFixed(0)}`, formatDate: (d: string) => `D:${d.slice(0, 10)}` }) }))

const restock = vi.fn()
const del = vi.fn()
const api = {
  listEnterprises: vi.fn(), listFeeds: vi.fn(), getFeedAnalytics: vi.fn(),
  restockFeed: (...a: unknown[]) => restock(...a), deleteFeed: (...a: unknown[]) => del(...a),
  createFeed: vi.fn(), updateFeed: vi.fn(), logFeedConsumption: vi.fn(),
}
vi.mock('../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

const feeds = [
  { id: 'f1', name: 'Napier', feedType: 'forage', quantityInStock: 20, unit: 'kg', minimumStockLevel: 50, costPerUnit: 8, expiryDate: '2026-12-01T00:00:00Z', storageLocation: 'Shed' },
  { id: 'f2', name: 'Cattle feed', feedType: 'pellet', quantityInStock: 500, unit: 'bag', minimumStockLevel: 50, costPerUnit: 1200 },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'e1', name: 'Farm' }] } })
  api.listFeeds.mockResolvedValue({ data: { items: feeds } })
  api.getFeedAnalytics.mockResolvedValue({ data: { totalInventoryValue: 0, lowStockAlerts: [], consumptionByType: [], dailyConsumptionTrend: [] } })
  restock.mockResolvedValue({})
  del.mockResolvedValue({})
})

describe('FeedInventory', () => {
  it('lists stock as cards with the platform currency and flags low stock', async () => {
    const { container } = render(<FeedInventory />)
    await screen.findByText('Napier')
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelectorAll('.feed-card')).toHaveLength(2)
    expect(container.querySelectorAll('.feed-card.is-low')).toHaveLength(1)
    expect(screen.getByText('Rs8')).toBeTruthy()
    expect(container.textContent).not.toContain('$')
    expect(screen.getAllByText('feedInventory.types.forage').length).toBeGreaterThan(0)
  })

  it('restocks from a sheet and says so', async () => {
    render(<FeedInventory />)
    await screen.findByText('Napier')
    fireEvent.click(screen.getAllByText('feedInventory.restock')[0])
    const qty = await screen.findByLabelText(/feedInventory.restockQty/)
    fireEvent.change(qty, { target: { value: '30' } })
    fireEvent.click(document.querySelector('.feed-sheet-action') as HTMLElement)
    await waitFor(() => expect(restock).toHaveBeenCalledWith('f1', 30))
    expect(await screen.findByText('feedInventory.toasts.restocked')).toBeTruthy()
  })

  it('asks before deleting, and only deletes on confirm', async () => {
    render(<FeedInventory />)
    await screen.findByText('Napier')
    fireEvent.click(screen.getAllByText('common.delete')[0])
    expect(del).not.toHaveBeenCalled()
    await waitFor(() => expect(document.querySelector('.feed-sheet-action')).not.toBeNull())
    fireEvent.click(document.querySelector('.feed-sheet-action') as HTMLElement)
    await waitFor(() => expect(del).toHaveBeenCalledWith('f1'))
  })
})

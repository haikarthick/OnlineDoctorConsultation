import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FeedInventory from './FeedInventory'

const t = ((key: string, o?: any) => (o && o.name ? `${key}:${o.name}` : key)) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
vi.mock('../hooks/useAutoRefresh', () => ({ useAutoRefresh: () => undefined }))
const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../context/MasterDataContext', () => ({ useMasterData: () => ({ resolveLabel: (x: any) => x.label }) }))
vi.mock('../context/SettingsContext', () => ({ useSettings: () => ({ formatCurrency: (n: number | string) => `Rs${Number(n).toFixed(0)}`, formatDate: (d: string) => `D:${d.slice(0, 10)}` }) }))

const restock = vi.fn()
const del = vi.fn()
const api = {
  listEnterprises: vi.fn(), listFeeds: vi.fn(), getFeedAnalytics: vi.fn(),
  restockFeed: (...a: unknown[]) => restock(...a), deleteFeed: (...a: unknown[]) => del(...a),
  createFeed: vi.fn(), updateFeed: vi.fn(), feedLibrary: vi.fn(),
}
vi.mock('../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

// Exactly what the server sends (backend FeedInventoryService.mapFeed) - the old test used the page's own names, which
// is how the page and the API drifted apart unnoticed.
const feeds = [
  { id: 'f1', feedName: 'Napier', feedType: 'forage', currentStock: 20, unit: 'kg', kgPerUnit: 1, stockKg: 20, minimumStock: 50, costPerUnit: 8, costPerKg: 8, isLow: true, expiryDate: '2026-12-01T00:00:00Z', storageLocation: 'Shed', ingredientId: null, ingredientLabel: null },
  { id: 'f2', feedName: 'Cattle feed', feedType: 'pellet', currentStock: 500, unit: 'bag', kgPerUnit: 50, stockKg: 25000, minimumStock: 50, costPerUnit: 1200, costPerKg: 24, isLow: false, ingredientId: 'i1', ingredientLabel: 'Compound cattle feed' },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'e1', name: 'Farm' }] } })
  api.listFeeds.mockResolvedValue({ data: { items: feeds } })
  api.getFeedAnalytics.mockResolvedValue({ data: { totalInventoryValue: 0, lowStockAlerts: [], consumptionByType: [], dailyConsumptionTrend: [] } })
  api.feedLibrary.mockResolvedValue({ data: { items: [] } })
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
    await waitFor(() => expect(restock).toHaveBeenCalledWith('f1', { quantity: 30, pricePerUnit: 8 }))
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

  it('has no second way to record feed given: it points to Daily records', async () => {
    render(<FeedInventory />)
    await screen.findByText('Napier')
    expect(screen.queryByText('feedInventory.logConsumption')).toBeNull()
    fireEvent.click(screen.getByText('feedInventory.goDailyRecords'))
    expect(navigate).toHaveBeenCalledWith('/farm-records')
  })

  it('shows stock kept in bags with its kg and the library feed it is', async () => {
    render(<FeedInventory />)
    await screen.findByText('Cattle feed')
    expect(screen.getByText('Compound cattle feed')).toBeTruthy()
    expect(screen.getByText(/feedInventory.aboutKg/)).toBeTruthy()
  })
})

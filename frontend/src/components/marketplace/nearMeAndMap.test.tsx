import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react'
import { useNearMe } from '../../hooks/useNearMe'
import { NearMeBar } from './NearMeBar'
import { ListingsMap, listingPin } from './ListingsMap'
import type { MarketplaceListing } from '../../types'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k) }) }))
// Leaflet needs a real browser; the map component is replaced by a stub that lists its pins
vi.mock('../MapView', () => ({
  default: ({ markers }: { markers: Array<{ id: string; lat: number; lng: number }> }) => (
    <ul data-testid="map">{markers.map(m => <li key={m.id}>{`${m.id}@${m.lat},${m.lng}`}</li>)}</ul>
  ),
}))

const t = ((k: string, o?: unknown) => (typeof o === 'string' ? o : o ? `${k}${JSON.stringify(o)}` : k)) as never

describe('useNearMe', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
  afterEach(() => { if (original) Object.defineProperty(navigator, 'geolocation', original); else delete (navigator as any).geolocation })

  it('turns on with the device position, and off again', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 10.5, longitude: 76.2 } }) } })
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.toggle())
    expect(result.current.active).toBe(true)
    expect(result.current.location).toEqual({ lat: 10.5, lng: 76.2 })
    expect(result.current.error).toBe('')
    act(() => result.current.toggle())
    expect(result.current.active).toBe(false)
  })

  it('explains a refusal in words and stays off', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok: unknown, no: () => void) => no() } })
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.toggle())
    expect(result.current.active).toBe(false)
    expect(result.current.error).toMatch(/denied|Filters/i)
  })

  it('explains a device with no location support', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.toggle())
    expect(result.current.active).toBe(false)
    expect(result.current.error).toMatch(/Filters/)
  })
})

describe('NearMeBar', () => {
  it('shows the radius picker only while near-me is on, and reports the choice', () => {
    const setRadiusKm = vi.fn()
    const base = { active: false, setActive: vi.fn(), location: null, radiusKm: '25', setRadiusKm, error: '', toggle: vi.fn() }
    const { rerender } = render(<NearMeBar nearMe={base} t={t} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    rerender(<NearMeBar nearMe={{ ...base, active: true, location: { lat: 1, lng: 2 } }} t={t} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '50' } })
    expect(setRadiusKm).toHaveBeenCalledWith('50')
  })
  it('shows the explanation when there is one', () => {
    render(<NearMeBar nearMe={{ active: false, setActive: vi.fn(), location: null, radiusKm: '25', setRadiusKm: vi.fn(), error: 'Location was denied.', toggle: vi.fn() }} t={t} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Location was denied.')
  })
})

const L = (over: Record<string, unknown>) => ({ id: 'x', title: 'Cow', price: 1000, ...over }) as unknown as MarketplaceListing

describe('listingPin / ListingsMap', () => {
  it('uses only the rounded pin, never an exact coordinate field', () => {
    expect(listingPin(L({ map_lat: '10.52', map_lng: '76.21' }))).toEqual({ lat: 10.52, lng: 76.21 })
    expect(listingPin(L({ latitude: 10.5234, longitude: 76.2145 }))).toBeNull()
  })
  it('ignores a missing, blank or 0,0 pin', () => {
    expect(listingPin(L({}))).toBeNull()
    expect(listingPin(L({ map_lat: '', map_lng: '' }))).toBeNull()
    expect(listingPin(L({ map_lat: 0, map_lng: 0 }))).toBeNull()
  })
  it('pins what has a location and says how many have none', async () => {
    render(<ListingsMap listings={[L({ id: 'a', map_lat: 10.5, map_lng: 76.2 }), L({ id: 'b' })]} formatCurrency={n => `Rs ${n}`} onOpen={() => {}} t={t} />)
    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument())
    expect(screen.getByText('a@10.5,76.2')).toBeInTheDocument()
    expect(screen.queryByText(/^b@/)).not.toBeInTheDocument()
    expect(screen.getByText(/marketplace\.map\.someHidden\{"count":1\}/)).toBeInTheDocument()
  })
  it('says so instead of showing an empty map when nothing has a location', () => {
    render(<ListingsMap listings={[L({ id: 'b' })]} formatCurrency={n => `Rs ${n}`} onOpen={() => {}} t={t} />)
    expect(screen.getByText('marketplace.map.none')).toBeInTheDocument()
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
  })
  it('adds the visitor as a marker when near-me is on', async () => {
    render(<ListingsMap listings={[L({ id: 'a', map_lat: 10.5, map_lng: 76.2 })]} formatCurrency={n => `Rs ${n}`} onOpen={() => {}} userLocation={{ lat: 10, lng: 76 }} t={t} />)
    await waitFor(() => expect(screen.getByText('me@10,76')).toBeInTheDocument())
  })
})

beforeEach(() => { vi.clearAllMocks() })

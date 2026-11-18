import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { MarketplaceFilterSheet } from './MarketplaceFilterSheet'
import { MyListingsTab } from './MyListingsTab'
import { ListingGallery } from './ListingGallery'
import { SellStepPhotos } from './SellStepPhotos'
import type { MarketplaceListing } from '../../types'

// key echo (with interpolation values appended so counts are checkable)
const t = ((key: string, opts?: Record<string, unknown>) => (opts && !opts.defaultValue ? `${key}${JSON.stringify(opts)}` : key)) as never
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

function SheetHarness({ initial = {}, onFilters = () => {} }: { initial?: Record<string, string>; onFilters?: (f: Record<string, string>) => void }) {
  const [filters, setFilters] = useState<Record<string, string>>(initial)
  const set = (u: (f: Record<string, string>) => Record<string, string>) => setFilters(f => { const n = u(f); onFilters(n); return n })
  return (
    <MarketplaceFilterSheet open onClose={() => {}} filters={filters} setFilters={set}
      breeds={['Gir', 'Sahiwal']} breedLabel={(_s, b) => b} classTerms={[]} resolveLabel={() => ''}
      onClear={() => set(() => ({}))} resultCount={12} t={t} />
  )
}

describe('MarketplaceFilterSheet', () => {
  it('sets a price range and drops the key again when the box is emptied', () => {
    const seen: Array<Record<string, string>> = []
    render(<SheetHarness onFilters={f => seen.push(f)} />)
    const min = screen.getByLabelText('marketplace.filters.min')
    fireEvent.change(min, { target: { value: '20000' } })
    expect(seen.at(-1)).toEqual({ minPrice: '20000' })
    fireEvent.change(min, { target: { value: '' } })
    expect(seen.at(-1)).toEqual({})
  })

  it('an age band sets both ends, and "Any" clears both', () => {
    const seen: Array<Record<string, string>> = []
    render(<SheetHarness onFilters={f => seen.push(f)} />)
    fireEvent.click(screen.getByText('marketplace.filters.age1to3'))
    expect(seen.at(-1)).toEqual({ minAge: '12', maxAge: '36' })
    fireEvent.click(screen.getAllByText('marketplace.filters.ageAny')[0])
    expect(seen.at(-1)).toEqual({})
  })

  it('changing the state forgets the old district', () => {
    const seen: Array<Record<string, string>> = []
    render(<SheetHarness initial={{ state: 'Kerala', district: 'Thrissur' }} onFilters={f => seen.push(f)} />)
    fireEvent.change(screen.getByDisplayValue('Kerala'), { target: { value: 'Karnataka' } })
    expect(seen.at(-1)).toEqual({ state: 'Karnataka' })
  })

  it('a toggle chip turns on and off; the pincode keeps digits only', () => {
    const seen: Array<Record<string, string>> = []
    render(<SheetHarness onFilters={f => seen.push(f)} />)
    fireEvent.click(screen.getByText('marketplace.chips.vaccinated'))
    expect(seen.at(-1)).toEqual({ vaccinationStatus: 'fully_vaccinated' })
    fireEvent.click(screen.getByText('marketplace.chips.vaccinated'))
    expect(seen.at(-1)).toEqual({})
    fireEvent.change(screen.getByLabelText('marketplace.filters.pincode'), { target: { value: '68a0b001' } })
    expect(seen.at(-1)).toEqual({ pincode: '680001' })
  })

  it('shows how many results the filters give, and Reset empties everything', () => {
    const seen: Array<Record<string, string>> = []
    render(<SheetHarness initial={{ minPrice: '1', breed: 'Gir' }} onFilters={f => seen.push(f)} />)
    expect(screen.getByText(/marketplace\.filters\.show.*12/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('marketplace.filters.reset'))
    expect(seen.at(-1)).toEqual({})
  })
})

const listing = (over: Partial<MarketplaceListing> = {}): MarketplaceListing => ({ id: 'l1', title: 'Gir cow', price: 50000, status: 'active', images: [], views_count: 7, ...over } as MarketplaceListing)

function renderMine(l: MarketplaceListing, over: Partial<React.ComponentProps<typeof MyListingsTab>> = {}) {
  const props = { listings: [l], loading: false, formatCurrency: (n: number) => `Rs ${n}`, onView: vi.fn(), onLoadViews: vi.fn().mockResolvedValue([]),
    onSave: vi.fn().mockResolvedValue(true), onMarkSold: vi.fn(), onDelete: vi.fn(), onSell: vi.fn(), t, ...over }
  render(<MyListingsTab {...props} />)
  return props
}

describe('MyListingsTab', () => {
  it('invites a seller with no listings to sell their first animal', () => {
    const p = renderMine(listing(), { listings: [] })
    fireEvent.click(screen.getByText('marketplace.mine.sellFirst'))
    expect(p.onSell).toHaveBeenCalled()
  })

  it('shows what state each listing is in, including waiting for review', () => {
    renderMine(listing({ adminApproved: false, admin_approved: false } as never))
    expect(screen.getByText(/marketplace\.mine\.status\.pending/)).toBeInTheDocument()
  })

  it('deleting needs a second, explicit tap and can be backed out of', () => {
    const p = renderMine(listing())
    fireEvent.click(screen.getByText('marketplace.mine.delete'))
    expect(p.onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('marketplace.mine.keep'))
    expect(screen.queryByText('marketplace.mine.deleteConfirm')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('marketplace.mine.delete'))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByText('marketplace.mine.delete'))
    expect(p.onDelete).toHaveBeenCalledWith('l1')
  })

  it('edits title and price, and does not let a blank title through', async () => {
    const p = renderMine(listing())
    fireEvent.click(screen.getByText('marketplace.mine.edit'))
    const title = screen.getByDisplayValue('Gir cow')
    fireEvent.change(title, { target: { value: '' } })
    expect(screen.getByText('marketplace.engagement.save')).toBeDisabled()
    fireEvent.change(title, { target: { value: 'Gir cow, 3rd calf' } })
    fireEvent.change(screen.getByDisplayValue('50000'), { target: { value: '55000' } })
    fireEvent.click(screen.getByText('marketplace.engagement.save'))
    await waitFor(() => expect(p.onSave).toHaveBeenCalledWith('l1', { title: 'Gir cow, 3rd calf', price: 55000, description: '' }))
  })

  it('a reserved listing cannot be deleted from here and says what to do', () => {
    renderMine(listing({ status: 'reserved' }))
    expect(screen.queryByText('marketplace.mine.delete')).not.toBeInTheDocument()
    expect(screen.getByText('marketplace.mine.reservedHint')).toBeInTheDocument()
  })

  it('a sold listing offers no edit or mark-sold', () => {
    renderMine(listing({ status: 'sold' }))
    expect(screen.queryByText('marketplace.mine.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('marketplace.mine.markSold')).not.toBeInTheDocument()
  })

  it('lists who viewed the number, or says nobody has', async () => {
    const p = renderMine(listing(), { onLoadViews: vi.fn().mockResolvedValue([{ first_name: 'Anil', last_initial: 'K', channel: 'call', created_at: '2026-11-18T10:00:00Z' }]) })
    fireEvent.click(screen.getByText(/marketplace\.mine\.whoViewed/))
    await waitFor(() => expect(screen.getByText(/Anil K\./)).toBeInTheDocument())
    expect(p.onLoadViews).toHaveBeenCalledWith('l1')
  })
})

describe('ListingGallery', () => {
  const cld = 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4'
  it('puts the video first, then the photos, and steps through them', () => {
    const { container } = render(<ListingGallery title="Cow" images={['/uploads/a.jpg', '/uploads/b.jpg']} videoUrl={cld} t={t} />)
    expect(container.querySelector('video')).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('marketplace.gallery.next'))
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('.mp-detail-gallery-main img')).toBeTruthy()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })
  it('wraps around from the first slide backwards', () => {
    render(<ListingGallery title="Cow" images={['/uploads/a.jpg', '/uploads/b.jpg']} videoUrl={null} t={t} />)
    fireEvent.click(screen.getByLabelText('marketplace.gallery.previous'))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })
  it('a link that cannot play inline opens in a new tab instead of showing a broken player', () => {
    render(<ListingGallery title="Cow" images={[]} videoUrl="https://youtu.be/xyz" t={t} />)
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
  })
  it('renders nothing when there is no media', () => {
    const { container } = render(<ListingGallery title="Cow" images={[]} videoUrl={null} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SellStepPhotos', () => {
  const base = { sellForm: { images: [] as string[], videoUrl: '' }, sf: vi.fn(), setSellForm: vi.fn(), maxListingImages: 8, minRecommendedPhotos: 3,
    uploadingImages: false, uploadProgress: { done: 0, total: 0 }, onImageUpload: vi.fn(), uploadingVideo: false, videoProgress: null, onVideoUpload: vi.fn(),
    maxVideoDurationSeconds: 60, maxVideoSizeMb: 50, onNext: vi.fn(), t }
  it('offers the camera and the gallery as separate taps, each a real file input', () => {
    const { container } = render(<SellStepPhotos {...base} />)
    const photoInputs = Array.from(container.querySelectorAll('input[type="file"][accept="image/*"]'))
    expect(photoInputs).toHaveLength(2)
    expect(photoInputs.some(i => i.getAttribute('capture') === 'environment')).toBe(true)
    expect(photoInputs.some(i => i.hasAttribute('multiple'))).toBe(true)
    const videoInputs = container.querySelectorAll('input[type="file"][accept="video/*"]')
    expect(videoInputs).toHaveLength(2)
  })
  it('stops accepting photos at the limit', () => {
    const { container } = render(<SellStepPhotos {...base} sellForm={{ images: Array.from({ length: 8 }, (_, i) => `/uploads/${i}.jpg`), videoUrl: '' }} />)
    container.querySelectorAll('input[type="file"][accept="image/*"]').forEach(i => expect(i).toBeDisabled())
  })
  it('the first photo is the cover; another can be made the cover', () => {
    const setSellForm = vi.fn()
    render(<SellStepPhotos {...base} setSellForm={setSellForm} sellForm={{ images: ['/uploads/a.jpg', '/uploads/b.jpg'], videoUrl: '' }} />)
    expect(screen.getAllByText('marketplace.sell.coverPhoto')).toHaveLength(1)
    fireEvent.click(screen.getByText('marketplace.sell.makeCover'))
    const updater = setSellForm.mock.calls[0][0]
    expect(updater({ images: ['/uploads/a.jpg', '/uploads/b.jpg'] }).images).toEqual(['/uploads/b.jpg', '/uploads/a.jpg'])
  })
})

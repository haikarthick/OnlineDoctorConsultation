import React, { useState, useEffect, useCallback } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import './Marketplace.css'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { MarketplaceListing, MarketplaceBid, MarketplaceOrder, MarketplaceStats, MarketPriceData } from '../types'

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'animal', label: '🐄 Animals' },
  { value: 'feed', label: '🌾 Feed & Nutrition' },
  { value: 'equipment', label: '🔧 Equipment' },
  { value: 'medicine', label: '💊 Medicine' },
  { value: 'semen_embryo', label: '🧬 Semen/Embryo' },
  { value: 'service', label: '🩺 Services' },
  { value: 'other', label: '📦 Other' },
]
const CATEGORY_ICONS: Record<string, string> = { animal: '🐄', feed: '🌾', equipment: '🔧', medicine: '💊', semen_embryo: '🧬', service: '🩺', other: '📦' }
const SPECIES_LIST = ['Cow', 'Buffalo', 'Goat', 'Sheep', 'Horse', 'Camel', 'Pig', 'Poultry', 'Dog', 'Cat', 'Other']
const TIER_LABELS: Record<string, string> = { standard: '🏷️ Standard', premium: '⭐ Premium', spotlight: '🔥 Spotlight' }
const GENDER_LABELS: Record<string, string> = { male: '♂ Male', female: '♀ Female', unknown: 'Unknown' }
const VAX_LABELS: Record<string, string> = { fully_vaccinated: '✅ Fully', partially_vaccinated: '⚠️ Partial', not_vaccinated: '❌ None', unknown: '❓ Unknown' }

type TabKey = 'dashboard' | 'browse' | 'sell' | 'auctions' | 'orders' | 'prices' | 'admin'

// ─── Helper to read snake_case or camelCase ───
const g = (l: any, ...keys: string[]): any => { for (const k of keys) { if (l[k] !== undefined && l[k] !== null) return l[k]; } return undefined }

const Marketplace: React.FC = () => {
  const { formatCurrency, settings } = useSettings()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [orders, setOrders] = useState<MarketplaceOrder[]>([])
  const [bids, setBids] = useState<MarketplaceBid[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filters
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortBy, setSortBy] = useState('')

  // Multi-step sell form
  const [sellStep, setSellStep] = useState(0)
  const [sellForm, setSellForm] = useState<Record<string, any>>({
    title: '', description: '', category: 'animal', listingType: 'sale', price: '', quantity: '1', unit: 'head', condition: 'new', location: '', tags: '',
    species: '', breed: '', animalAgeMonths: '', animalWeightKg: '', gender: '', lactationNumber: '', dailyMilkYield: '',
    pregnancyStatus: '', pregnancyMonth: '', vaccinationStatus: 'unknown', healthCertificate: false,
    listingTier: 'standard', isHotDeal: false, auctionEndTime: '', reservePrice: '', contactPhone: '', latitude: '', longitude: '',
  })

  // Bid
  const [bidAmount, setBidAmount] = useState('')
  const [bidMessage, setBidMessage] = useState('')

  // Admin
  const [adminListings, setAdminListings] = useState<MarketplaceListing[]>([])
  const [adminStats, setAdminStats] = useState<MarketplaceStats | null>(null)
  const [adminFilter, setAdminFilter] = useState<string>('')
  const [adminRejectReason, setAdminRejectReason] = useState('')

  // Market prices
  const [marketPrices, setMarketPrices] = useState<MarketPriceData[]>([])

  // Order role
  const [orderRole, setOrderRole] = useState<'buyer' | 'seller'>('buyer')

  const fetchDashboard = useCallback(async () => {
    try { const res = await apiService.getMarketplaceDashboard(); setDashboard(res.data) } catch {}
  }, [])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { status: 'active', ...filters }
      if (sortBy) params.sortBy = sortBy
      const res = await apiService.listMarketplaceListings(params)
      setListings(res.data?.items || [])
    } catch { setListings([]) }
    setLoading(false)
  }, [filters, sortBy])

  useEffect(() => { fetchDashboard(); fetchListings() }, [])
  useEffect(() => { fetchListings() }, [filters, sortBy])

  const viewListing = async (listing: MarketplaceListing) => {
    try {
      const res = await apiService.getMarketplaceListing(listing.id)
      setSelectedListing(res.data)
      const lt = g(listing, 'listingType', 'listing_type')
      if (lt === 'auction') {
        const bidsRes = await apiService.listMarketplaceBids(listing.id)
        setBids(bidsRes.data?.items || [])
      }
    } catch (e: any) { setError(e.message) }
  }

  const createListing = async () => {
    if (!sellForm.title.trim()) { setError('Title is required'); return }
    try {
      const payload: any = { ...sellForm }
      payload.price = +payload.price || null
      payload.quantity = +payload.quantity || 1
      payload.animalAgeMonths = +payload.animalAgeMonths || null
      payload.animalWeightKg = +payload.animalWeightKg || null
      payload.lactationNumber = +payload.lactationNumber || null
      payload.dailyMilkYield = +payload.dailyMilkYield || null
      payload.pregnancyMonth = +payload.pregnancyMonth || null
      payload.reservePrice = +payload.reservePrice || null
      payload.latitude = +payload.latitude || null
      payload.longitude = +payload.longitude || null
      payload.tags = typeof payload.tags === 'string' ? payload.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : payload.tags
      await apiService.createMarketplaceListing(payload)
      setSuccessMsg('Listing created successfully!')
      setSellForm({ title: '', description: '', category: 'animal', listingType: 'sale', price: '', quantity: '1', unit: 'head', condition: 'new', location: '', tags: '',
        species: '', breed: '', animalAgeMonths: '', animalWeightKg: '', gender: '', lactationNumber: '', dailyMilkYield: '',
        pregnancyStatus: '', pregnancyMonth: '', vaccinationStatus: 'unknown', healthCertificate: false,
        listingTier: 'standard', isHotDeal: false, auctionEndTime: '', reservePrice: '', contactPhone: '', latitude: '', longitude: '' })
      setSellStep(0); setTab('browse'); fetchListings(); fetchDashboard()
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const placeBid = async () => {
    if (!selectedListing || !bidAmount) return
    try {
      await apiService.placeMarketplaceBid(selectedListing.id, { amount: +bidAmount, message: bidMessage })
      setSuccessMsg('Bid placed!'); setBidAmount(''); setBidMessage(''); viewListing(selectedListing)
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const buyNow = async (listing: MarketplaceListing) => {
    try {
      await apiService.createMarketplaceOrder({ listingId: listing.id, quantity: 1 })
      setSuccessMsg('Order placed!'); fetchListings(); fetchDashboard(); setSelectedListing(null)
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const fetchOrders = async (role: 'buyer' | 'seller' = orderRole) => {
    try { const res = await apiService.listMarketplaceOrders(role); setOrders(res.data?.items || []) } catch { setOrders([]) }
  }

  const fetchMarketPrices = async () => {
    try { const res = await apiService.getMarketPrices({}); setMarketPrices(res.data || []) } catch { setMarketPrices([]) }
  }

  const fetchAdminData = async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        apiService.adminListMarketplaceListings({ adminApproved: adminFilter || undefined }),
        apiService.adminGetMarketplaceStats(),
      ])
      setAdminListings(listRes.data?.items || [])
      setAdminStats(statsRes.data || null)
    } catch {}
  }

  const handleAdminApprove = async (id: string) => {
    try { await apiService.adminApproveMarketplaceListing(id); setSuccessMsg('Listing approved'); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const handleAdminReject = async (id: string) => {
    if (!adminRejectReason.trim()) { setError('Rejection reason is required'); return }
    try { await apiService.adminRejectMarketplaceListing(id, adminRejectReason); setSuccessMsg('Listing rejected'); setAdminRejectReason(''); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const handleToggleHotDeal = async (id: string, current: boolean) => {
    try { await apiService.adminToggleHotDeal(id, !current); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    try { await apiService.adminToggleFeatured(id, !current); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const updateFilter = (key: string, value: string) => setFilters(f => value ? { ...f, [key]: value } : (() => { const n = { ...f }; delete n[key]; return n })())
  const sf = (key: string, value: any) => setSellForm(f => ({ ...f, [key]: value }))

  // ─── Tab definitions ───
  const tabs: Array<[TabKey, string]> = [
    ['dashboard', '📊 Dashboard'], ['browse', '🛒 Browse'], ['sell', '📝 Sell'],
    ['auctions', '🔨 Auctions'], ['orders', '📦 Orders'], ['prices', '📈 Prices'],
  ]
  if (isAdmin) tabs.push(['admin', '🛡️ Admin'])

  // ─── Sell Step Titles ───
  const sellSteps = ['Basic Info', 'Animal Details', 'Health & Certs', 'Pricing & Location', 'Review & Publish']

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🏪 Livestock Marketplace</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>Buy, sell, and auction livestock, equipment, and veterinary supplies</p>
        </div>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={`module-tab ${tab === key ? 'active' : ''}`} onClick={() => {
            setTab(key); setSelectedListing(null)
            if (key === 'orders') fetchOrders()
            if (key === 'prices') fetchMarketPrices()
            if (key === 'admin') fetchAdminData()
            if (key === 'auctions') { setFilters({ listingType: 'auction' }); fetchListings() }
          }}>{label}</button>
        ))}
      </div>

      {/* ════════ DASHBOARD ════════ */}
      {tab === 'dashboard' && dashboard && (
        <div className="mp-dashboard">
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeListings || 0}</div><div className="stat-label">Active Listings</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.soldListings || 0}</div><div className="stat-label">Items Sold</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.pendingApproval || 0}</div><div className="stat-label">Pending Review</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.bySpecies?.length || 0}</div><div className="stat-label">Species Listed</div></div>
          </div>

          {/* Hot Deals Section */}
          {dashboard.hotDeals?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">🔥 Hot Deals</h3>
              <div className="mp-grid">
                {dashboard.hotDeals.map((l: any) => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => { setTab('browse'); viewListing(l) }} />)}
              </div>
            </div>
          )}

          {/* Species Breakdown */}
          {dashboard.bySpecies?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">📊 By Species</h3>
              <div className="mp-species-grid">
                {dashboard.bySpecies.map((s: any) => (
                  <div key={s.species} className="mp-species-card" onClick={() => { setTab('browse'); updateFilter('species', s.species) }}>
                    <div className="mp-species-name">{s.species}</div>
                    <div className="mp-species-count">{s.count} listings</div>
                    <div className="mp-species-price">Avg: {formatCurrency(Math.round(s.avg_price || 0))}</div>
                    {s.avg_milk_yield > 0 && <div className="mp-species-milk">🥛 {Number(s.avg_milk_yield).toFixed(1)}L/day avg</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Listings */}
          {dashboard.recentListings?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">🆕 Latest Listings</h3>
              <div className="mp-grid">
                {dashboard.recentListings.map((l: any) => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => { setTab('browse'); viewListing(l) }} />)}
              </div>
            </div>
          )}

          {/* Top Sellers */}
          {dashboard.topSellers?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">🏆 Top Sellers</h3>
              <div className="mp-sellers-list">
                {dashboard.topSellers.map((s: any, i: number) => (
                  <div key={i} className="mp-seller-row">
                    <span className="mp-seller-rank">#{i + 1}</span>
                    <span className="mp-seller-name">{s.name}</span>
                    <span className="mp-seller-stat">{s.listings} listings</span>
                    <span className="mp-seller-stat">{s.total_views} views</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ BROWSE ════════ */}
      {(tab === 'browse' || tab === 'auctions') && (
        <div>
          {selectedListing ? (
            <ListingDetail
              listing={selectedListing} bids={bids} formatCurrency={formatCurrency}
              bidAmount={bidAmount} bidMessage={bidMessage} onBidAmountChange={setBidAmount} onBidMessageChange={setBidMessage}
              onPlaceBid={placeBid} onBuyNow={() => buyNow(selectedListing)} onBack={() => setSelectedListing(null)}
              isAdmin={isAdmin} onToggleHotDeal={(id, v) => handleToggleHotDeal(id, v)} onToggleFeatured={(id, v) => handleToggleFeatured(id, v)}
            />
          ) : (
            <div>
              {/* Advanced Filters */}
              <div className="mp-filter-bar">
                <input className="module-input" value={filters.search || ''} onChange={e => updateFilter('search', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchListings()} placeholder="Search livestock, breeds..." style={{ flex: 1, minWidth: 200 }} />
                <select className="module-input" value={filters.category || ''} onChange={e => updateFilter('category', e.target.value)} style={{ width: 160 }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select className="module-input" value={filters.species || ''} onChange={e => updateFilter('species', e.target.value)} style={{ width: 130 }}>
                  <option value="">All Species</option>
                  {SPECIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="module-input" value={filters.gender || ''} onChange={e => updateFilter('gender', e.target.value)} style={{ width: 120 }}>
                  <option value="">Any Gender</option>
                  <option value="male">♂ Male</option><option value="female">♀ Female</option>
                </select>
                <select className="module-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 140 }}>
                  <option value="">Sort: Default</option>
                  <option value="price_asc">Price: Low→High</option>
                  <option value="price_desc">Price: High→Low</option>
                  <option value="newest">Newest First</option>
                  <option value="milk_yield">Milk Yield ↓</option>
                </select>
                <button className="module-btn primary" onClick={fetchListings}>🔍</button>
              </div>

              {/* Quick filter chips */}
              <div className="mp-chip-bar">
                <button className={`mp-chip ${filters.isHotDeal === 'true' ? 'active' : ''}`} onClick={() => updateFilter('isHotDeal', filters.isHotDeal === 'true' ? '' : 'true')}>🔥 Hot Deals</button>
                <button className={`mp-chip ${filters.healthCertificate === 'true' ? 'active' : ''}`} onClick={() => updateFilter('healthCertificate', filters.healthCertificate === 'true' ? '' : 'true')}>📋 Health Certified</button>
                <button className={`mp-chip ${filters.vaccinationStatus === 'fully_vaccinated' ? 'active' : ''}`} onClick={() => updateFilter('vaccinationStatus', filters.vaccinationStatus === 'fully_vaccinated' ? '' : 'fully_vaccinated')}>💉 Vaccinated</button>
                <button className={`mp-chip ${filters.pregnancyStatus === 'pregnant' ? 'active' : ''}`} onClick={() => updateFilter('pregnancyStatus', filters.pregnancyStatus === 'pregnant' ? '' : 'pregnant')}>🤰 Pregnant</button>
                <button className={`mp-chip ${filters.listingTier === 'premium' ? 'active' : ''}`} onClick={() => updateFilter('listingTier', filters.listingTier === 'premium' ? '' : 'premium')}>⭐ Premium</button>
                {Object.keys(filters).length > 0 && <button className="mp-chip clear" onClick={() => { setFilters({}); setSortBy('') }}>✕ Clear All</button>}
              </div>

              {loading ? <div className="mp-loading">Loading listings...</div> : (
                <div className="mp-grid">
                  {listings.map(l => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => viewListing(l)} />)}
                  {listings.length === 0 && <p className="mp-empty">No listings found matching your criteria</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════ SELL (Multi-Step) ════════ */}
      {tab === 'sell' && (
        <div className="mp-sell-container">
          {/* Step Indicator */}
          <div className="mp-steps">
            {sellSteps.map((label, i) => (
              <div key={i} className={`mp-step ${i === sellStep ? 'active' : i < sellStep ? 'done' : ''}`} onClick={() => i < sellStep && setSellStep(i)}>
                <div className="mp-step-num">{i < sellStep ? '✓' : i + 1}</div>
                <div className="mp-step-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="module-card mp-sell-card">
            {/* Step 0: Basic Info */}
            {sellStep === 0 && (
              <div className="mp-sell-step">
                <h3>📝 Basic Information</h3>
                <div className="module-form">
                  <div><label className="module-label">Title *</label><input className="module-input" value={sellForm.title} onChange={e => sf('title', e.target.value)} placeholder="e.g. Premium HF Cow - 18L/day milk yield" /></div>
                  <div><label className="module-label">Description</label><textarea className="module-input" value={sellForm.description} onChange={e => sf('description', e.target.value)} rows={3} placeholder="Describe the animal, health, temperament..." /></div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Category</label><select className="module-input" value={sellForm.category} onChange={e => sf('category', e.target.value)}>
                      {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select></div>
                    <div style={{ flex: 1 }}><label className="module-label">Listing Type</label><select className="module-input" value={sellForm.listingType} onChange={e => sf('listingType', e.target.value)}>
                      <option value="sale">🏷️ Fixed Price</option><option value="auction">🔨 Auction</option><option value="wanted">📢 Wanted</option>
                    </select></div>
                  </div>
                  <div><label className="module-label">Tags (comma separated)</label><input className="module-input" value={sellForm.tags} onChange={e => sf('tags', e.target.value)} placeholder="e.g. organic, certified, high-yield, A2" /></div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn primary" onClick={() => { if (!sellForm.title.trim()) { setError('Title is required'); return; } setSellStep(1) }}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 1: Animal Details */}
            {sellStep === 1 && (
              <div className="mp-sell-step">
                <h3>🐄 Animal Details</h3>
                <div className="module-form">
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Species</label><select className="module-input" value={sellForm.species} onChange={e => sf('species', e.target.value)}>
                      <option value="">Select species</option>{SPECIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                    <div style={{ flex: 1 }}><label className="module-label">Breed</label><input className="module-input" value={sellForm.breed} onChange={e => sf('breed', e.target.value)} placeholder="e.g. HF, Jersey, Murrah, Sahiwal" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Gender</label><select className="module-input" value={sellForm.gender} onChange={e => sf('gender', e.target.value)}>
                      <option value="">Select gender</option><option value="female">♀ Female</option><option value="male">♂ Male</option>
                    </select></div>
                    <div style={{ flex: 1 }}><label className="module-label">Age (months)</label><input className="module-input" type="number" value={sellForm.animalAgeMonths} onChange={e => sf('animalAgeMonths', e.target.value)} placeholder="e.g. 36" /></div>
                    <div style={{ flex: 1 }}><label className="module-label">Weight (kg)</label><input className="module-input" type="number" value={sellForm.animalWeightKg} onChange={e => sf('animalWeightKg', e.target.value)} placeholder="e.g. 450" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Lactation Number</label><input className="module-input" type="number" value={sellForm.lactationNumber} onChange={e => sf('lactationNumber', e.target.value)} placeholder="e.g. 3" /></div>
                    <div style={{ flex: 1 }}><label className="module-label">Daily Milk Yield (L)</label><input className="module-input" type="number" value={sellForm.dailyMilkYield} onChange={e => sf('dailyMilkYield', e.target.value)} placeholder="e.g. 15" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Pregnancy Status</label><select className="module-input" value={sellForm.pregnancyStatus} onChange={e => sf('pregnancyStatus', e.target.value)}>
                      <option value="">Select</option><option value="pregnant">🤰 Pregnant</option><option value="not_pregnant">Not Pregnant</option><option value="unknown">Unknown</option>
                    </select></div>
                    {sellForm.pregnancyStatus === 'pregnant' && (
                      <div style={{ flex: 1 }}><label className="module-label">Pregnancy Month</label><input className="module-input" type="number" value={sellForm.pregnancyMonth} onChange={e => sf('pregnancyMonth', e.target.value)} min="1" max="12" /></div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}><label className="module-label">Quantity</label><input className="module-input" type="number" value={sellForm.quantity} onChange={e => sf('quantity', e.target.value)} placeholder="1" /></div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(0)}>← Back</button>
                  <button className="module-btn primary" onClick={() => setSellStep(2)}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 2: Health & Certs */}
            {sellStep === 2 && (
              <div className="mp-sell-step">
                <h3>🏥 Health & Certification</h3>
                <div className="module-form">
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Vaccination Status</label><select className="module-input" value={sellForm.vaccinationStatus} onChange={e => sf('vaccinationStatus', e.target.value)}>
                      <option value="unknown">Unknown</option><option value="fully_vaccinated">✅ Fully Vaccinated</option>
                      <option value="partially_vaccinated">⚠️ Partially Vaccinated</option><option value="not_vaccinated">❌ Not Vaccinated</option>
                    </select></div>
                    <div style={{ flex: 1 }}><label className="module-label">Condition</label><select className="module-input" value={sellForm.condition} onChange={e => sf('condition', e.target.value)}>
                      <option value="new">Healthy</option><option value="used">Fair</option><option value="refurbished">Under Treatment</option>
                    </select></div>
                  </div>
                  <div>
                    <label className="module-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={sellForm.healthCertificate} onChange={e => sf('healthCertificate', e.target.checked)} />
                      📋 Has Health Certificate from Veterinarian
                    </label>
                  </div>
                  <div><label className="module-label">Contact Phone</label><input className="module-input" value={sellForm.contactPhone} onChange={e => sf('contactPhone', e.target.value)} placeholder="+91-XXXXX-XXXXX" /></div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(1)}>← Back</button>
                  <button className="module-btn primary" onClick={() => setSellStep(3)}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 3: Pricing & Location */}
            {sellStep === 3 && (
              <div className="mp-sell-step">
                <h3>💰 Pricing & Location</h3>
                <div className="module-form">
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Price ({settings.currency})</label><input className="module-input" type="number" value={sellForm.price} onChange={e => sf('price', e.target.value)} placeholder="e.g. 85000" /></div>
                    {sellForm.listingType === 'auction' && (
                      <div style={{ flex: 1 }}><label className="module-label">Reserve Price</label><input className="module-input" type="number" value={sellForm.reservePrice} onChange={e => sf('reservePrice', e.target.value)} placeholder="Min acceptable price" /></div>
                    )}
                  </div>
                  {sellForm.listingType === 'auction' && (
                    <div><label className="module-label">Auction End Time</label><input className="module-input" type="datetime-local" value={sellForm.auctionEndTime} onChange={e => sf('auctionEndTime', e.target.value)} /></div>
                  )}
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}><label className="module-label">Listing Tier</label><select className="module-input" value={sellForm.listingTier} onChange={e => sf('listingTier', e.target.value)}>
                      <option value="standard">🏷️ Standard (Free)</option><option value="premium">⭐ Premium</option><option value="spotlight">🔥 Spotlight</option>
                    </select></div>
                  </div>
                  <div><label className="module-label">Location</label><input className="module-input" value={sellForm.location} onChange={e => sf('location', e.target.value)} placeholder="City, State, Country" /></div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(2)}>← Back</button>
                  <button className="module-btn primary" onClick={() => setSellStep(4)}>Review →</button>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {sellStep === 4 && (
              <div className="mp-sell-step">
                <h3>🔍 Review & Publish</h3>
                <div className="mp-review-grid">
                  <ReviewItem label="Title" value={sellForm.title} />
                  <ReviewItem label="Category" value={sellForm.category} />
                  <ReviewItem label="Type" value={sellForm.listingType} />
                  <ReviewItem label="Species" value={sellForm.species} />
                  <ReviewItem label="Breed" value={sellForm.breed} />
                  <ReviewItem label="Gender" value={sellForm.gender ? GENDER_LABELS[sellForm.gender] : '—'} />
                  <ReviewItem label="Age" value={sellForm.animalAgeMonths ? `${sellForm.animalAgeMonths} months` : '—'} />
                  <ReviewItem label="Weight" value={sellForm.animalWeightKg ? `${sellForm.animalWeightKg} kg` : '—'} />
                  <ReviewItem label="Milk Yield" value={sellForm.dailyMilkYield ? `${sellForm.dailyMilkYield} L/day` : '—'} />
                  <ReviewItem label="Pregnancy" value={sellForm.pregnancyStatus || '—'} />
                  <ReviewItem label="Vaccination" value={VAX_LABELS[sellForm.vaccinationStatus] || '—'} />
                  <ReviewItem label="Health Cert" value={sellForm.healthCertificate ? '✅ Yes' : '❌ No'} />
                  <ReviewItem label="Price" value={sellForm.price ? `${settings.currency} ${sellForm.price}` : 'Contact for price'} />
                  <ReviewItem label="Location" value={sellForm.location || '—'} />
                  <ReviewItem label="Tier" value={TIER_LABELS[sellForm.listingTier] || 'Standard'} />
                  <ReviewItem label="Contact" value={sellForm.contactPhone || '—'} />
                </div>
                {sellForm.description && <div style={{ marginTop: 12 }}><strong>Description:</strong> <p style={{ color: '#555' }}>{sellForm.description}</p></div>}
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(3)}>← Back</button>
                  <button className="module-btn primary" onClick={createListing}>🚀 Publish Listing</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ ORDERS ════════ */}
      {tab === 'orders' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button className={`module-btn ${orderRole === 'buyer' ? 'primary' : ''}`} onClick={() => { setOrderRole('buyer'); fetchOrders('buyer') }}>🛒 As Buyer</button>
            <button className={`module-btn ${orderRole === 'seller' ? 'primary' : ''}`} onClick={() => { setOrderRole('seller'); fetchOrders('seller') }}>💰 As Seller</button>
          </div>
          <table className="module-table">
            <thead><tr><th>Item</th><th>Species</th><th>{orderRole === 'buyer' ? 'Seller' : 'Buyer'}</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{g(o, 'listingTitle', 'listing_title') || '—'}</td>
                  <td>{o.species || '—'}</td>
                  <td>{orderRole === 'buyer' ? g(o, 'sellerName', 'seller_name') : g(o, 'buyerName', 'buyer_name')}</td>
                  <td>{o.quantity}</td>
                  <td style={{ fontWeight: 700, color: '#667eea' }}>{formatCurrency(g(o, 'totalPrice', 'total_price') || 0)}</td>
                  <td><span className={`module-badge ${o.status === 'completed' || o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : ''}`}>{o.status}</span></td>
                  <td>{(g(o, 'createdAt', 'created_at')) ? new Date(g(o, 'createdAt', 'created_at')).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="mp-empty">No orders found</p>}
        </div>
      )}

      {/* ════════ MARKET PRICES ════════ */}
      {tab === 'prices' && (
        <div className="mp-section">
          <h3 className="mp-section-title">📈 Market Price Intelligence</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>Average prices across all active and sold listings by species and breed</p>
          {marketPrices.length > 0 ? (
            <table className="module-table">
              <thead><tr><th>Species</th><th>Breed</th><th>Listings</th><th>Avg Price</th><th>Min</th><th>Max</th><th>Avg Milk/day</th><th>Avg Weight</th></tr></thead>
              <tbody>
                {marketPrices.map((mp, i) => (
                  <tr key={i}>
                    <td><strong>{mp.species}</strong></td>
                    <td>{mp.breed || '—'}</td>
                    <td>{mp.total_listings}</td>
                    <td style={{ fontWeight: 700, color: '#667eea' }}>{formatCurrency(Math.round(mp.avg_price || 0))}</td>
                    <td>{formatCurrency(Math.round(mp.min_price || 0))}</td>
                    <td>{formatCurrency(Math.round(mp.max_price || 0))}</td>
                    <td>{mp.avg_milk_yield ? `${Number(mp.avg_milk_yield).toFixed(1)}L` : '—'}</td>
                    <td>{mp.avg_weight ? `${Number(mp.avg_weight).toFixed(0)} kg` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="mp-empty">No market price data available yet. List some animals to see pricing trends!</p>}
        </div>
      )}

      {/* ════════ ADMIN PANEL ════════ */}
      {tab === 'admin' && isAdmin && (
        <div>
          {/* Admin Stats Overview */}
          {adminStats && (
            <div className="module-stats">
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.total_listings || 0}</div><div className="stat-label">Total Listings</div></div>
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.active_listings || 0}</div><div className="stat-label">Active</div></div>
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.sold_listings || 0}</div><div className="stat-label">Sold</div></div>
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.pending_review || 0}</div><div className="stat-label">Pending Review</div></div>
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.hot_deals || 0}</div><div className="stat-label">Hot Deals</div></div>
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.auctions || 0}</div><div className="stat-label">Auctions</div></div>
              <div className="stat-card"><div className="stat-value">{adminStats.overview?.total_views || 0}</div><div className="stat-label">Total Views</div></div>
            </div>
          )}

          {/* Species Breakdown */}
          {adminStats?.bySpecies && adminStats.bySpecies.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">Species Analytics</h3>
              <table className="module-table">
                <thead><tr><th>Species</th><th>Count</th><th>Avg Price</th><th>Avg Milk Yield</th><th>Avg Weight</th></tr></thead>
                <tbody>{adminStats.bySpecies.map((s, i) => (
                  <tr key={i}><td><strong>{s.species}</strong></td><td>{s.count}</td>
                    <td>{formatCurrency(Math.round(s.avg_price || 0))}</td>
                    <td>{s.avg_milk_yield ? `${Number(s.avg_milk_yield).toFixed(1)}L` : '—'}</td>
                    <td>{s.avg_weight ? `${Number(s.avg_weight).toFixed(0)}kg` : '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Price Distribution */}
          {adminStats?.priceDistribution && (
            <div className="mp-section">
              <h3 className="mp-section-title">Price Distribution</h3>
              <div className="module-stats">
                <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.under_10k}</div><div className="stat-label">Under ₹10K</div></div>
                <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.range_10k_50k}</div><div className="stat-label">₹10K - ₹50K</div></div>
                <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.range_50k_100k}</div><div className="stat-label">₹50K - ₹1L</div></div>
                <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.above_100k}</div><div className="stat-label">Above ₹1L</div></div>
              </div>
            </div>
          )}

          {/* All Listings Management */}
          <div className="mp-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="mp-section-title" style={{ margin: 0 }}>Listing Management</h3>
              <select className="module-input" value={adminFilter} onChange={e => { setAdminFilter(e.target.value); fetchAdminData() }} style={{ width: 180 }}>
                <option value="">All Listings</option>
                <option value="true">✅ Approved</option>
                <option value="false">❌ Rejected / Pending</option>
              </select>
            </div>
            <table className="module-table">
              <thead><tr><th>Title</th><th>Seller</th><th>Species</th><th>Price</th><th>Status</th><th>Approved</th><th>Actions</th></tr></thead>
              <tbody>
                {adminListings.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {g(l, 'isHotDeal', 'is_hot_deal') && <span title="Hot Deal">🔥</span>}
                        {l.featured && <span title="Featured">⭐</span>}
                        <span style={{ cursor: 'pointer', color: '#667eea' }} onClick={() => { setTab('browse'); viewListing(l) }}>{l.title}</span>
                      </div>
                    </td>
                    <td>{g(l, 'sellerName', 'seller_name') || '—'}</td>
                    <td>{l.species || '—'}</td>
                    <td>{l.price ? formatCurrency(l.price) : '—'}</td>
                    <td><span className={`module-badge ${l.status === 'active' ? 'success' : l.status === 'rejected' ? 'error' : ''}`}>{l.status}</span></td>
                    <td>{g(l, 'adminApproved', 'admin_approved') === true ? '✅' : g(l, 'adminApproved', 'admin_approved') === false ? '❌' : '⏳'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {g(l, 'adminApproved', 'admin_approved') !== true && <button className="module-btn small" onClick={() => handleAdminApprove(l.id)} title="Approve">✅</button>}
                        <button className="module-btn small" onClick={() => handleToggleHotDeal(l.id, g(l, 'isHotDeal', 'is_hot_deal') || false)} title="Toggle Hot Deal">{g(l, 'isHotDeal', 'is_hot_deal') ? '🔥' : '💤'}</button>
                        <button className="module-btn small" onClick={() => handleToggleFeatured(l.id, l.featured || false)} title="Toggle Featured">{l.featured ? '⭐' : '☆'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {adminListings.length === 0 && <p className="mp-empty">No listings to manage</p>}
          </div>

          {/* Reject with reason */}
          <div className="mp-section">
            <h3 className="mp-section-title">Reject a Listing</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <input className="module-input" value={adminRejectReason} onChange={e => setAdminRejectReason(e.target.value)} placeholder="Rejection reason..." style={{ flex: 1 }} />
              <select className="module-input" style={{ width: 250 }} id="rejectListingSelect">
                <option value="">Select listing to reject</option>
                {adminListings.filter(l => g(l, 'adminApproved', 'admin_approved') !== false).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
              <button className="module-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={() => {
                const sel = (document.getElementById('rejectListingSelect') as HTMLSelectElement)?.value
                if (sel) handleAdminReject(sel)
              }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Listing Card Component ───
const ListingCard: React.FC<{ listing: MarketplaceListing; formatCurrency: (n: number) => string; onView: () => void }> = ({ listing: l, formatCurrency, onView }) => {
  const species = l.species
  const breed = l.breed
  const milkYield = g(l, 'dailyMilkYield', 'daily_milk_yield')
  const isHot = g(l, 'isHotDeal', 'is_hot_deal')
  const tier = g(l, 'listingTier', 'listing_tier')
  const vax = g(l, 'vaccinationStatus', 'vaccination_status')
  const hasCert = g(l, 'healthCertificate', 'health_certificate')
  const pregnancy = g(l, 'pregnancyStatus', 'pregnancy_status')
  const gender = l.gender
  const listingType = g(l, 'listingType', 'listing_type')
  const bidCount = g(l, 'bidCount', 'bid_count')
  const sellerName = g(l, 'sellerName', 'seller_name')
  const viewsCount = g(l, 'viewsCount', 'views_count')
  const weight = g(l, 'animalWeightKg', 'animal_weight_kg')
  const images = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || [])
  const tags = typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : (l.tags || [])

  return (
    <div className={`mp-listing-card ${tier === 'spotlight' ? 'spotlight' : tier === 'premium' ? 'premium' : ''}`} onClick={onView}>
      {isHot && <div className="mp-hot-ribbon">🔥 HOT DEAL</div>}
      {tier === 'spotlight' && !isHot && <div className="mp-hot-ribbon spotlight-ribbon">🔥 SPOTLIGHT</div>}

      {/* Image placeholder */}
      <div className="mp-card-img">
        {images.length > 0 ? <img src={images[0]} alt={l.title} /> : <div className="mp-card-img-placeholder">{CATEGORY_ICONS[l.category] || '📦'}</div>}
      </div>

      <div className="mp-card-body">
        {/* Category + Type badges */}
        <div className="mp-card-badges">
          <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
          <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? '🔨 Auction' : '💵 Fixed'}</span>
          {tier === 'premium' && <span className="mp-badge premium">⭐</span>}
        </div>

        <h4 className="mp-card-title">{l.title}</h4>

        {/* Livestock details row */}
        {(species || breed) && (
          <div className="mp-card-livestock">
            {species && <span className="mp-tag species">{species}</span>}
            {breed && <span className="mp-tag breed">{breed}</span>}
            {gender && <span className="mp-tag gender">{gender === 'female' ? '♀' : '♂'}</span>}
          </div>
        )}

        {/* Key metrics */}
        <div className="mp-card-metrics">
          {milkYield && <span className="mp-metric">🥛 {milkYield}L/day</span>}
          {weight && <span className="mp-metric">⚖️ {weight}kg</span>}
          {pregnancy === 'pregnant' && <span className="mp-metric pregnant">🤰 Pregnant</span>}
          {vax === 'fully_vaccinated' && <span className="mp-metric vax">💉 Vaccinated</span>}
          {hasCert && <span className="mp-metric cert">📋 Certified</span>}
        </div>

        {/* Price */}
        <div className="mp-card-price">
          {l.price ? formatCurrency(l.price) : 'Contact'}
          {listingType === 'auction' && bidCount && <span className="mp-bid-count">{bidCount} bids</span>}
        </div>

        {/* Footer */}
        <div className="mp-card-footer">
          <span>{sellerName || 'Unknown'}</span>
          <span>{viewsCount || 0} views</span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mp-card-tags">
            {tags.slice(0, 3).map((t: string) => <span key={t} className="mp-tag">{t}</span>)}
            {tags.length > 3 && <span className="mp-tag">+{tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Listing Detail Component ───
const ListingDetail: React.FC<{
  listing: MarketplaceListing; bids: MarketplaceBid[]; formatCurrency: (n: number) => string;
  bidAmount: string; bidMessage: string; onBidAmountChange: (v: string) => void; onBidMessageChange: (v: string) => void;
  onPlaceBid: () => void; onBuyNow: () => void; onBack: () => void;
  isAdmin: boolean; onToggleHotDeal: (id: string, v: boolean) => void; onToggleFeatured: (id: string, v: boolean) => void;
}> = ({ listing: l, bids, formatCurrency, bidAmount, bidMessage, onBidAmountChange, onBidMessageChange, onPlaceBid, onBuyNow, onBack, isAdmin, onToggleHotDeal, onToggleFeatured }) => {
  const species = l.species
  const breed = l.breed
  const milkYield = g(l, 'dailyMilkYield', 'daily_milk_yield')
  const weight = g(l, 'animalWeightKg', 'animal_weight_kg')
  const age = g(l, 'animalAgeMonths', 'animal_age_months')
  const gender = l.gender
  const lactation = g(l, 'lactationNumber', 'lactation_number')
  const pregnancy = g(l, 'pregnancyStatus', 'pregnancy_status')
  const pregMonth = g(l, 'pregnancyMonth', 'pregnancy_month')
  const vax = g(l, 'vaccinationStatus', 'vaccination_status')
  const hasCert = g(l, 'healthCertificate', 'health_certificate')
  const tier = g(l, 'listingTier', 'listing_tier')
  const isHot = g(l, 'isHotDeal', 'is_hot_deal')
  const contact = g(l, 'contactPhone', 'contact_phone')
  const listingType = g(l, 'listingType', 'listing_type')
  const highestBid = g(l, 'highestBid', 'highest_bid')
  const sellerName = g(l, 'sellerName', 'seller_name')
  const viewsCount = g(l, 'viewsCount', 'views_count')
  const auctionEnd = g(l, 'auctionEndTime', 'auction_end_time')
  const tags = typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : (l.tags || [])

  return (
    <div className="mp-detail">
      <button className="module-btn small" onClick={onBack} style={{ marginBottom: 16 }}>← Back to listings</button>

      <div className="mp-detail-layout">
        <div className="mp-detail-main">
          {/* Header badges */}
          <div className="mp-card-badges" style={{ marginBottom: 12 }}>
            <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
            <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? '🔨 Auction' : '💵 Fixed Price'}</span>
            {tier && <span className="mp-badge premium">{TIER_LABELS[tier] || tier}</span>}
            {isHot && <span className="mp-badge hot">🔥 Hot Deal</span>}
            {l.featured && <span className="mp-badge featured">⭐ Featured</span>}
          </div>

          <h2 style={{ margin: '0 0 8px' }}>{l.title}</h2>
          <p style={{ color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{l.description || 'No description provided'}</p>

          {/* Price */}
          <div className="mp-detail-price">{l.price ? formatCurrency(l.price) : 'Contact for price'}</div>

          {/* Animal Profile Section */}
          {(species || breed || milkYield || weight || age) && (
            <div className="mp-detail-section">
              <h3>🐄 Animal Profile</h3>
              <div className="mp-detail-grid">
                {species && <div className="mp-detail-item"><span className="mp-detail-label">Species</span><span className="mp-detail-value">{species}</span></div>}
                {breed && <div className="mp-detail-item"><span className="mp-detail-label">Breed</span><span className="mp-detail-value">{breed}</span></div>}
                {gender && <div className="mp-detail-item"><span className="mp-detail-label">Gender</span><span className="mp-detail-value">{GENDER_LABELS[gender] || gender}</span></div>}
                {age && <div className="mp-detail-item"><span className="mp-detail-label">Age</span><span className="mp-detail-value">{age >= 12 ? `${Math.floor(age / 12)}y ${age % 12}m` : `${age} months`}</span></div>}
                {weight && <div className="mp-detail-item"><span className="mp-detail-label">Weight</span><span className="mp-detail-value">{weight} kg</span></div>}
                {lactation !== undefined && lactation !== null && <div className="mp-detail-item"><span className="mp-detail-label">Lactation #</span><span className="mp-detail-value">{lactation}</span></div>}
                {milkYield && <div className="mp-detail-item"><span className="mp-detail-label">Daily Milk</span><span className="mp-detail-value highlight">🥛 {milkYield} L/day</span></div>}
                {pregnancy && <div className="mp-detail-item"><span className="mp-detail-label">Pregnancy</span><span className="mp-detail-value">{pregnancy === 'pregnant' ? `🤰 Pregnant${pregMonth ? ` (${pregMonth} months)` : ''}` : pregnancy}</span></div>}
              </div>
            </div>
          )}

          {/* Health Section */}
          <div className="mp-detail-section">
            <h3>🏥 Health & Certification</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">Vaccination</span><span className="mp-detail-value">{vax ? (VAX_LABELS[vax] || vax) : 'Unknown'}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">Health Cert</span><span className="mp-detail-value">{hasCert ? '✅ Yes' : '❌ No'}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">Condition</span><span className="mp-detail-value">{l.condition}</span></div>
            </div>
          </div>

          {/* Seller & Location */}
          <div className="mp-detail-section">
            <h3>📍 Seller & Location</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">Seller</span><span className="mp-detail-value">{sellerName || 'Unknown'}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">Location</span><span className="mp-detail-value">{l.location || 'Not specified'}</span></div>
              {contact && <div className="mp-detail-item"><span className="mp-detail-label">Contact</span><span className="mp-detail-value">{contact}</span></div>}
              <div className="mp-detail-item"><span className="mp-detail-label">Views</span><span className="mp-detail-value">{viewsCount || 0}</span></div>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mp-card-tags" style={{ marginTop: 16 }}>
              {tags.map((t: string) => <span key={t} className="mp-tag">{t}</span>)}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="mp-detail-section" style={{ background: '#fef9c3', borderRadius: 8, padding: 16, marginTop: 16 }}>
              <h3>🛡️ Admin Controls</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="module-btn small" onClick={() => onToggleHotDeal(l.id, isHot || false)}>{isHot ? '🔥 Remove Hot Deal' : '💤 Make Hot Deal'}</button>
                <button className="module-btn small" onClick={() => onToggleFeatured(l.id, l.featured || false)}>{l.featured ? '⭐ Unfeature' : '☆ Feature'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Buy/Bid panel */}
        <div className="mp-detail-sidebar">
          {listingType !== 'auction' ? (
            <div className="mp-buy-panel">
              <h4>🛒 Buy Now</h4>
              <div className="mp-buy-price">{l.price ? formatCurrency(l.price) : 'Contact seller'}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Qty: {l.quantity} {l.unit || 'head'}</div>
              {l.status === 'active' && <button className="module-btn primary" style={{ width: '100%' }} onClick={onBuyNow}>Purchase Now</button>}
            </div>
          ) : (
            <div className="mp-bid-panel">
              <h4>🔨 Place Bid</h4>
              <div className="mp-bid-current">
                <span>Current Highest:</span>
                <span className="mp-bid-amount">{formatCurrency(highestBid || l.price || 0)}</span>
              </div>
              {auctionEnd && (
                <div className="mp-auction-end">
                  <span>Ends: {new Date(auctionEnd).toLocaleString()}</span>
                </div>
              )}
              <input className="module-input" type="number" placeholder="Your bid amount" value={bidAmount} onChange={e => onBidAmountChange(e.target.value)} />
              <textarea className="module-input" placeholder="Message (optional)" value={bidMessage} onChange={e => onBidMessageChange(e.target.value)} style={{ marginTop: 8, height: 60 }} />
              <button className="module-btn primary" style={{ width: '100%', marginTop: 8 }} onClick={onPlaceBid}>Place Bid</button>

              {bids.length > 0 && (
                <div className="mp-bid-history">
                  <h5>Bid History ({bids.length})</h5>
                  {bids.slice(0, 8).map(b => (
                    <div key={b.id} className="mp-bid-row">
                      <span className="mp-bid-row-amount">{formatCurrency(b.amount)}</span>
                      <span>{g(b, 'bidderName', 'bidder_name')}</span>
                      {(g(b, 'isWinning', 'is_winning')) && <span className="mp-bid-winning">★ Leading</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Review Item ───
const ReviewItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="mp-review-item"><span className="mp-review-label">{label}</span><span className="mp-review-value">{value || '—'}</span></div>
)

export default Marketplace

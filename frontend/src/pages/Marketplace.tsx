import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { MarketplaceListing, MarketplaceBid, MarketplaceOrder } from '../types'

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

const Marketplace: React.FC = () => {
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [orders, setOrders] = useState<MarketplaceOrder[]>([])
  const [bids, setBids] = useState<MarketplaceBid[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'browse' | 'create' | 'orders' | 'dashboard'>('dashboard')
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Create listing form
  const [listingForm, setListingForm] = useState({
    title: '', description: '', category: 'animal', listingType: 'fixed_price',
    price: '', quantity: '1', unit: '', condition: 'new', location: '', tags: '',
  })

  // Bid form
  const [bidAmount, setBidAmount] = useState('')
  const [bidMessage, setBidMessage] = useState('')

  useEffect(() => { fetchDashboard(); fetchListings() }, [])

  const fetchDashboard = async () => {
    try { const res = await apiService.getMarketplaceDashboard(); setDashboard(res.data) } catch {}
  }

  const fetchListings = async () => {
    setLoading(true)
    try {
      const params: any = { status: 'active' }
      if (filterCategory) params.category = filterCategory
      if (filterType) params.listingType = filterType
      if (searchQuery) params.search = searchQuery
      const res = await apiService.listMarketplaceListings(params)
      setListings(res.data?.items || [])
    } catch { setListings([]) }
    setLoading(false)
  }

  useEffect(() => { fetchListings() }, [filterCategory, filterType])

  const viewListing = async (listing: MarketplaceListing) => {
    try {
      const res = await apiService.getMarketplaceListing(listing.id)
      setSelectedListing(res.data)
      if (listing.listingType === 'auction') {
        const bidsRes = await apiService.listMarketplaceBids(listing.id)
        setBids(bidsRes.data?.items || [])
      }
    } catch (e: any) { setError(e.message) }
  }

  const createListing = async () => {
    if (!listingForm.title.trim()) return
    try {
      await apiService.createMarketplaceListing({
        ...listingForm, price: +listingForm.price || null, quantity: +listingForm.quantity || 1,
        tags: listingForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      setSuccessMsg('Listing created!')
      setListingForm({ title: '', description: '', category: 'animal', listingType: 'fixed_price', price: '', quantity: '1', unit: '', condition: 'new', location: '', tags: '' })
      setTab('browse')
      fetchListings(); fetchDashboard()
    } catch (e: any) { setError(e.message) }
  }

  const placeBid = async () => {
    if (!selectedListing || !bidAmount) return
    try {
      await apiService.placeMarketplaceBid(selectedListing.id, { amount: +bidAmount, message: bidMessage })
      setSuccessMsg('Bid placed!')
      setBidAmount(''); setBidMessage('')
      viewListing(selectedListing)
    } catch (e: any) { setError(e.message) }
  }

  const buyNow = async (listing: MarketplaceListing) => {
    try {
      await apiService.createMarketplaceOrder({ listingId: listing.id, quantity: 1 })
      setSuccessMsg('Order placed!')
      fetchListings(); fetchDashboard()
      setSelectedListing(null)
    } catch (e: any) { setError(e.message) }
  }

  const fetchOrders = async () => {
    try { const res = await apiService.listMarketplaceOrders('buyer'); setOrders(res.data?.items || []) } catch { setOrders([]) }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🏪 Marketplace & Auctions</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>Buy, sell, and auction animals, equipment, and veterinary supplies</p>
        </div>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {([['dashboard', '📊 Dashboard'], ['browse', '🛒 Browse'], ['create', '➕ Create Listing'], ['orders', '📦 My Orders']] as const).map(([t, label]) => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t as any); if (t === 'orders') fetchOrders() }}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && dashboard && (
        <div>
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeListings || 0}</div><div className="stat-label">Active Listings</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.soldListings || 0}</div><div className="stat-label">Items Sold</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.byCategory?.length || 0}</div><div className="stat-label">Categories</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.topSellers?.length || 0}</div><div className="stat-label">Active Sellers</div></div>
          </div>
          {dashboard.recentListings?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>Latest Listings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {dashboard.recentListings.map((l: any) => (
                  <div key={l.id} className="module-card" style={{ cursor: 'pointer' }} onClick={() => { setTab('browse'); viewListing(l) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{CATEGORY_ICONS[l.category] || '📦'} {l.category}</span>
                      <span className="module-badge">{l.listing_type}</span>
                    </div>
                    <h4 style={{ margin: '8px 0 4px' }}>{l.title}</h4>
                    <div style={{ fontWeight: 700, color: '#667eea', fontSize: 18 }}>${l.price || '—'}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>by {l.seller_name} · {l.views_count} views</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'browse' && (
        <div>
          {selectedListing ? (
            <div className="module-card">
              <button className="module-btn small" onClick={() => setSelectedListing(null)} style={{ marginBottom: 16 }}>← Back to listings</button>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ flex: 1 }}>
                  <span className="module-badge">{selectedListing.category}</span>
                  <span className="module-badge" style={{ marginLeft: 8 }}>{selectedListing.listingType}</span>
                  <h2 style={{ marginTop: 12 }}>{selectedListing.title}</h2>
                  <p style={{ color: '#555', lineHeight: 1.6 }}>{selectedListing.description || 'No description'}</p>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#667eea', margin: '16px 0' }}>${selectedListing.price || 'Contact for price'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                    <div><strong>Quantity:</strong> {selectedListing.quantity} {selectedListing.unit}</div>
                    <div><strong>Condition:</strong> {selectedListing.condition}</div>
                    <div><strong>Location:</strong> {selectedListing.location || 'N/A'}</div>
                    <div><strong>Seller:</strong> {selectedListing.sellerName}</div>
                    <div><strong>Views:</strong> {selectedListing.viewsCount}</div>
                  </div>
                  {selectedListing.tags?.length > 0 && (
                    <div style={{ marginTop: 12 }}>{selectedListing.tags.map((t: string) => <span key={t} className="module-badge" style={{ marginRight: 4 }}>{t}</span>)}</div>
                  )}
                </div>
                <div style={{ width: 300 }}>
                  {selectedListing.listingType === 'fixed_price' ? (
                    <div className="module-card" style={{ background: '#f8fafc' }}>
                      <h4>Buy Now</h4>
                      <button className="module-btn primary" style={{ width: '100%' }} onClick={() => buyNow(selectedListing)}>Purchase - ${selectedListing.price}</button>
                    </div>
                  ) : (
                    <div className="module-card" style={{ background: '#f8fafc' }}>
                      <h4>Place Bid</h4>
                      <p style={{ fontSize: 13, color: '#888' }}>Current highest: ${selectedListing.highestBid || selectedListing.price || 0}</p>
                      <input className="module-input" type="number" placeholder="Your bid amount" value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
                      <textarea className="module-input" placeholder="Message (optional)" value={bidMessage} onChange={e => setBidMessage(e.target.value)} style={{ marginTop: 8, height: 60 }} />
                      <button className="module-btn primary" style={{ width: '100%', marginTop: 8 }} onClick={placeBid}>Place Bid</button>
                      {bids.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <h5>Bid History ({bids.length})</h5>
                          {bids.slice(0, 5).map(b => (
                            <div key={b.id} style={{ padding: 8, borderBottom: '1px solid #eee', fontSize: 13 }}>
                              <strong>${b.amount}</strong> by {b.bidderName}
                              {b.isWinning && <span style={{ color: '#22c55e', marginLeft: 8 }}>★ Winning</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <input className="module-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchListings()} placeholder="Search listings..." style={{ flex: 1, minWidth: 200 }} />
                <select className="module-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 180 }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select className="module-input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 150 }}>
                  <option value="">All Types</option>
                  <option value="fixed_price">Fixed Price</option>
                  <option value="auction">Auction</option>
                </select>
                <button className="module-btn primary" onClick={fetchListings}>Search</button>
              </div>
              {loading ? <p style={{ textAlign: 'center', color: '#888' }}>Loading...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {listings.map(l => (
                    <div key={l.id} className="module-card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => viewListing(l)}
                      onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseOut={e => (e.currentTarget.style.transform = 'none')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12 }}>{CATEGORY_ICONS[l.category]} {l.category}</span>
                        <span className={`module-badge ${l.listingType === 'auction' ? 'warning' : ''}`}>{l.listingType === 'auction' ? '🔨 Auction' : '💵 Fixed'}</span>
                      </div>
                      <h4 style={{ margin: '0 0 8px', fontSize: 16 }}>{l.title}</h4>
                      <div style={{ fontWeight: 700, color: '#667eea', fontSize: 20, marginBottom: 8 }}>
                        ${l.price || '—'}
                        {l.listingType === 'auction' && l.bidCount && <span style={{ fontSize: 12, color: '#888', fontWeight: 400, marginLeft: 8 }}>{l.bidCount} bids</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>{l.sellerName} · Qty: {l.quantity} · {l.viewsCount} views</div>
                      {l.featured && <div style={{ marginTop: 6 }}><span className="module-badge warning">⭐ Featured</span></div>}
                    </div>
                  ))}
                  {listings.length === 0 && <p style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center' }}>No listings found</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="module-card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h3>Create New Listing</h3>
          <div className="module-form">
            <div><label className="module-label">Title *</label><input className="module-input" value={listingForm.title} onChange={e => setListingForm(f => ({ ...f, title: e.target.value }))} placeholder="What are you selling?" /></div>
            <div><label className="module-label">Description</label><textarea className="module-input" value={listingForm.description} onChange={e => setListingForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}><label className="module-label">Category</label><select className="module-input" value={listingForm.category} onChange={e => setListingForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
              <div style={{ flex: 1 }}><label className="module-label">Listing Type</label><select className="module-input" value={listingForm.listingType} onChange={e => setListingForm(f => ({ ...f, listingType: e.target.value }))}>
                <option value="fixed_price">Fixed Price</option><option value="auction">Auction</option>
              </select></div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}><label className="module-label">Price ($)</label><input className="module-input" type="number" value={listingForm.price} onChange={e => setListingForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div style={{ flex: 1 }}><label className="module-label">Quantity</label><input className="module-input" type="number" value={listingForm.quantity} onChange={e => setListingForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div style={{ flex: 1 }}><label className="module-label">Condition</label><select className="module-input" value={listingForm.condition} onChange={e => setListingForm(f => ({ ...f, condition: e.target.value }))}>
                <option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option>
              </select></div>
            </div>
            <div><label className="module-label">Location</label><input className="module-input" value={listingForm.location} onChange={e => setListingForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State" /></div>
            <div><label className="module-label">Tags (comma separated)</label><input className="module-input" value={listingForm.tags} onChange={e => setListingForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. organic, certified, premium" /></div>
          </div>
          <button className="module-btn primary" style={{ marginTop: 16 }} onClick={createListing}>Publish Listing</button>
        </div>
      )}

      {tab === 'orders' && (
        <div>
          <table className="module-table">
            <thead><tr><th>Item</th><th>Seller</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}><td>{o.listingTitle}</td><td>{o.sellerName}</td><td>{o.quantity}</td>
                <td style={{ fontWeight: 700, color: '#667eea' }}>${o.totalPrice}</td>
                <td><span className={`module-badge ${o.status === 'completed' || o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : ''}`}>{o.status}</span></td>
                <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '–'}</td></tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No orders yet</p>}
        </div>
      )}
    </div>
  )
}

export default Marketplace

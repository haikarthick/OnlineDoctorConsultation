import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import './ModulePage.css'
import './Marketplace.css'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { MarketplaceListing, MarketplaceBid, MarketplaceOrder, MarketplaceStats, MarketPriceData, MarketplaceThread, MarketplaceMessage, MarketplaceSavedSearch } from '../types'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { cldCardImageProps, cldDetailImageProps } from '../utils/media'
import { SPECIES_CATEGORIES, breedsForSpecies } from '../constants/speciesBreeds'

const CATEGORY_KEYS: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'marketplace.categories.all' },
  { value: 'animal', labelKey: 'marketplace.categories.animals' },
  { value: 'feed', labelKey: 'marketplace.categories.feed' },
  { value: 'equipment', labelKey: 'marketplace.categories.equipment' },
  { value: 'medicine', labelKey: 'marketplace.categories.medicine' },
  { value: 'semen_embryo', labelKey: 'marketplace.categories.semenEmbryo' },
  { value: 'service', labelKey: 'marketplace.categories.services' },
  { value: 'other', labelKey: 'marketplace.categories.other' },
]
const CATEGORY_ICONS: Record<string, string> = { animal: '🐄', feed: '🌾', equipment: '🔧', medicine: '💊', semen_embryo: '🧬', service: '🩺', other: '📦' }
const FARMER_SPECIES_LIST = ['Cow', 'Buffalo', 'Goat', 'Sheep', 'Horse', 'Camel', 'Pig', 'Poultry', 'Dog', 'Cat', 'Other']
const PET_OWNER_SPECIES_LIST = ['Dog', 'Cat', 'Horse', 'Rabbit', 'Cow', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Pig', 'Poultry', 'Other']

// Media limits — mirror backend caps (uploadImage/uploadVideo in
// backend/src/middleware/upload.ts, MAX_VIDEO_DURATION_SECONDS in
// FileController.ts). Checked client-side first so a farmer on a slow
// mobile connection gets instant feedback instead of uploading a file
// that the backend will just reject.
const MAX_LISTING_IMAGES = 4
const MAX_IMAGE_SIZE_MB = 5
const MAX_VIDEO_SIZE_MB = 100
const MAX_VIDEO_DURATION_SECONDS = 60

/** Reads a video file's duration client-side via an offscreen <video> element. */
function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const objectUrl = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read video metadata'))
    }
    video.src = objectUrl
  })
}

type TabKey = 'dashboard' | 'browse' | 'sell' | 'auctions' | 'orders' | 'messages' | 'favorites' | 'saved' | 'prices' | 'admin'

// ─── Helper to read snake_case or camelCase ───
const g = (l: any, ...keys: string[]): any => { for (const k of keys) { if (l[k] !== undefined && l[k] !== null) return l[k]; } return undefined }

const Marketplace: React.FC = () => {
  const { formatCurrency, settings } = useSettings()
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const isFarmer = user?.role === 'farmer'
  const SPECIES_LIST = (isFarmer || isAdmin) ? FARMER_SPECIES_LIST : PET_OWNER_SPECIES_LIST

  const GENDER_LABELS: Record<string, string> = { male: t('marketplace.genderLabel.male'), female: t('marketplace.genderLabel.female'), unknown: t('marketplace.genderLabel.unknown') }
  const VAX_LABELS: Record<string, string> = { fully_vaccinated: t('marketplace.vaxLabel.fullyShort'), partially_vaccinated: t('marketplace.vaxLabel.partialShort'), not_vaccinated: t('marketplace.vaxLabel.noneShort'), unknown: t('marketplace.vaxLabel.unknown') }

  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [orders, setOrders] = useState<MarketplaceOrder[]>([])
  const [bids, setBids] = useState<MarketplaceBid[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Filters
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortBy, setSortBy] = useState('')

  // Multi-step sell form
  const [sellStep, setSellStep] = useState(0)
  const [sellForm, setSellForm] = useState<Record<string, any>>({
    title: '', description: '', category: 'animal', listingType: 'fixed_price', price: '', quantity: '1', unit: 'head', condition: 'new', location: '', tags: '',
    species: '', breed: '', animalAgeMonths: '', animalWeightKg: '', gender: '', lactationNumber: '', dailyMilkYield: '',
    pregnancyStatus: '', pregnancyMonth: '', vaccinationStatus: 'unknown', healthCertificate: false,
    auctionEndTime: '', reservePrice: '', contactPhone: '', latitude: '', longitude: '',
    images: [], videoUrl: '', linkedAnimalId: '',
    sellerType: 'individual', registrationNumber: '', welfareAttestation: false, termsAccepted: false,
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
  const [inquiries, setInquiries] = useState<any[]>([])
  // Payment method chosen per deal before confirming (recorded for audit only)
  const [dealPaymentMethod, setDealPaymentMethod] = useState<Record<string, string>>({})

  // ── Engagement (Phase 3): messaging, favorites, saved searches ──
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<MarketplaceListing[]>([])
  const [threads, setThreads] = useState<MarketplaceThread[]>([])
  const [activeThread, setActiveThread] = useState<MarketplaceThread | null>(null)
  const [threadMessages, setThreadMessages] = useState<MarketplaceMessage[]>([])
  const [messageDraft, setMessageDraft] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [savedSearches, setSavedSearches] = useState<MarketplaceSavedSearch[]>([])
  const [saveSearchName, setSaveSearchName] = useState('')
  const [showSaveSearch, setShowSaveSearch] = useState(false)

  // ── Phase 4: pagination, price suggestion ──
  const [page, setPage] = useState(0)
  const [totalListings, setTotalListings] = useState(0)
  const PAGE_SIZE = 24
  const [priceHint, setPriceHint] = useState<{ avg: number; min: number; max: number; count: number } | null>(null)
  const [geoLocating, setGeoLocating] = useState(false)

  // ── Phase 5: config (interlink/transport), reports ──
  const [mpConfig, setMpConfig] = useState<{ treasureMount: { enabled: boolean; url: string }; transport: { enabled: boolean; url: string } } | null>(null)
  const [reportModal, setReportModal] = useState<{ listingId: string; title: string } | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [adminReports, setAdminReports] = useState<any[]>([])
  const [adminReportFilter, setAdminReportFilter] = useState('open')
  const [adminReportResolution, setAdminReportResolution] = useState<Record<string, string>>({})

  // Monetization (admin)
  const [monetizationSettings, setMonetizationSettings] = useState<any[]>([])
  const [monetizationPlans, setMonetizationPlans] = useState<any[]>([])
  const [monetizationDashboard, setMonetizationDashboard] = useState<any>(null)
  const [adminSubTab, setAdminSubTab] = useState<'listings' | 'reports' | 'settings' | 'plans' | 'revenue'>('listings')
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [planForm, setPlanForm] = useState<Record<string, any>>({ name: '', description: '', price: '', durationDays: '30', maxListings: '', maxBoostsPerMonth: '0', isActive: false, sortOrder: '0' })

  // Auction feature flag
  const [auctionEnabled, setAuctionEnabledState] = useState(false)

  // Proximity filter
  const [nearMeActive, setNearMeActive] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState('25')
  const [locationError, setLocationError] = useState('')

  // Animal list for auto-populate
  const [userAnimals, setUserAnimals] = useState<any[]>([])
  const [selectedAnimalId, setSelectedAnimalId] = useState('')
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  // Load auction enabled state on mount
  useEffect(() => {
    apiService.getAuctionEnabled().then((res: any) => {
      setAuctionEnabledState(res?.data?.enabled === true)
    }).catch(() => setAuctionEnabledState(false))
  }, [])

  const fetchDashboard = useCallback(async () => {
    try { const res = await apiService.getMarketplaceDashboard(); setDashboard(res.data) } catch { setError(t('marketplace.errors.dashboardLoadFailed')) }
  }, [t])

  // Load user's animals for auto-populate
  useEffect(() => {
    const loadAnimals = async () => {
      try {
        const res = await apiService.listAnimals({ limit: 200 })
        const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
        setUserAnimals(list)
      } catch { setUserAnimals([]) }
    }
    loadAnimals()
  }, [])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { status: 'active', ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
      if (sortBy) params.sortBy = sortBy
      if (nearMeActive && userLocation) {
        params.userLat = userLocation.lat
        params.userLng = userLocation.lng
        params.radiusKm = radiusKm
        if (!params.sortBy) params.sortBy = 'distance'
      }
      const res = await apiService.listMarketplaceListings(params)
      setListings(res.data?.items || [])
      setTotalListings(res.data?.total || 0)
    } catch { setListings([]); setTotalListings(0) }
    setLoading(false)
  }, [filters, sortBy, nearMeActive, userLocation, radiusKm, page])

  // ── Engagement data loaders ──
  const loadFavoriteIds = useCallback(async () => {
    try { const res = await apiService.getMarketplaceFavoriteIds(); setFavoriteIds(new Set(res.data?.ids || [])) } catch { setError(t('marketplace.errors.favoritesLoadFailed')) }
  }, [t])

  const loadUnreadCount = useCallback(async () => {
    try { const res = await apiService.getMarketplaceUnreadCount(); setUnreadCount(res.data?.unread || 0) } catch {}
  }, [])

  const fetchThreads = useCallback(async () => {
    try { const res = await apiService.listMarketplaceThreads(); setThreads(res.data?.items || []) } catch { setThreads([]) }
  }, [])

  const fetchFavorites = useCallback(async () => {
    try { const res = await apiService.listMarketplaceFavorites(); setFavorites(res.data?.items || []) } catch { setFavorites([]) }
  }, [])

  const fetchSavedSearches = useCallback(async () => {
    try { const res = await apiService.listMarketplaceSavedSearches(); setSavedSearches(res.data?.items || []) } catch { setSavedSearches([]) }
  }, [])

  const openThread = useCallback(async (thread: MarketplaceThread) => {
    setActiveThread(thread)
    try {
      const res = await apiService.getMarketplaceThreadMessages(thread.id)
      setThreadMessages(res.data?.items || [])
      loadUnreadCount(); fetchThreads()
    } catch { setThreadMessages([]) }
  }, [loadUnreadCount, fetchThreads])

  const refreshActiveThread = useCallback(async () => {
    if (activeThread) {
      try { const res = await apiService.getMarketplaceThreadMessages(activeThread.id); setThreadMessages(res.data?.items || []) } catch {}
    }
    fetchThreads(); loadUnreadCount()
  }, [activeThread, fetchThreads, loadUnreadCount])

  const sendMessage = async () => {
    if (!activeThread || !messageDraft.trim()) return
    const body = messageDraft.trim()
    setMessageDraft('')
    try {
      await apiService.sendMarketplaceMessage(activeThread.id, body)
      const res = await apiService.getMarketplaceThreadMessages(activeThread.id)
      setThreadMessages(res.data?.items || [])
      fetchThreads()
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message); setMessageDraft(body) }
  }

  const toggleFavorite = async (listingId: string) => {
    const isFav = favoriteIds.has(listingId)
    // Optimistic update
    setFavoriteIds(prev => { const n = new Set(prev); isFav ? n.delete(listingId) : n.add(listingId); return n })
    try {
      if (isFav) await apiService.removeMarketplaceFavorite(listingId)
      else await apiService.addMarketplaceFavorite(listingId)
      if (tab === 'favorites') fetchFavorites()
    } catch (e: any) {
      // Revert on failure
      setFavoriteIds(prev => { const n = new Set(prev); isFav ? n.add(listingId) : n.delete(listingId); return n })
      setError(e?.response?.data?.error?.message || e.message)
    }
  }

  const messageSeller = async (listing: MarketplaceListing) => {
    try {
      const res = await apiService.startMarketplaceThread(listing.id)
      const thread: MarketplaceThread = { ...res.data, listing_title: listing.title }
      setSelectedListing(null)
      setTab('messages')
      fetchThreads()
      openThread(thread)
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const saveCurrentSearch = async () => {
    const name = saveSearchName.trim() || (filters.species || filters.category || t('marketplace.engagement.mySearch'))
    try {
      await apiService.createMarketplaceSavedSearch({ name, filters, alertsEnabled: true })
      setSuccessMsg(t('marketplace.engagement.searchSaved'))
      setShowSaveSearch(false); setSaveSearchName('')
      fetchSavedSearches()
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const applySavedSearch = (s: MarketplaceSavedSearch) => {
    setFilters((s.filters || {}) as Record<string, string>)
    setTab('browse')
  }

  // ── Price suggestion from live market data (reuses getMarketPrices) ──
  const fetchPriceHint = useCallback(async (species?: string, breed?: string) => {
    if (!species) { setPriceHint(null); return }
    try {
      const res = await apiService.getMarketPrices({ species: species.toLowerCase() })
      const rows: any[] = res.data || []
      let matching = breed ? rows.filter(r => (r.breed || '').toLowerCase() === breed.toLowerCase()) : rows
      if (matching.length === 0) matching = rows
      const totalCount = matching.reduce((s, r) => s + (+r.total_listings || 0), 0)
      if (totalCount === 0) { setPriceHint(null); return }
      const avg = matching.reduce((s, r) => s + (+r.avg_price || 0) * (+r.total_listings || 0), 0) / totalCount
      const min = Math.min(...matching.map(r => +r.min_price || Infinity))
      const max = Math.max(...matching.map(r => +r.max_price || 0))
      setPriceHint({ avg: Math.round(avg), min: isFinite(min) ? Math.round(min) : 0, max: Math.round(max), count: totalCount })
    } catch { setPriceHint(null) }
  }, [])

  useEffect(() => {
    if (tab === 'sell') fetchPriceHint(sellForm.species, sellForm.breed)
  }, [sellForm.species, sellForm.breed, tab, fetchPriceHint])

  // ── Geocoding-lite: fill listing coordinates from the device location ──
  const useMyLocationForListing = () => {
    if (!navigator.geolocation) { setError(t('marketplace.proximity.notSupported', 'Geolocation not supported by your browser')); return }
    setGeoLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSellForm(f => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }))
        setGeoLocating(false)
        setSuccessMsg(t('marketplace.sell.locationCaptured'))
      },
      () => { setGeoLocating(false); setError(t('marketplace.proximity.denied', 'Location access denied. Please enable it in browser settings.')) }
    )
  }

  // Handle video upload for the sell form
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setError(t('marketplace.sell.videoTooLarge', { maxMb: MAX_VIDEO_SIZE_MB, defaultValue: `Video is too large — max ${MAX_VIDEO_SIZE_MB}MB` }))
      e.target.value = ''
      return
    }

    // Fail fast on the device before spending mobile data on an upload
    // the backend will reject anyway.
    try {
      const duration = await readVideoDuration(file)
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        setError(t('marketplace.sell.videoTooLong', { maxSec: MAX_VIDEO_DURATION_SECONDS, defaultValue: `Video is too long — max ${MAX_VIDEO_DURATION_SECONDS} seconds` }))
        e.target.value = ''
        return
      }
    } catch {
      // Couldn't read duration client-side (unsupported format/browser) —
      // let the backend's authoritative check catch it instead of blocking upload.
    }

    setUploadingVideo(true)
    try {
      const res = await apiService.uploadVideoFile(file, 'marketplace')
      const url = res.url || res.fileUrl
      if (url) { sf('videoUrl', url); setSuccessMsg(t('marketplace.sell.videoUploaded')) }
    } catch (err: any) {
      const apiErr = err?.response?.data?.error
      if (apiErr?.code === 'VIDEO_TOO_LONG') {
        setError(t('marketplace.sell.videoTooLong', { maxSec: apiErr.maxSeconds || MAX_VIDEO_DURATION_SECONDS, defaultValue: `Video is too long — max ${MAX_VIDEO_DURATION_SECONDS} seconds` }))
      } else {
        setError(apiErr?.message || t('marketplace.sell.uploadFailed', 'Upload failed'))
      }
    }
    setUploadingVideo(false)
    e.target.value = ''
  }

  const toggleSearchAlerts = async (s: MarketplaceSavedSearch) => {
    try { await apiService.updateMarketplaceSavedSearch(s.id, { alertsEnabled: !s.alertsEnabled }); fetchSavedSearches() }
    catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const deleteSavedSearch = async (id: string) => {
    try { await apiService.deleteMarketplaceSavedSearch(id); fetchSavedSearches() }
    catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  // ── Phase 5: config, reports, funnel ──
  const loadConfig = useCallback(async () => {
    try { const res = await apiService.getMarketplaceConfig(); setMpConfig(res.data) } catch {}
  }, [])

  const submitReport = async () => {
    if (!reportModal || !reportReason) return
    try {
      await apiService.reportMarketplaceListing(reportModal.listingId, reportReason, reportDetails || undefined)
      setSuccessMsg(t('marketplace.report.submitted'))
      setReportModal(null); setReportReason(''); setReportDetails('')
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  // Pre-purchase vet check — funnel into a paid consultation (the revenue layer)
  const bookVetCheck = (listing: MarketplaceListing) => {
    const params = new URLSearchParams({ purpose: 'pre_purchase_check' })
    if (listing.species) params.set('species', String(listing.species))
    navigate(`/find-doctor?${params.toString()}`)
  }

  const fetchAdminReports = async (status = adminReportFilter) => {
    try { const res = await apiService.adminListMarketplaceReports(status || undefined); setAdminReports(res.data?.items || []) } catch { setAdminReports([]) }
  }

  const resolveReport = async (id: string, status: string) => {
    try {
      await apiService.adminResolveMarketplaceReport(id, status, adminReportResolution[id] || undefined)
      setSuccessMsg(t('marketplace.report.resolved'))
      fetchAdminReports()
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  useEffect(() => { fetchDashboard(); fetchListings(); loadFavoriteIds(); loadUnreadCount(); loadConfig() }, [])
  useAutoRefresh('marketplace', fetchListings)
  useAutoRefresh('marketplace-messages', refreshActiveThread)
  useAutoRefresh('marketplace-saved-searches', fetchSavedSearches)
  // Reset to first page whenever the query changes
  useEffect(() => { setPage(0) }, [filters, sortBy, nearMeActive])
  useEffect(() => { fetchListings() }, [filters, sortBy, page, nearMeActive, userLocation, radiusKm])

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
    if (!sellForm.title.trim()) { setError(t('marketplace.sell.titleRequired')); setFieldErrors({ title: t('marketplace.sell.titleRequired') }); return }
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
      // Normalize enum fields to lowercase to match Joi schema
      if (payload.gender) payload.gender = (payload.gender as string).toLowerCase()
      if (payload.species) payload.species = (payload.species as string).toLowerCase()
      await apiService.createMarketplaceListing(payload)
      // Animal-category listings go through admin review before appearing publicly
      const needsReview = ['animal', 'semen_embryo'].includes(payload.category)
      setSuccessMsg(needsReview ? t('marketplace.deal.submittedForReview') : t('marketplace.listingCreated'))
      setSellForm({ title: '', description: '', category: 'animal', listingType: 'fixed_price', price: '', quantity: '1', unit: 'head', condition: 'new', location: '', tags: '',
        species: '', breed: '', animalAgeMonths: '', animalWeightKg: '', gender: '', lactationNumber: '', dailyMilkYield: '',
        pregnancyStatus: '', pregnancyMonth: '', vaccinationStatus: 'unknown', healthCertificate: false,
        auctionEndTime: '', reservePrice: '', contactPhone: '', latitude: '', longitude: '',
        images: [], linkedAnimalId: '',
        sellerType: 'individual', registrationNumber: '', welfareAttestation: false, termsAccepted: false })
      setSellStep(0); setTab('browse'); fetchListings(); fetchDashboard()
    } catch (e: any) { setError(e?.response?.data?.message || e?.response?.data?.error?.message || e.message) }
  }

  // Auto-populate sell form from selected animal
  const handleAnimalSelect = (animalId: string) => {
    setSelectedAnimalId(animalId)
    if (!animalId) return
    const animal = userAnimals.find((a: any) => a.id === animalId)
    if (!animal) return
    const updates: Record<string, any> = { linkedAnimalId: animalId }
    // Basic info
    if (animal.species) updates.species = animal.species
    if (animal.breed) updates.breed = animal.breed
    if (animal.gender) updates.gender = animal.gender.toLowerCase()
    // Weight: prefer current_weight over weight
    const w = animal.currentWeight || animal.current_weight || animal.weight
    if (w) updates.animalWeightKg = String(w)
    // Age from date of birth
    if (animal.dateOfBirth || animal.date_of_birth) {
      const dob = new Date(animal.dateOfBirth || animal.date_of_birth)
      const months = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      if (months > 0) updates.animalAgeMonths = String(months)
    }
    // Breeding / pregnancy status
    const bs = animal.breedingStatus || animal.breeding_status
    if (bs) {
      // Map animal breeding_status -> Joi-valid pregnancyStatus ('pregnant'|'not_pregnant'|'unknown')
      const statusMap: Record<string, string> = { pregnant: 'pregnant', bred: 'pregnant', lactating: 'not_pregnant', open: 'not_pregnant' }
      if (statusMap[bs]) updates.pregnancyStatus = statusMap[bs]
    }
    // Registration number for breeder compliance
    const regNum = animal.registrationNumber || animal.registration_number
    if (regNum) updates.registrationNumber = regNum
    // Auto-generate title
    const ageStr = updates.animalAgeMonths ? `${updates.animalAgeMonths}m` : ''
    const genderStr = animal.gender ? ` ${animal.gender}` : ''
    updates.title = `${animal.name} — ${animal.species || ''}${animal.breed ? ' ' + animal.breed : ''}${genderStr}${ageStr ? ', ' + ageStr : ''}`.trim()
    // Auto-generate description from medical notes and profile
    const descParts: string[] = []
    if (animal.name) descParts.push(`Name: ${animal.name}`)
    if (animal.breed) descParts.push(`Breed: ${animal.breed}`)
    if (animal.color) descParts.push(`Color: ${animal.color}`)
    if (animal.isNeutered || animal.is_neutered) descParts.push('Neutered/Spayed: Yes')
    const medNotes = animal.medicalNotes || animal.medical_notes
    if (medNotes) descParts.push(`Health Notes: ${medNotes}`)
    if (descParts.length > 0) updates.description = descParts.join('\n')
    setSellForm((prev: Record<string, any>) => ({ ...prev, ...updates }))
    setSuccessMsg(t('marketplace.sell.autoPopulated'))
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const oversized = Array.from(files).find(f => f.size > MAX_IMAGE_SIZE_MB * 1024 * 1024)
    if (oversized) {
      setError(t('marketplace.sell.imageTooLarge', { maxMb: MAX_IMAGE_SIZE_MB, defaultValue: `Image is too large — max ${MAX_IMAGE_SIZE_MB}MB` }))
      e.target.value = ''
      return
    }

    setUploadingImages(true)
    try {
      const urls: string[] = [...(sellForm.images || [])]
      for (let i = 0; i < Math.min(files.length, MAX_LISTING_IMAGES - urls.length); i++) {
        const res = await apiService.uploadImageFile(files[i], 'marketplace')
        if (res.url) urls.push(res.url)
        else if (res.fileUrl) urls.push(res.fileUrl)
      }
      setSellForm((prev: Record<string, any>) => ({ ...prev, images: urls }))
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('marketplace.sell.uploadFailed', 'Image upload failed'))
    }
    setUploadingImages(false)
    e.target.value = ''
  }

  const placeBid = async () => {
    if (!selectedListing || !bidAmount) return
    try {
      await apiService.placeMarketplaceBid(selectedListing.id, { amount: +bidAmount, message: bidMessage })
      setSuccessMsg(t('marketplace.bidPlaced')); setBidAmount(''); setBidMessage(''); viewListing(selectedListing)
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  // Free classifieds: reserving holds the listing while buyer and seller
  // connect and settle directly — no payment happens on the platform
  const reserveListing = async (listing: MarketplaceListing) => {
    if (listing.price == null) {
      // "Contact for fee" listing — send inquiry instead of reserving
      try {
        await apiService.createInquiry(listing.id, '')
        setSuccessMsg(t('marketplace.inquirySent', 'Inquiry sent! The seller will be notified.'))
        setSelectedListing(null)
      } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
      return
    }
    try {
      await apiService.createMarketplaceOrder({ listingId: listing.id, quantity: 1 })
      setSuccessMsg(t('marketplace.deal.reserveSuccess'))
      fetchListings(); fetchDashboard()
      // Re-open the listing: the reservation reveals the seller's contact details
      viewListing(listing)
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const fetchOrders = async (role: 'buyer' | 'seller' = orderRole) => {
    try { const res = await apiService.listMarketplaceOrders(role); setOrders(res.data?.items || []) } catch { setOrders([]) }
  }

  // ── Deal handshake actions (settlement happens off-platform) ──
  const confirmDeal = async (orderId: string) => {
    try {
      await apiService.confirmMarketplaceDeal(orderId, dealPaymentMethod[orderId] || undefined)
      setSuccessMsg(t('marketplace.deal.confirmRecorded'))
      fetchOrders(orderRole); fetchListings(); fetchDashboard()
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const cancelDeal = async (orderId: string) => {
    try {
      await apiService.cancelMarketplaceDeal(orderId)
      setSuccessMsg(t('marketplace.deal.dealCancelled'))
      fetchOrders(orderRole); fetchListings(); fetchDashboard()
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }

  const fetchInquiries = async (role: 'buyer' | 'seller' = orderRole) => {
    try { const res = await apiService.listInquiries(role); setInquiries(Array.isArray(res.data) ? res.data : []) } catch { setInquiries([]) }
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
    } catch { setError(t('marketplace.errors.adminDataLoadFailed')) }
  }

  const fetchMonetizationSettings = async () => {
    try {
      const [settingsRes, plansRes, dashRes] = await Promise.all([
        apiService.getMonetizationSettings(),
        apiService.getMonetizationPlans(),
        apiService.getMonetizationDashboard(),
      ])
      setMonetizationSettings(settingsRes.data || [])
      setMonetizationPlans(plansRes.data || [])
      setMonetizationDashboard(dashRes.data || null)
    } catch { setError(t('marketplace.errors.monetizationLoadFailed')) }
  }

  const handleToggleSetting = async (key: string, current: boolean) => {
    try {
      await apiService.updateMonetizationSetting(key, { isEnabled: !current })
      setSuccessMsg(t('marketplace.monetization.settingUpdated'))
      fetchMonetizationSettings()
    } catch (e: any) { setError(e.message) }
  }

  const handleSavePlan = async () => {
    try {
      const data = {
        name: planForm.name, description: planForm.description,
        price: parseFloat(planForm.price) || 0, durationDays: parseInt(planForm.durationDays) || 30,
        maxListings: planForm.maxListings ? parseInt(planForm.maxListings) : null,
        maxBoostsPerMonth: parseInt(planForm.maxBoostsPerMonth) || 0,
        isActive: planForm.isActive, sortOrder: parseInt(planForm.sortOrder) || 0,
      }
      if (editingPlan) {
        await apiService.updateMonetizationPlan(editingPlan.id, data)
      } else {
        await apiService.createMonetizationPlan(data)
      }
      setSuccessMsg(editingPlan ? t('marketplace.monetization.planUpdated') : t('marketplace.monetization.planCreated'))
      setEditingPlan(null)
      setPlanForm({ name: '', description: '', price: '', durationDays: '30', maxListings: '', maxBoostsPerMonth: '0', isActive: false, sortOrder: '0' })
      fetchMonetizationSettings()
    } catch (e: any) { setError(e.message) }
  }

  const handleDeletePlan = async (id: string) => {
    try {
      await apiService.deleteMonetizationPlan(id)
      setSuccessMsg(t('marketplace.monetization.planDeleted'))
      fetchMonetizationSettings()
    } catch (e: any) { setError(e.message) }
  }

  const handleTogglePlanActive = async (plan: any) => {
    try {
      await apiService.updateMonetizationPlan(plan.id, { isActive: !plan.is_active })
      fetchMonetizationSettings()
    } catch (e: any) { setError(e.message) }
  }

  const handleAdminApprove = async (id: string) => {
    try { await apiService.adminApproveMarketplaceListing(id); setSuccessMsg(t('marketplace.admin.listingApproved')); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const handleAdminReject = async (id: string) => {
    if (!adminRejectReason.trim()) { setError(t('marketplace.admin.rejectionRequired')); return }
    try { await apiService.adminRejectMarketplaceListing(id, adminRejectReason); setSuccessMsg(t('marketplace.admin.listingRejected')); setAdminRejectReason(''); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const handleToggleHotDeal = async (id: string, current: boolean) => {
    try { await apiService.adminToggleHotDeal(id, !current); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    try { await apiService.adminToggleFeatured(id, !current); fetchAdminData() } catch (e: any) { setError(e.message) }
  }

  const updateFilter = (key: string, value: string) => setFilters(f => value ? { ...f, [key]: value } : (() => { const n = { ...f }; delete n[key]; return n })())
  const sf = (key: string, value: any) => setSellForm(f => ({ ...f, [key]: value }))

  const handleNearMeToggle = () => {
    if (nearMeActive) {
      setNearMeActive(false)
      setLocationError('')
      return
    }
    if (!navigator.geolocation) {
      setLocationError(t('marketplace.proximity.notSupported', 'Geolocation not supported by your browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNearMeActive(true)
        setLocationError('')
      },
      () => setLocationError(t('marketplace.proximity.denied', 'Location access denied. Please enable it in browser settings.'))
    )
  }

  const handleAdminAuctionToggle = async () => {
    try {
      await apiService.setAuctionEnabled(!auctionEnabled)
      setAuctionEnabledState(!auctionEnabled)
      setSuccessMsg(auctionEnabled ? t('marketplace.admin.auctionDisabled', 'Auction feature disabled') : t('marketplace.admin.auctionEnabled', 'Auction feature enabled'))
    } catch (e: any) { setError(e.message) }
  }

  // ─── Tab definitions ───
  const tabs: Array<[TabKey, string]> = [
    ['dashboard', t('marketplace.tabs.dashboard')], ['browse', t('marketplace.tabs.browse')], ['sell', t('marketplace.tabs.sell')],
    // Auctions tab: always show to admin (to manage the toggle), hide from others when disabled
    ...(auctionEnabled || isAdmin ? [['auctions', t('marketplace.tabs.auctions')] as [TabKey, string]] : []),
    ['messages', `${t('marketplace.tabs.messages')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
    ['favorites', t('marketplace.tabs.favorites')],
    ['saved', t('marketplace.tabs.saved')],
    ['orders', t('marketplace.tabs.orders')], ['prices', t('marketplace.tabs.prices')],
  ]
  if (isAdmin) tabs.push(['admin', t('marketplace.tabs.admin')])

  // ─── Sell Step Titles ───
  const sellSteps = [t('marketplace.sell.steps.basicInfo'), t('marketplace.sell.steps.animalDetails'), t('marketplace.sell.steps.healthCerts'), t('marketplace.sell.steps.pricingLocation'), t('marketplace.sell.steps.reviewPublish')]

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('marketplace.pageTitle')}</h1>
          <p className="page-subtitle">{t('marketplace.subtitle')}</p>
        </div>
      </div>

      {error && <div className="module-alert error">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      {/* Report modal */}
      {reportModal && (
        <div className="mp-modal-overlay" onClick={() => setReportModal(null)}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <h3>🚩 {t('marketplace.report.reportListing')}</h3>
            <p className="mp-sell-step-desc">{t('marketplace.report.reportingWhat', { title: reportModal.title })}</p>
            <div className="module-form-group">
              <label className="module-label">{t('marketplace.report.reason')}</label>
              <select className="module-input" value={reportReason} onChange={e => setReportReason(e.target.value)}>
                <option value="">{t('marketplace.report.selectReason')}</option>
                {['scam', 'welfare_concern', 'prohibited', 'miscategorized', 'offensive', 'wrong_info', 'other'].map(r => (
                  <option key={r} value={r}>{t(`marketplace.report.reasons.${r}`)}</option>
                ))}
              </select>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('marketplace.report.details')}</label>
              <textarea className="module-input" rows={3} value={reportDetails} onChange={e => setReportDetails(e.target.value)}
                placeholder={t('marketplace.report.detailsPlaceholder')} maxLength={1000} />
            </div>
            <div className="mp-modal-actions">
              <button className="module-btn" onClick={() => setReportModal(null)}>{t('marketplace.monetization.cancel')}</button>
              <button className="module-btn primary" disabled={!reportReason} onClick={submitReport}>{t('marketplace.report.submit')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="module-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={`module-tab ${tab === key ? 'active' : ''}`} onClick={() => {
            setTab(key); setSelectedListing(null)
            if (key === 'orders') { fetchOrders(); fetchInquiries() }
            if (key === 'prices') fetchMarketPrices()
            if (key === 'admin') { fetchAdminData(); fetchMonetizationSettings() }
            if (key === 'auctions') { setFilters({ listingType: 'auction' }); fetchListings() }
            if (key === 'messages') { fetchThreads(); loadUnreadCount(); setActiveThread(null) }
            if (key === 'favorites') { fetchFavorites(); loadFavoriteIds() }
            if (key === 'saved') fetchSavedSearches()
          }}>{label}</button>
        ))}
      </div>

      {/* ════════ DASHBOARD ════════ */}
      {tab === 'dashboard' && dashboard && (
        <div className="mp-dashboard">
          <div className="module-stats">
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeListings || 0}</div><div className="stat-label">{t('marketplace.stats.activeListings')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.soldListings || 0}</div><div className="stat-label">{t('marketplace.stats.itemsSold')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.summary?.pendingApproval || 0}</div><div className="stat-label">{t('marketplace.stats.pendingReview')}</div></div>
            <div className="stat-card"><div className="stat-value">{dashboard.bySpecies?.length || 0}</div><div className="stat-label">{t('marketplace.stats.speciesListed')}</div></div>
          </div>

          {/* Hot Deals Section */}
          {dashboard.hotDeals?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">{t('marketplace.sections.hotDeals')}</h3>
              <div className="mp-grid">
                {dashboard.hotDeals.map((l: any) => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => { setTab('browse'); viewListing(l) }} t={t} />)}
              </div>
            </div>
          )}

          {/* Species Breakdown */}
          {dashboard.bySpecies?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">{t('marketplace.sections.bySpecies')}</h3>
              <div className="mp-species-grid">
                {dashboard.bySpecies.map((s: any) => (
                  <div key={s.species} className="mp-species-card" onClick={() => { setTab('browse'); updateFilter('species', s.species) }}>
                    <div className="mp-species-name">{s.species}</div>
                    <div className="mp-species-count">{s.count} {t('marketplace.units.listings')}</div>
                    <div className="mp-species-price">{t('common.average')}: {formatCurrency(Math.round(s.avg_price || 0))}</div>
                    {s.avg_milk_yield > 0 && <div className="mp-species-milk">🥛 {Number(s.avg_milk_yield).toFixed(1)}{t('marketplace.units.avgLPerDay')}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Listings */}
          {dashboard.recentListings?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">{t('marketplace.sections.latestListings')}</h3>
              <div className="mp-grid">
                {dashboard.recentListings.map((l: any) => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => { setTab('browse'); viewListing(l) }} t={t} />)}
              </div>
            </div>
          )}

          {/* Top Sellers */}
          {dashboard.topSellers?.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">{t('marketplace.sections.topSellers')}</h3>
              <div className="mp-sellers-list">
                {dashboard.topSellers.map((s: any, i: number) => (
                  <div key={i} className="mp-seller-row">
                    <span className="mp-seller-rank">#{i + 1}</span>
                    <span className="mp-seller-name">{s.name}</span>
                    <span className="mp-seller-stat">{s.listings} {t('marketplace.units.listings')}</span>
                    <span className="mp-seller-stat">{s.total_views} {t('marketplace.units.views')}</span>
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
              onPlaceBid={placeBid} onBuyNow={() => reserveListing(selectedListing)} onBack={() => setSelectedListing(null)}
              isAdmin={isAdmin} onToggleHotDeal={(id, v) => handleToggleHotDeal(id, v)} onToggleFeatured={(id, v) => handleToggleFeatured(id, v)}
              userId={user?.id}
              onRequestContact={async () => {
                try {
                  await apiService.createInquiry(selectedListing.id, '')
                  setSuccessMsg(t('marketplace.inquirySent', 'Inquiry sent! The seller will be notified.'))
                  viewListing(selectedListing)
                } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
              }}
              isFavorite={favoriteIds.has(selectedListing.id)}
              onToggleFavorite={user ? () => toggleFavorite(selectedListing.id) : undefined}
              onMessageSeller={user ? () => messageSeller(selectedListing) : undefined}
              onReport={user && selectedListing.seller_id !== user.id ? () => setReportModal({ listingId: selectedListing.id, title: selectedListing.title }) : undefined}
              onBookVetCheck={() => bookVetCheck(selectedListing)}
              transport={mpConfig?.transport?.enabled && mpConfig.transport.url ? mpConfig.transport : undefined}
              t={t}
            />
          ) : (
            <div>
              {/* Advanced Filters */}
              <div className="mp-filter-bar">
                <input className="module-input" value={filters.search || ''} onChange={e => updateFilter('search', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchListings()} placeholder={t('marketplace.searchLivestock')} style={{ flex: 1, minWidth: 200 }} />
                <select className="module-input" value={filters.category || ''} onChange={e => updateFilter('category', e.target.value)} style={{ width: 160 }}>
                  {CATEGORY_KEYS.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                </select>
                <select className="module-input" value={filters.species || ''} onChange={e => updateFilter('species', e.target.value)} style={{ width: 130 }}>
                  <option value="">{t('marketplace.livestock.allSpecies')}</option>
                  {SPECIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="module-input" value={filters.gender || ''} onChange={e => updateFilter('gender', e.target.value)} style={{ width: 120 }}>
                  <option value="">{t('marketplace.livestock.anyGender')}</option>
                  <option value="male">{t('marketplace.genderLabel.male')}</option><option value="female">{t('marketplace.genderLabel.female')}</option>
                </select>
                <select className="module-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 140 }}>
                  <option value="">{t('marketplace.sort.default')}</option>
                  <option value="price_asc">{t('marketplace.sort.priceAsc')}</option>
                  <option value="price_desc">{t('marketplace.sort.priceDesc')}</option>
                  <option value="newest">{t('marketplace.sort.newest')}</option>
                  <option value="milk_yield">{t('marketplace.sort.milkYield')}</option>
                </select>
                <button className="module-btn primary" onClick={fetchListings}>🔍</button>
              </div>

              {/* Proximity filter row */}
              <div className="mp-proximity-bar">
                <button
                  className={`mp-chip ${nearMeActive ? 'active' : ''}`}
                  onClick={handleNearMeToggle}
                >
                  📍 {nearMeActive ? t('marketplace.proximity.nearMeOn', 'Near Me ON') : t('marketplace.proximity.nearMe', 'Near Me')}
                </button>
                {nearMeActive && (
                  <select className="module-input" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} style={{ width: 120 }}>
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="25">25 km</option>
                    <option value="50">50 km</option>
                    <option value="100">100 km</option>
                  </select>
                )}
                {nearMeActive && userLocation && (
                  <span className="mp-location-hint" style={{ fontSize: 12, color: '#6b7280' }}>
                    {t('marketplace.proximity.searching', 'Searching within')} {radiusKm} km
                  </span>
                )}
                {locationError && <span style={{ fontSize: 12, color: '#ef4444' }}>{locationError}</span>}
              </div>

              {/* Quick filter chips */}
              <div className="mp-chip-bar">
                <button className={`mp-chip ${filters.isHotDeal === 'true' ? 'active' : ''}`} onClick={() => updateFilter('isHotDeal', filters.isHotDeal === 'true' ? '' : 'true')}>{t('marketplace.chips.hotDeals')}</button>
                <button className={`mp-chip ${filters.healthCertificate === 'true' ? 'active' : ''}`} onClick={() => updateFilter('healthCertificate', filters.healthCertificate === 'true' ? '' : 'true')}>{t('marketplace.chips.healthCert')}</button>
                <button className={`mp-chip ${filters.vaccinationStatus === 'fully_vaccinated' ? 'active' : ''}`} onClick={() => updateFilter('vaccinationStatus', filters.vaccinationStatus === 'fully_vaccinated' ? '' : 'fully_vaccinated')}>{t('marketplace.chips.vaccinated')}</button>
                <button className={`mp-chip ${filters.pregnancyStatus === 'pregnant' ? 'active' : ''}`} onClick={() => updateFilter('pregnancyStatus', filters.pregnancyStatus === 'pregnant' ? '' : 'pregnant')}>{t('marketplace.chips.pregnant')}</button>
                <button className={`mp-chip ${filters.listingTier === 'premium' ? 'active' : ''}`} onClick={() => updateFilter('listingTier', filters.listingTier === 'premium' ? '' : 'premium')}>{t('marketplace.chips.premium')}</button>
                {Object.keys(filters).length > 0 && <button className="mp-chip clear" onClick={() => { setFilters({}); setSortBy(''); setNearMeActive(false) }}>{t('marketplace.chips.clearAll')}</button>}
              </div>

              {/* Treasure Mount interlink — surfaced when browsing non-animal product categories */}
              {mpConfig?.treasureMount?.enabled && ['feed', 'equipment', 'medicine', 'other'].includes(filters.category || '') && (
                <a className="mp-treasure-banner" href={mpConfig.treasureMount.url} target="_blank" rel="noopener noreferrer">
                  🛒 {t('marketplace.interlink.treasureBanner')} <span className="mp-treasure-cta">{t('marketplace.interlink.visitTreasure')} →</span>
                </a>
              )}
              {/* Save this search */}
              <div className="mp-save-search-bar">
                {showSaveSearch ? (
                  <div className="mp-save-search-form">
                    <input className="module-input" value={saveSearchName} onChange={e => setSaveSearchName(e.target.value)}
                      placeholder={t('marketplace.engagement.searchNamePlaceholder')} maxLength={120} />
                    <button className="module-btn primary small" onClick={saveCurrentSearch}>{t('marketplace.engagement.save')}</button>
                    <button className="module-btn small" onClick={() => setShowSaveSearch(false)}>{t('marketplace.sell.back')}</button>
                  </div>
                ) : (
                  <button className="mp-chip" onClick={() => setShowSaveSearch(true)}>🔔 {t('marketplace.engagement.saveThisSearch')}</button>
                )}
              </div>
              {loading ? <div className="mp-loading">{t('marketplace.loadingListings')}</div> : (
                <div className="mp-grid">
                  {listings.map(l => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => viewListing(l)}
                    isFavorite={favoriteIds.has(l.id)} onToggleFavorite={user ? () => toggleFavorite(l.id) : undefined} t={t} />)}
                  {listings.length === 0 && <p className="mp-empty">{t('marketplace.emptyListings')}</p>}
                </div>
              )}
              {/* Pagination */}
              {totalListings > PAGE_SIZE && (
                <div className="mp-pagination">
                  <button className="module-btn small" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← {t('common.previous', 'Previous')}</button>
                  <span className="mp-page-info">{t('marketplace.pageOf', { current: page + 1, total: Math.ceil(totalListings / PAGE_SIZE) })}</span>
                  <button className="module-btn small" disabled={(page + 1) * PAGE_SIZE >= totalListings} onClick={() => setPage(p => p + 1)}>{t('common.next', 'Next')} →</button>
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

          <div className="mp-sell-card">
            {/* Step 0: Basic Info */}
            {sellStep === 0 && (
              <div className="mp-sell-step">
                <h3>{t('marketplace.sell.basicInfoTitle')}</h3>
                <p className="mp-sell-step-desc">{t('marketplace.sell.basicInfoDesc')}</p>
                <div className="module-form">
                  {/* Auto-populate from existing animal — top of form for visibility */}
                  {userAnimals.length > 0 && (
                    <div className="mp-auto-populate-section">
                      <div className="mp-form-section-title">🐾 {t('marketplace.sell.autoPopulateTitle')}</div>
                      <p className="mp-auto-populate-hint">{t('marketplace.sell.autoPopulateHint')}</p>
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.sell.selectAnimal')}</label>
                        <select className="module-input mp-animal-select" value={selectedAnimalId} onChange={e => handleAnimalSelect(e.target.value)}>
                          <option value="">{t('marketplace.sell.manualEntry')}</option>
                          {userAnimals.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.species}{a.breed ? ` - ${a.breed}` : ''})</option>)}
                        </select>
                      </div>
                      {selectedAnimalId && <div className="mp-auto-populated-badge">✅ {t('marketplace.sell.autoPopulated')}</div>}
                      {selectedAnimalId && (() => {
                        const sel = userAnimals.find((a: any) => a.id === selectedAnimalId)
                        const vcId = sel?.uniqueId || sel?.unique_id
                        return vcId ? (
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6366f1', background: '#eef2ff', borderRadius: 4, padding: '4px 8px', display: 'inline-block', marginTop: 4, cursor: 'pointer' }}
                            title="VetCare Animal ID — click to copy"
                            onClick={() => navigator.clipboard?.writeText(vcId).then(() => {
                              setCopiedId(vcId)
                              setTimeout(() => setCopiedId(prev => (prev === vcId ? null : prev)), 1500)
                            }).catch(() => setError(t('common.copyFailed')))}
                          >
                            {copiedId === vcId ? `✅ ${t('common.copied')}` : `🏷️ ${vcId}`}
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.sell.title')}</label>
                    <input className={`module-input${fieldErrors.title ? ' input-error' : ''}`} value={sellForm.title} onChange={e => { sf('title', e.target.value); if (fieldErrors.title) setFieldErrors(prev => { const n = { ...prev }; delete n.title; return n }) }} placeholder={t('marketplace.sell.titlePlaceholder')} />
                    {fieldErrors.title && <div className="input-error-msg">{fieldErrors.title}</div>}
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.sell.description')}</label>
                    <textarea className="module-input" value={sellForm.description} onChange={e => sf('description', e.target.value)} rows={3} placeholder={t('marketplace.sell.descPlaceholder')} />
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.sell.category')}</label>
                      <select className="module-input" value={sellForm.category} onChange={e => sf('category', e.target.value)}>
                        {CATEGORY_KEYS.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                      </select>
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.sell.listingType')}</label>
                      <select className="module-input" value={sellForm.listingType} onChange={e => sf('listingType', e.target.value)}>
                        <option value="fixed_price">{t('marketplace.listingType.fixedPrice')}</option>
                        {(auctionEnabled || isAdmin) && <option value="auction">{t('marketplace.listingType.auctionType')}{!auctionEnabled ? ' (Admin preview)' : ''}</option>}
                        <option value="wanted">{t('marketplace.listingType.wanted')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.sell.tags')}</label>
                    <input className="module-input" value={sellForm.tags} onChange={e => sf('tags', e.target.value)} placeholder={t('marketplace.sell.tagsPlaceholder')} />
                  </div>
                  {/* Seller Type (Compliance: PCA Rules 2017/2018) */}
                  <div className="mp-form-section">
                    <div className="mp-form-section-title">📋 {t('marketplace.compliance.sellerTypeTitle')}</div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.compliance.sellerType')}</label>
                      <select className="module-input" value={sellForm.sellerType} onChange={e => sf('sellerType', e.target.value)}>
                        <option value="individual">{t('marketplace.compliance.individualOwner')}</option>
                        <option value="registered_breeder">{t('marketplace.compliance.registeredBreeder')}</option>
                      </select>
                    </div>
                    {sellForm.sellerType === 'registered_breeder' && (
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.compliance.registrationNumber')}</label>
                        <input className="module-input" value={sellForm.registrationNumber} onChange={e => sf('registrationNumber', e.target.value)} placeholder={t('marketplace.compliance.registrationPlaceholder')} />
                        <div className="mp-compliance-hint">{t('marketplace.compliance.registrationHint')}</div>
                      </div>
                    )}
                    {sellForm.sellerType === 'individual' && (
                      <div className="mp-compliance-info">{t('marketplace.compliance.individualInfo')}</div>
                    )}
                  </div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn primary" onClick={() => {
                    if (!sellForm.title.trim()) {
                      setError(t('marketplace.sell.titleRequired'))
                      setFieldErrors({ title: t('marketplace.sell.titleRequired') })
                      return
                    }
                    setFieldErrors({})
                    setSellStep(1)
                  }}>{t('marketplace.sell.next')}</button>
                </div>
              </div>
            )}

            {/* Step 1: Animal Details */}
            {sellStep === 1 && (
              <div className="mp-sell-step">
                <h3>{t('marketplace.sell.animalDetailsTitle')}</h3>
                <p className="mp-sell-step-desc">{t('marketplace.sell.animalDetailsDesc')}</p>
                <div className="module-form">
                  {selectedAnimalId && (
                    <div className="mp-auto-populated-badge">✅ {t('marketplace.sell.fieldsAutoFilled')}</div>
                  )}
                  <div className="mp-form-section">
                    <div className="mp-form-section-title">{t('marketplace.sell.identificationSection')}</div>
                    <div className="module-form-row">
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.species')}</label>
                        <select className="module-input" value={sellForm.species}
                          onChange={e => setSellForm(f => ({ ...f, species: e.target.value, breed: '' }))}>
                          <option value="">{t('marketplace.livestock.selectSpecies')}</option>
                          {SPECIES_CATEGORIES.map(cat => (
                            <optgroup key={cat.label} label={cat.label}>
                              {cat.species.map(s => <option key={s} value={s}>{s}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.breed')}</label>
                        {(() => {
                          const breeds = breedsForSpecies(sellForm.species)
                          return breeds.length > 0 ? (
                            <select className="module-input" value={sellForm.breed} onChange={e => sf('breed', e.target.value)} disabled={!sellForm.species}>
                              <option value="">{sellForm.species ? t('marketplace.sell.selectBreed') : t('marketplace.sell.selectSpeciesFirst')}</option>
                              {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          ) : (
                            <input className="module-input" value={sellForm.breed} onChange={e => sf('breed', e.target.value)} placeholder={t('marketplace.sell.breedPlaceholder')} disabled={!sellForm.species} />
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="mp-form-section">
                    <div className="mp-form-section-title">{t('marketplace.sell.physicalSection')}</div>
                    <div className="module-form-row-3">
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.gender')}</label>
                        <select className="module-input" value={sellForm.gender} onChange={e => sf('gender', e.target.value)}>
                          <option value="">{t('marketplace.livestock.selectGender')}</option>
                          <option value="female">{t('marketplace.genderLabel.female')}</option>
                          <option value="male">{t('marketplace.genderLabel.male')}</option>
                        </select>
                      </div>
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.ageMonths')}</label>
                        <input className="module-input" type="number" value={sellForm.animalAgeMonths} onChange={e => sf('animalAgeMonths', e.target.value)} placeholder={t('marketplace.sell.agePlaceholder')} />
                      </div>
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.weightKg')}</label>
                        <input className="module-input" type="number" value={sellForm.animalWeightKg} onChange={e => sf('animalWeightKg', e.target.value)} placeholder={t('marketplace.sell.weightPlaceholder')} />
                      </div>
                    </div>
                  </div>
                  <div className="mp-form-section">
                    <div className="mp-form-section-title">{t('marketplace.sell.productionSection')}</div>
                    <div className="module-form-row">
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.lactation')}</label>
                        <input className="module-input" type="number" value={sellForm.lactationNumber} onChange={e => sf('lactationNumber', e.target.value)} placeholder={t('marketplace.sell.lactationPlaceholder')} />
                      </div>
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.milkYield')}</label>
                        <input className="module-input" type="number" value={sellForm.dailyMilkYield} onChange={e => sf('dailyMilkYield', e.target.value)} placeholder={t('marketplace.sell.milkYieldPlaceholder')} />
                      </div>
                    </div>
                    <div className="module-form-row">
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.livestock.pregnancy')}</label>
                        <select className="module-input" value={sellForm.pregnancyStatus} onChange={e => sf('pregnancyStatus', e.target.value)}>
                          <option value="">{t('marketplace.livestock.select')}</option>
                          <option value="pregnant">{t('marketplace.pregnancyLabel.pregnant')}</option>
                          <option value="not_pregnant">{t('marketplace.pregnancyLabel.notPregnant')}</option>
                          <option value="unknown">{t('marketplace.genderLabel.unknown')}</option>
                        </select>
                      </div>
                      {sellForm.pregnancyStatus === 'pregnant' && (
                        <div className="module-form-group">
                          <label className="module-label">{t('marketplace.livestock.pregnancyMonth')}</label>
                          <input className="module-input" type="number" value={sellForm.pregnancyMonth} onChange={e => sf('pregnancyMonth', e.target.value)} min="1" max="12" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.livestock.quantity')}</label>
                    <input className="module-input" type="number" value={sellForm.quantity} onChange={e => sf('quantity', e.target.value)} placeholder="1" />
                  </div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(0)}>{t('marketplace.sell.back')}</button>
                  <button className="module-btn primary" onClick={() => setSellStep(2)}>{t('marketplace.sell.next')}</button>
                </div>
              </div>
            )}

            {/* Step 2: Health & Certs */}
            {sellStep === 2 && (
              <div className="mp-sell-step">
                <h3>{t('marketplace.sell.healthCertsTitle')}</h3>
                <p className="mp-sell-step-desc">{t('marketplace.sell.healthCertsDesc')}</p>
                <div className="module-form">
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.livestock.vaccination')}</label>
                      <select className="module-input" value={sellForm.vaccinationStatus} onChange={e => sf('vaccinationStatus', e.target.value)}>
                        <option value="unknown">{t('marketplace.vaxLabel.unknown')}</option>
                        <option value="fully_vaccinated">{t('marketplace.vaxLabel.fully')}</option>
                        <option value="partially_vaccinated">{t('marketplace.vaxLabel.partial')}</option>
                        <option value="not_vaccinated">{t('marketplace.vaxLabel.none')}</option>
                      </select>
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.livestock.condition')}</label>
                      <select className="module-input" value={sellForm.condition} onChange={e => sf('condition', e.target.value)}>
                        <option value="new">{t('marketplace.conditionLabel.healthy')}</option>
                        <option value="used">{t('marketplace.conditionLabel.fair')}</option>
                        <option value="refurbished">{t('marketplace.conditionLabel.underTreatment')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="mp-checkbox-label">
                      <input type="checkbox" checked={sellForm.healthCertificate} onChange={e => sf('healthCertificate', e.target.checked)} />
                      {t('marketplace.sell.hasHealthCert')}
                    </label>
                  </div>
                  <div className="module-form-group">
                    <label className="mp-checkbox-label">
                      <input type="checkbox" checked={sellForm.welfareAttestation} onChange={e => sf('welfareAttestation', e.target.checked)} />
                      {t('marketplace.compliance.welfareAttestation')}
                    </label>
                    <div className="mp-compliance-hint">{t('marketplace.compliance.welfareHint')}</div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.livestock.contact')}</label>
                    <input className="module-input" value={sellForm.contactPhone} onChange={e => sf('contactPhone', e.target.value)} placeholder={t('marketplace.sell.contactPlaceholder')} />
                  </div>
                  {/* Image Upload */}
                  <div className="mp-form-section">
                    <div className="mp-form-section-title">📸 {t('marketplace.sell.imagesTitle', 'Listing Images')}</div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.sell.imagesLabel', { count: MAX_LISTING_IMAGES, defaultValue: `Upload up to ${MAX_LISTING_IMAGES} images` })}</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="module-input"
                        onChange={handleImageUpload}
                        disabled={uploadingImages || (sellForm.images?.length || 0) >= MAX_LISTING_IMAGES}
                      />
                      {uploadingImages && <div className="input-error-msg" style={{ color: '#3b82f6' }}>{t('marketplace.sell.uploading', 'Uploading...')}</div>}
                    </div>
                    {sellForm.images?.length > 0 && (
                      <div className="mp-image-preview-row">
                        {sellForm.images.map((url: string, i: number) => (
                          <div key={i} className="mp-image-preview">
                            <img src={url} alt={`Listing ${i + 1}`} />
                            <button className="mp-image-remove" onClick={() => {
                              setSellForm((prev: Record<string, any>) => ({ ...prev, images: prev.images.filter((_: string, idx: number) => idx !== i) }))
                            }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Optional video */}
                    <div className="module-form-group" style={{ marginTop: 10 }}>
                      <label className="module-label">🎥 {t('marketplace.sell.videoLabel')}</label>
                      {sellForm.videoUrl ? (
                        <div className="mp-video-set">
                          <span>✅ {t('marketplace.sell.videoAdded')}</span>
                          <button type="button" className="module-btn small" onClick={() => sf('videoUrl', '')}>{t('marketplace.sell.removeVideo')}</button>
                        </div>
                      ) : (
                        <>
                          <input type="file" accept="video/*" className="module-input" onChange={handleVideoUpload} disabled={uploadingVideo} />
                          {uploadingVideo && <div className="input-error-msg" style={{ color: '#3b82f6' }}>{t('marketplace.sell.uploadingVideo', 'Uploading video...')}</div>}
                          <div className="mp-compliance-hint">{t('marketplace.sell.videoHint')}</div>
                          <div className="mp-compliance-hint">{t('marketplace.sell.videoLimits', { maxSec: MAX_VIDEO_DURATION_SECONDS, maxMb: MAX_VIDEO_SIZE_MB, defaultValue: `Max ${MAX_VIDEO_DURATION_SECONDS} seconds, up to ${MAX_VIDEO_SIZE_MB}MB` })}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(1)}>{t('marketplace.sell.back')}</button>
                  <button className="module-btn primary" onClick={() => setSellStep(3)}>{t('marketplace.sell.next')}</button>
                </div>
              </div>
            )}

            {/* Step 3: Pricing & Location */}
            {sellStep === 3 && (
              <div className="mp-sell-step">
                <h3>{t('marketplace.sell.pricingTitle')}</h3>
                <p className="mp-sell-step-desc">{t('marketplace.sell.pricingDesc')}</p>
                <div className="module-form">
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.reviewLabels.price')} ({settings.currency})</label>
                      <input className="module-input" type="number" value={sellForm.price} onChange={e => sf('price', e.target.value)} placeholder={t('marketplace.sell.pricePlaceholder')} />
                    </div>
                    {sellForm.listingType === 'auction' && (
                      <div className="module-form-group">
                        <label className="module-label">{t('marketplace.sell.reservePrice')}</label>
                        <input className="module-input" type="number" value={sellForm.reservePrice} onChange={e => sf('reservePrice', e.target.value)} placeholder={t('marketplace.sell.reservePricePlaceholder')} />
                      </div>
                    )}
                  </div>
                  {/* Price suggestion from live market data */}
                  {priceHint && (
                    <div className="mp-price-hint">
                      <div className="mp-price-hint-title">💡 {t('marketplace.sell.priceHintTitle')}</div>
                      <div className="mp-price-hint-body">
                        <span>{t('marketplace.sell.priceHintAvg')}: <strong>{formatCurrency(priceHint.avg)}</strong></span>
                        <span>{t('marketplace.prices.min')}–{t('marketplace.prices.max')}: {formatCurrency(priceHint.min)} – {formatCurrency(priceHint.max)}</span>
                        <span className="mp-price-hint-count">{t('marketplace.sell.priceHintBasis', { count: priceHint.count })}</span>
                      </div>
                      {sellForm.price && (() => {
                        const p = +sellForm.price
                        if (p > 0 && priceHint.avg > 0) {
                          const pct = Math.round((p / priceHint.avg) * 100)
                          if (pct < 85) return <div className="mp-price-hint-tag good">💚 {t('marketplace.card.fairDeal')} ({pct}%)</div>
                          if (pct > 115) return <div className="mp-price-hint-tag high">⭐ {t('marketplace.card.premiumPriced')} ({pct}%)</div>
                          return <div className="mp-price-hint-tag ok">✅ {t('marketplace.sell.priceHintFair')}</div>
                        }
                        return null
                      })()}
                    </div>
                  )}
                  {sellForm.listingType === 'auction' && (
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.sell.auctionEndTime')}</label>
                      <input className="module-input" type="datetime-local" value={sellForm.auctionEndTime} onChange={e => sf('auctionEndTime', e.target.value)} />
                    </div>
                  )}
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.sell.location')}</label>
                    <input className="module-input" value={sellForm.location} onChange={e => sf('location', e.target.value)} placeholder={t('marketplace.sell.locationPlaceholder')} />
                    <div className="mp-geo-row">
                      <button type="button" className="module-btn small" onClick={useMyLocationForListing} disabled={geoLocating}>
                        📍 {geoLocating ? t('marketplace.sell.locating') : t('marketplace.sell.useMyLocation')}
                      </button>
                      {sellForm.latitude && sellForm.longitude && (
                        <span className="mp-geo-set">✅ {t('marketplace.sell.locationSet')}</span>
                      )}
                    </div>
                    <div className="mp-compliance-hint">{t('marketplace.sell.locationGeoHint')}</div>
                  </div>
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(2)}>{t('marketplace.sell.back')}</button>
                  <button className="module-btn primary" onClick={() => setSellStep(4)}>{t('marketplace.sell.review')}</button>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {sellStep === 4 && (
              <div className="mp-sell-step">
                <h3>{t('marketplace.sell.reviewTitle')}</h3>
                <p className="mp-sell-step-desc">{t('marketplace.sell.reviewDesc')}</p>
                <div className="mp-review-grid">
                  <ReviewItem label={t('marketplace.sell.title').replace(' *', '')} value={sellForm.title} />
                  <ReviewItem label={t('marketplace.sell.category')} value={sellForm.category} />
                  <ReviewItem label={t('marketplace.reviewLabels.type')} value={sellForm.listingType} />
                  <ReviewItem label={t('marketplace.livestock.species')} value={sellForm.species} />
                  <ReviewItem label={t('marketplace.livestock.breed')} value={sellForm.breed} />
                  <ReviewItem label={t('marketplace.livestock.gender')} value={sellForm.gender ? GENDER_LABELS[sellForm.gender] : '—'} />
                  <ReviewItem label={t('marketplace.livestock.age')} value={sellForm.animalAgeMonths ? `${sellForm.animalAgeMonths} ${t('marketplace.units.months')}` : '—'} />
                  <ReviewItem label={t('marketplace.livestock.weightKg')} value={sellForm.animalWeightKg ? `${sellForm.animalWeightKg} ${t('marketplace.units.kg')}` : '—'} />
                  <ReviewItem label={t('marketplace.reviewLabels.milkYield')} value={sellForm.dailyMilkYield ? `${sellForm.dailyMilkYield} ${t('marketplace.units.lPerDay')}` : '—'} />
                  <ReviewItem label={t('marketplace.livestock.pregnancy')} value={sellForm.pregnancyStatus || '—'} />
                  <ReviewItem label={t('marketplace.livestock.vaccination')} value={VAX_LABELS[sellForm.vaccinationStatus] || '—'} />
                  <ReviewItem label={t('marketplace.reviewLabels.healthCert')} value={sellForm.healthCertificate ? t('marketplace.reviewLabels.yes') : t('marketplace.reviewLabels.no')} />
                  <ReviewItem label={t('marketplace.reviewLabels.price')} value={sellForm.price ? `${settings.currency} ${sellForm.price}` : t('marketplace.reviewLabels.contactForPrice')} />
                  <ReviewItem label={t('marketplace.sell.location')} value={sellForm.location || '—'} />
                  <ReviewItem label={t('marketplace.livestock.contact')} value={sellForm.contactPhone || '—'} />
                  <ReviewItem label={t('marketplace.compliance.sellerType')} value={sellForm.sellerType === 'registered_breeder' ? t('marketplace.compliance.registeredBreeder') : t('marketplace.compliance.individualOwner')} />
                  {sellForm.sellerType === 'registered_breeder' && <ReviewItem label={t('marketplace.compliance.registrationNumber')} value={sellForm.registrationNumber || '—'} />}
                </div>
                {sellForm.description && (
                  <div className="mp-review-desc">
                    <strong>{t('marketplace.sell.description')}:</strong>
                    <p>{sellForm.description}</p>
                  </div>
                )}
                {/* Legal Compliance & T&C */}
                <div className="mp-compliance-section">
                  <h4 className="mp-compliance-title">⚖️ {t('marketplace.compliance.legalTitle')}</h4>
                  <div className="mp-compliance-disclaimer">{t('marketplace.compliance.legalDisclaimer')}</div>
                  <div className="mp-compliance-checkboxes">
                    <label className="mp-checkbox-label">
                      <input type="checkbox" checked={sellForm.welfareAttestation} onChange={e => sf('welfareAttestation', e.target.checked)} />
                      {t('marketplace.compliance.welfareAttestation')}
                    </label>
                    <label className="mp-checkbox-label">
                      <input type="checkbox" checked={sellForm.termsAccepted} onChange={e => sf('termsAccepted', e.target.checked)} />
                      {t('marketplace.compliance.termsAccept')}
                    </label>
                  </div>
                  {sellForm.sellerType === 'registered_breeder' && (
                    <div className="mp-compliance-breeder-note">{t('marketplace.compliance.breederNote')}</div>
                  )}
                </div>
                <div className="mp-step-actions">
                  <button className="module-btn" onClick={() => setSellStep(3)}>{t('marketplace.sell.back')}</button>
                  <button className="module-btn primary" disabled={!sellForm.termsAccepted || !sellForm.welfareAttestation} onClick={createListing}>{t('marketplace.sell.publish')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ ORDERS ════════ */}
      {tab === 'orders' && (
        <div>
          <div className="mp-order-toggle">
            <button className={`module-btn ${orderRole === 'buyer' ? 'primary' : ''}`} onClick={() => { setOrderRole('buyer'); fetchOrders('buyer'); fetchInquiries('buyer') }}>{t('marketplace.orders.asBuyer')}</button>
            <button className={`module-btn ${orderRole === 'seller' ? 'primary' : ''}`} onClick={() => { setOrderRole('seller'); fetchOrders('seller'); fetchInquiries('seller') }}>{t('marketplace.orders.asSeller')}</button>
          </div>
          {inquiries.length > 0 && (
            <div className="mp-section">
              <h3 className="mp-section-title">💌 {t('marketplace.orders.inquiriesTitle')}</h3>
              <div className="data-table-container">
                <table className="module-table">
                  <thead><tr><th>{t('marketplace.orders.item')}</th><th>{t('marketplace.orders.message')}</th><th>{t('marketplace.orders.date')}</th><th>{t('marketplace.orders.status')}</th></tr></thead>
                  <tbody>
                    {inquiries.map((inq: any) => (
                      <tr key={inq.id}>
                        <td>{inq.listingTitle || inq.listing_title || '—'}</td>
                        <td>{inq.message || '—'}</td>
                        <td>{inq.created_at ? new Date(inq.created_at).toLocaleDateString() : '—'}</td>
                        <td><span className={`module-badge ${inq.status === 'responded' ? 'success' : ''}`}>{inq.status || 'pending'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Free-classifieds note: settlement is between the parties, off-platform */}
          <div className="mp-deal-free-note mp-deal-tab-note">💡 {t('marketplace.deal.tabNote')}</div>
          <div className="data-table-container">
            <table className="module-table">
              <thead><tr><th>{t('marketplace.orders.item')}</th><th>{t('marketplace.livestock.species')}</th><th>{orderRole === 'buyer' ? t('marketplace.detail.seller') : t('marketplace.orders.asBuyer').replace('🛒 ', '')}</th><th>{t('marketplace.orders.qty')}</th><th>{t('marketplace.orders.total')}</th><th>{t('marketplace.orders.status')}</th><th>{t('marketplace.orders.date')}</th><th>{t('marketplace.deal.actionsCol')}</th></tr></thead>
              <tbody>
                {orders.map(o => {
                  const myConfirm = orderRole === 'buyer' ? g(o, 'buyerConfirmedAt', 'buyer_confirmed_at') : g(o, 'sellerConfirmedAt', 'seller_confirmed_at')
                  const otherConfirm = orderRole === 'buyer' ? g(o, 'sellerConfirmedAt', 'seller_confirmed_at') : g(o, 'buyerConfirmedAt', 'buyer_confirmed_at')
                  const reservedUntil = g(o, 'reservedUntil', 'reserved_until')
                  const statusKey = `marketplace.deal.status.${o.status}`
                  const statusLabel = t(statusKey) === statusKey ? o.status : t(statusKey)
                  return (
                    <tr key={o.id}>
                      <td>{g(o, 'listingTitle', 'listing_title') || '—'}</td>
                      <td>{o.species || '—'}</td>
                      <td>{orderRole === 'buyer' ? g(o, 'sellerName', 'seller_name') : g(o, 'buyerName', 'buyer_name')}</td>
                      <td>{o.quantity}</td>
                      <td className="mp-price-highlight">{formatCurrency(g(o, 'totalPrice', 'total_price') || 0)}</td>
                      <td>
                        <span className={`module-badge ${o.status === 'completed' || o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : ''}`}>{statusLabel}</span>
                        {o.status === 'reserved' && reservedUntil && (
                          <div className="mp-deal-until">{t('marketplace.deal.reservedUntil')}: {new Date(reservedUntil).toLocaleDateString()}</div>
                        )}
                      </td>
                      <td>{(g(o, 'createdAt', 'created_at')) ? new Date(g(o, 'createdAt', 'created_at')).toLocaleDateString() : '—'}</td>
                      <td>
                        {o.status === 'reserved' ? (
                          <div className="mp-deal-actions">
                            {myConfirm ? (
                              <span className="mp-deal-waiting">✓ {t('marketplace.deal.waitingOther')}</span>
                            ) : (
                              <>
                                {orderRole === 'buyer' && (
                                  <select className="module-input mp-deal-pm" value={dealPaymentMethod[o.id] || ''} onChange={e => setDealPaymentMethod(prev => ({ ...prev, [o.id]: e.target.value }))}>
                                    <option value="">{t('marketplace.deal.paymentMethod')}</option>
                                    <option value="cash">{t('marketplace.deal.pm.cash')}</option>
                                    <option value="upi">{t('marketplace.deal.pm.upi')}</option>
                                    <option value="bank_transfer">{t('marketplace.deal.pm.bankTransfer')}</option>
                                    <option value="other">{t('marketplace.deal.pm.other')}</option>
                                  </select>
                                )}
                                <button className="module-btn small primary" onClick={() => confirmDeal(o.id)}>
                                  ✅ {orderRole === 'buyer' ? t('marketplace.deal.confirmReceipt') : t('marketplace.deal.confirmPayment')}
                                </button>
                              </>
                            )}
                            {otherConfirm && !myConfirm && <span className="mp-deal-other-done">👍 {t('marketplace.deal.otherConfirmed')}</span>}
                            <button className="module-btn small" onClick={() => cancelDeal(o.id)}>✖ {t('marketplace.deal.cancelDeal')}</button>
                          </div>
                        ) : o.status === 'completed' ? (
                          <span className="mp-deal-done">🎉 {t('marketplace.deal.dealDone')}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <p className="mp-empty">{t('marketplace.orders.noOrders')}</p>}
        </div>
      )}

      {/* ════════ MESSAGES ════════ */}
      {tab === 'messages' && (
        <div className="mp-messages-layout">
          <div className={`mp-thread-list ${activeThread ? 'has-active' : ''}`}>
            <h3 className="mp-section-title">💬 {t('marketplace.tabs.messages')}</h3>
            {threads.length === 0 && <p className="mp-empty">{t('marketplace.engagement.noMessages')}</p>}
            {threads.map(th => (
              <div key={th.id} className={`mp-thread-item ${activeThread?.id === th.id ? 'active' : ''}`} onClick={() => openThread(th)}>
                <div className="mp-thread-item-top">
                  <span className="mp-thread-title">{th.listing_title || t('marketplace.engagement.listing')}</span>
                  {(th.my_unread || 0) > 0 && <span className="mp-thread-unread">{th.my_unread}</span>}
                </div>
                <div className="mp-thread-sub">
                  <span className="mp-thread-role">{th.my_role === 'buyer' ? `🛒 ${th.seller_name || ''}` : `🏠 ${th.buyer_name || ''}`}</span>
                  {th.last_message_at && <span className="mp-thread-time">{new Date(th.last_message_at).toLocaleDateString()}</span>}
                </div>
                {th.last_message && <div className="mp-thread-preview">{th.last_message}</div>}
              </div>
            ))}
          </div>
          <div className={`mp-chat-panel ${activeThread ? 'open' : ''}`}>
            {activeThread ? (
              <>
                <div className="mp-chat-header">
                  <button className="mp-chat-back" onClick={() => setActiveThread(null)}>←</button>
                  <div>
                    <div className="mp-chat-title">{activeThread.listing_title || t('marketplace.engagement.listing')}</div>
                    <div className="mp-chat-sub">{activeThread.my_role === 'buyer' ? activeThread.seller_name : activeThread.buyer_name}</div>
                  </div>
                </div>
                <div className="mp-chat-safety">🔒 {t('marketplace.engagement.chatSafety')}</div>
                <div className="mp-chat-messages">
                  {threadMessages.length === 0 && <p className="mp-empty">{t('marketplace.engagement.startConversation')}</p>}
                  {threadMessages.map(m => (
                    <div key={m.id} className={`mp-chat-bubble ${m.sender_id === user?.id ? 'mine' : 'theirs'}`}>
                      <div className="mp-chat-body">{m.body}</div>
                      <div className="mp-chat-meta">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))}
                </div>
                <div className="mp-chat-input">
                  <textarea className="module-input" value={messageDraft} onChange={e => setMessageDraft(e.target.value)}
                    placeholder={t('marketplace.engagement.typeMessage')} rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} />
                  <button className="module-btn primary" onClick={sendMessage} disabled={!messageDraft.trim()}>{t('marketplace.engagement.send')}</button>
                </div>
              </>
            ) : (
              <div className="mp-chat-empty">{t('marketplace.engagement.selectConversation')}</div>
            )}
          </div>
        </div>
      )}

      {/* ════════ FAVORITES ════════ */}
      {tab === 'favorites' && (
        <div>
          <h3 className="mp-section-title">❤️ {t('marketplace.tabs.favorites')}</h3>
          {favorites.length === 0 ? (
            <p className="mp-empty">{t('marketplace.engagement.noFavorites')}</p>
          ) : (
            <div className="mp-grid">
              {favorites.map(l => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency}
                onView={() => { setTab('browse'); viewListing(l) }}
                isFavorite={favoriteIds.has(l.id)} onToggleFavorite={() => toggleFavorite(l.id)} t={t} />)}
            </div>
          )}
        </div>
      )}

      {/* ════════ SAVED SEARCHES ════════ */}
      {tab === 'saved' && (
        <div>
          <h3 className="mp-section-title">🔔 {t('marketplace.tabs.saved')}</h3>
          <p className="mp-sell-step-desc">{t('marketplace.engagement.savedSearchesDesc')}</p>
          {savedSearches.length === 0 ? (
            <p className="mp-empty">{t('marketplace.engagement.noSavedSearches')}</p>
          ) : (
            <div className="mp-saved-list">
              {savedSearches.map(s => {
                const chips = Object.entries(s.filters || {}).filter(([, v]) => v !== '' && v != null)
                return (
                  <div key={s.id} className="mp-saved-card">
                    <div className="mp-saved-main">
                      <div className="mp-saved-name">{s.name}</div>
                      <div className="mp-saved-chips">
                        {chips.length === 0 ? <span className="mp-saved-chip">{t('marketplace.engagement.allListings')}</span>
                          : chips.map(([k, v]) => <span key={k} className="mp-saved-chip">{k}: {String(v)}</span>)}
                      </div>
                    </div>
                    <div className="mp-saved-actions">
                      <button className="module-btn small primary" onClick={() => applySavedSearch(s)}>{t('marketplace.engagement.applySearch')}</button>
                      <button className={`module-btn small ${s.alertsEnabled ? '' : 'muted'}`} onClick={() => toggleSearchAlerts(s)}
                        title={s.alertsEnabled ? t('marketplace.engagement.alertsOn') : t('marketplace.engagement.alertsOff')}>
                        {s.alertsEnabled ? '🔔' : '🔕'}
                      </button>
                      <button className="module-btn small" onClick={() => deleteSavedSearch(s.id)}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════ MARKET PRICES ════════ */}
      {tab === 'prices' && (
        <div className="mp-section">
          <h3 className="mp-section-title">{t('marketplace.sections.marketPriceIntelligence')}</h3>
          <p className="mp-sell-step-desc">{t('marketplace.prices.subtitle')}</p>
          {marketPrices.length > 0 ? (
            <div className="data-table-container">
              <table className="module-table">
                <thead><tr><th>{t('marketplace.livestock.species')}</th><th>{t('marketplace.livestock.breed')}</th><th>{t('marketplace.prices.listings')}</th><th>{t('marketplace.prices.avgPrice')}</th><th>{t('marketplace.prices.min')}</th><th>{t('marketplace.prices.max')}</th><th>{t('marketplace.prices.avgMilkPerDay')}</th><th>{t('marketplace.prices.avgWeight')}</th></tr></thead>
                <tbody>
                  {marketPrices.map((mp, i) => (
                    <tr key={i}>
                      <td><strong>{mp.species}</strong></td>
                      <td>{mp.breed || '—'}</td>
                      <td>{mp.total_listings}</td>
                      <td className="mp-price-highlight">{formatCurrency(Math.round(mp.avg_price || 0))}</td>
                      <td>{formatCurrency(Math.round(mp.min_price || 0))}</td>
                      <td>{formatCurrency(Math.round(mp.max_price || 0))}</td>
                      <td>{mp.avg_milk_yield ? `${Number(mp.avg_milk_yield).toFixed(1)}L` : '—'}</td>
                      <td>{mp.avg_weight ? `${Number(mp.avg_weight).toFixed(0)} ${t('marketplace.units.kg')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mp-empty">{t('marketplace.prices.noData')}</p>}
        </div>
      )}

      {/* ════════ ADMIN PANEL ════════ */}
      {tab === 'admin' && isAdmin && (
        <div>
          {/* Admin Sub-tabs */}
          <div className="mp-admin-subtabs">
            {(['listings', 'reports', 'settings', 'plans', 'revenue'] as const).map(st => (
              <button key={st} className={`mp-admin-subtab ${adminSubTab === st ? 'active' : ''}`}
                onClick={() => { setAdminSubTab(st); if (st === 'reports') fetchAdminReports() }}>
                {st === 'listings' && '📋'} {st === 'reports' && '🚩'} {st === 'settings' && '⚙️'} {st === 'plans' && '💎'} {st === 'revenue' && '📊'}
                {' '}{t(`marketplace.monetization.subtabs.${st}`)}
              </button>
            ))}
          </div>

          {/* ── Listings Sub-tab ── */}
          {adminSubTab === 'listings' && (
            <div>
              {adminStats && (
                <div className="module-stats">
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.total_listings || 0}</div><div className="stat-label">{t('marketplace.stats.totalListings')}</div></div>
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.active_listings || 0}</div><div className="stat-label">{t('marketplace.stats.active')}</div></div>
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.sold_listings || 0}</div><div className="stat-label">{t('marketplace.stats.sold')}</div></div>
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.pending_review || 0}</div><div className="stat-label">{t('marketplace.stats.pendingReview')}</div></div>
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.hot_deals || 0}</div><div className="stat-label">{t('marketplace.stats.hotDeals')}</div></div>
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.auctions || 0}</div><div className="stat-label">{t('marketplace.stats.auctions')}</div></div>
                  <div className="stat-card"><div className="stat-value">{adminStats.overview?.total_views || 0}</div><div className="stat-label">{t('marketplace.stats.totalViews')}</div></div>
                </div>
              )}
              {adminStats?.bySpecies && adminStats.bySpecies.length > 0 && (
                <div className="mp-section">
                  <h3 className="mp-section-title">{t('marketplace.sections.speciesAnalytics')}</h3>
                  <table className="module-table">
                    <thead><tr><th>{t('marketplace.livestock.species')}</th><th>{t('marketplace.admin.count')}</th><th>{t('marketplace.prices.avgPrice')}</th><th>{t('marketplace.admin.avgMilkYield')}</th><th>{t('marketplace.prices.avgWeight')}</th></tr></thead>
                    <tbody>{adminStats.bySpecies.map((s, i) => (
                      <tr key={i}><td><strong>{s.species}</strong></td><td>{s.count}</td>
                        <td>{formatCurrency(Math.round(s.avg_price || 0))}</td>
                        <td>{s.avg_milk_yield ? `${Number(s.avg_milk_yield).toFixed(1)}L` : '—'}</td>
                        <td>{s.avg_weight ? `${Number(s.avg_weight).toFixed(0)}${t('marketplace.units.kg')}` : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {adminStats?.priceDistribution && (
                <div className="mp-section">
                  <h3 className="mp-section-title">{t('marketplace.sections.priceDistribution')}</h3>
                  <div className="module-stats">
                    <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.under_10k}</div><div className="stat-label">{t('marketplace.admin.priceUnder10k')}</div></div>
                    <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.range_10k_50k}</div><div className="stat-label">{t('marketplace.admin.price10k50k')}</div></div>
                    <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.range_50k_100k}</div><div className="stat-label">{t('marketplace.admin.price50k1l')}</div></div>
                    <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.above_100k}</div><div className="stat-label">{t('marketplace.admin.priceAbove1l')}</div></div>
                  </div>
                </div>
              )}
              <div className="mp-section">
                <div className="mp-admin-header">
                  <h3 className="mp-section-title">{t('marketplace.sections.listingManagement')}</h3>
                  <select className="module-input" value={adminFilter} onChange={e => { setAdminFilter(e.target.value); fetchAdminData() }}>
                    <option value="">{t('marketplace.admin.allListings')}</option>
                    <option value="true">{t('marketplace.admin.approved')}</option>
                    <option value="false">{t('marketplace.admin.rejectedPending')}</option>
                  </select>
                </div>
                <div className="data-table-container">
                  <table className="module-table">
                    <thead><tr><th>{t('marketplace.admin.titleCol')}</th><th>{t('marketplace.admin.sellerCol')}</th><th>{t('marketplace.livestock.species')}</th><th>{t('marketplace.admin.priceCol')}</th><th>{t('marketplace.orders.status')}</th><th>{t('marketplace.admin.approvedCol')}</th><th>{t('marketplace.admin.actionsCol')}</th></tr></thead>
                    <tbody>
                      {adminListings.map(l => (
                        <tr key={l.id}>
                          <td>
                            <div className="mp-title-cell">
                              {g(l, 'isHotDeal', 'is_hot_deal') && <span title="Hot Deal">🔥</span>}
                              {l.featured && <span title="Featured">⭐</span>}
                              <span className="mp-title-link" onClick={() => { setTab('browse'); viewListing(l) }}>{l.title}</span>
                            </div>
                          </td>
                          <td>{g(l, 'sellerName', 'seller_name') || '—'}</td>
                          <td>{l.species || '—'}</td>
                          <td>{l.price ? formatCurrency(l.price) : '—'}</td>
                          <td><span className={`module-badge ${l.status === 'active' ? 'success' : l.status === 'rejected' ? 'error' : ''}`}>{l.status}</span></td>
                          <td>{g(l, 'adminApproved', 'admin_approved') === true ? '✅' : g(l, 'adminApproved', 'admin_approved') === false ? '❌' : '⏳'}</td>
                          <td>
                            <div className="mp-action-cluster">
                              {g(l, 'adminApproved', 'admin_approved') !== true && <button className="module-btn small" onClick={() => handleAdminApprove(l.id)} title="Approve">✅</button>}
                              <button className="module-btn small" onClick={() => handleToggleHotDeal(l.id, g(l, 'isHotDeal', 'is_hot_deal') || false)} title="Toggle Hot Deal">{g(l, 'isHotDeal', 'is_hot_deal') ? '🔥' : '💤'}</button>
                              <button className="module-btn small" onClick={() => handleToggleFeatured(l.id, l.featured || false)} title="Toggle Featured">{l.featured ? '⭐' : '☆'}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {adminListings.length === 0 && <p className="mp-empty">{t('marketplace.admin.noListings')}</p>}
              </div>
              <div className="mp-section">
                <h3 className="mp-section-title">{t('marketplace.sections.rejectListing')}</h3>
                <div className="mp-reject-row">
                  <input className="module-input" value={adminRejectReason} onChange={e => setAdminRejectReason(e.target.value)} placeholder={t('marketplace.admin.rejectionReason')} />
                  <select className="module-input" id="rejectListingSelect">
                    <option value="">{t('marketplace.admin.selectToReject')}</option>
                    {adminListings.filter(l => g(l, 'adminApproved', 'admin_approved') !== false).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                  <button className="module-btn primary" onClick={() => {
                    const sel = (document.getElementById('rejectListingSelect') as HTMLSelectElement)?.value
                    if (sel) handleAdminReject(sel)
                  }}>{t('marketplace.admin.reject')}</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Reports Sub-tab ── */}
          {adminSubTab === 'reports' && (
            <div className="mp-section">
              <div className="mp-admin-header">
                <h3 className="mp-section-title">🚩 {t('marketplace.report.adminTitle')}</h3>
                <select className="module-input" value={adminReportFilter} onChange={e => { setAdminReportFilter(e.target.value); fetchAdminReports(e.target.value) }}>
                  <option value="open">{t('marketplace.report.filterOpen')}</option>
                  <option value="reviewing">{t('marketplace.report.status.reviewing')}</option>
                  <option value="actioned">{t('marketplace.report.status.actioned')}</option>
                  <option value="dismissed">{t('marketplace.report.status.dismissed')}</option>
                  <option value="">{t('marketplace.admin.allListings')}</option>
                </select>
              </div>
              {adminReports.length === 0 ? (
                <p className="mp-empty">{t('marketplace.report.noReports')}</p>
              ) : (
                <div className="mp-reports-list">
                  {adminReports.map(r => (
                    <div key={r.id} className="mp-report-card">
                      <div className="mp-report-head">
                        <span className="mp-title-link" onClick={() => { setTab('browse'); viewListing({ id: r.listing_id, title: r.listing_title } as MarketplaceListing) }}>{r.listing_title || '—'}</span>
                        <span className={`module-badge ${r.status === 'open' ? 'error' : r.status === 'actioned' ? 'success' : ''}`}>{t(`marketplace.report.status.${r.status}`)}</span>
                      </div>
                      <div className="mp-report-meta">
                        <span className="mp-report-reason">{t(`marketplace.report.reasons.${r.reason}`)}</span>
                        <span>· {t('marketplace.report.by')} {r.reporter_name}</span>
                        <span>· {new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.details && <div className="mp-report-details">{r.details}</div>}
                      {['open', 'reviewing'].includes(r.status) && (
                        <div className="mp-report-actions">
                          <input className="module-input" placeholder={t('marketplace.report.resolutionPlaceholder')}
                            value={adminReportResolution[r.id] || ''} onChange={e => setAdminReportResolution(prev => ({ ...prev, [r.id]: e.target.value }))} />
                          {r.status === 'open' && <button className="module-btn small" onClick={() => resolveReport(r.id, 'reviewing')}>{t('marketplace.report.markReviewing')}</button>}
                          <button className="module-btn small primary" onClick={() => resolveReport(r.id, 'actioned')}>{t('marketplace.report.action')}</button>
                          <button className="module-btn small" onClick={() => resolveReport(r.id, 'dismissed')}>{t('marketplace.report.dismiss')}</button>
                        </div>
                      )}
                      {r.resolution && <div className="mp-report-resolution">💬 {r.resolution}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Monetization Settings Sub-tab ── */}
          {adminSubTab === 'settings' && (
            <div>
              {/* Auction Feature Toggle — prominent card */}
              <div className="mp-section">
                <h3 className="mp-section-title">🔨 {t('marketplace.admin.auctionFeature', 'Auction Feature')}</h3>
                <div className={`mp-setting-card ${auctionEnabled ? 'enabled' : ''}`} style={{ maxWidth: 480 }}>
                  <div className="mp-setting-header">
                    <span className="mp-setting-icon">🔨</span>
                    <div className="mp-setting-info">
                      <h4>{t('marketplace.admin.auctionTitle', 'Live Auction Bidding')}</h4>
                      <p style={{ fontSize: 12, color: '#6b7280' }}>
                        {auctionEnabled
                          ? t('marketplace.admin.auctionEnabledDesc', 'Auctions are LIVE. Users can create auction listings and place bids.')
                          : t('marketplace.admin.auctionDisabledDesc', 'Auctions are DISABLED platform-wide. Legal review pending. Enable only after legal clearance.')}
                      </p>
                    </div>
                    <label className="mp-toggle-switch">
                      <input type="checkbox" checked={auctionEnabled} onChange={handleAdminAuctionToggle} />
                      <span className="mp-toggle-slider"></span>
                    </label>
                  </div>
                  <div className="mp-setting-status">
                    <span className={`module-badge ${auctionEnabled ? 'success' : 'error'}`}>
                      {auctionEnabled ? t('marketplace.monetization.active') : t('marketplace.monetization.inactive')}
                    </span>
                    <span className="mp-setting-category" style={{ fontSize: 11, color: '#6b7280' }}>
                      {t('marketplace.admin.auctionLegalNote', 'Consult legal before enabling in India')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mp-section">
                <h3 className="mp-section-title">{t('marketplace.monetization.featureToggles')}</h3>
                <p className="mp-monetization-note">{t('marketplace.monetization.allFreeNote')}</p>
                <div className="mp-settings-grid">
                  {monetizationSettings.filter((s: any) => s.settingKey !== 'auction_enabled').map(s => {
                    const SETTING_ICONS: Record<string, string> = {
                      listing_fee: '📝', listing_boost: '🚀', subscription_plans: '💎',
                      inquiry_fee: '📩', featured_seller: '⭐', transaction_fee: '💰',
                      premium_analytics: '📊', priority_placement: '📌',
                    }
                    return (
                      <div key={s.settingKey} className={`mp-setting-card ${s.isEnabled ? 'enabled' : ''}`}>
                        <div className="mp-setting-header">
                          <span className="mp-setting-icon">{SETTING_ICONS[s.settingKey] || '⚙️'}</span>
                          <div className="mp-setting-info">
                            <h4>{t(`marketplace.monetization.settings.${s.settingKey}.title`)}</h4>
                            <p>{t(`marketplace.monetization.settings.${s.settingKey}.desc`)}</p>
                          </div>
                          <label className="mp-toggle-switch">
                            <input type="checkbox" checked={s.isEnabled} onChange={() => handleToggleSetting(s.settingKey, s.isEnabled)} />
                            <span className="mp-toggle-slider"></span>
                          </label>
                        </div>
                        <div className="mp-setting-status">
                          <span className={`module-badge ${s.isEnabled ? 'success' : ''}`}>
                            {s.isEnabled ? t('marketplace.monetization.active') : t('marketplace.monetization.inactive')}
                          </span>
                          <span className="mp-setting-category">{s.category}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Plans Sub-tab ── */}
          {adminSubTab === 'plans' && (
            <div>
              <div className="mp-section">
                <h3 className="mp-section-title">{t('marketplace.monetization.managePlans')}</h3>
                <div className="mp-plans-grid">
                  {monetizationPlans.map(p => (
                    <div key={p.id} className={`mp-plan-card ${p.is_active ? 'active' : 'inactive'}`}>
                      <div className="mp-plan-header">
                        <h4>{p.name}</h4>
                        <span className={`module-badge ${p.is_active ? 'success' : ''}`}>
                          {p.is_active ? t('marketplace.monetization.active') : t('marketplace.monetization.inactive')}
                        </span>
                      </div>
                      <p className="mp-plan-desc">{p.description}</p>
                      <div className="mp-plan-price">
                        {p.price > 0 ? formatCurrency(p.price) : t('marketplace.monetization.free')}
                        {p.duration_days > 0 && <span className="mp-plan-duration">/ {p.duration_days} {t('marketplace.monetization.days')}</span>}
                      </div>
                      <div className="mp-plan-features">
                        <div className="mp-plan-feature">📋 {p.max_listings === -1 ? t('marketplace.monetization.unlimited') : p.max_listings || 0} {t('marketplace.monetization.listings')}</div>
                        <div className="mp-plan-feature">🚀 {p.max_boosts_per_month || 0} {t('marketplace.monetization.boostsMonth')}</div>
                        {p.priority_support && <div className="mp-plan-feature">🛡️ {t('marketplace.monetization.prioritySupport')}</div>}
                        {p.analytics_access && <div className="mp-plan-feature">📊 {t('marketplace.monetization.analyticsAccess')}</div>}
                      </div>
                      <div className="mp-plan-actions">
                        <button className="module-btn small" onClick={() => handleTogglePlanActive(p)}>
                          {p.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button className="module-btn small" onClick={() => {
                          setEditingPlan(p)
                          setPlanForm({
                            name: p.name, description: p.description || '', price: String(p.price),
                            durationDays: String(p.duration_days), maxListings: p.max_listings ? String(p.max_listings) : '',
                            maxBoostsPerMonth: String(p.max_boosts_per_month || 0), isActive: p.is_active, sortOrder: String(p.sort_order || 0),
                          })
                        }}>✏️</button>
                        <button className="module-btn small" onClick={() => handleDeletePlan(p.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Plan Form */}
              <div className="mp-section">
                <h3 className="mp-section-title">{editingPlan ? t('marketplace.monetization.editPlan') : t('marketplace.monetization.createPlan')}</h3>
                <div className="module-form">
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.monetization.planName')}</label>
                      <input className="module-input" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.monetization.planPrice')}</label>
                      <input className="module-input" type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                  </div>
                  <div className="module-form-row-3">
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.monetization.durationDays')}</label>
                      <input className="module-input" type="number" value={planForm.durationDays} onChange={e => setPlanForm(f => ({ ...f, durationDays: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.monetization.maxListings')}</label>
                      <input className="module-input" type="number" value={planForm.maxListings} onChange={e => setPlanForm(f => ({ ...f, maxListings: e.target.value }))} placeholder="-1 = unlimited" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('marketplace.monetization.boostsMonth')}</label>
                      <input className="module-input" type="number" value={planForm.maxBoostsPerMonth} onChange={e => setPlanForm(f => ({ ...f, maxBoostsPerMonth: e.target.value }))} />
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.monetization.planDescription')}</label>
                    <textarea className="module-input" rows={2} value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="mp-plan-form-actions">
                    <button className="module-btn primary" onClick={handleSavePlan}>{editingPlan ? t('marketplace.monetization.updatePlan') : t('marketplace.monetization.createPlan')}</button>
                    {editingPlan && <button className="module-btn" onClick={() => {
                      setEditingPlan(null)
                      setPlanForm({ name: '', description: '', price: '', durationDays: '30', maxListings: '', maxBoostsPerMonth: '0', isActive: false, sortOrder: '0' })
                    }}>{t('marketplace.monetization.cancel')}</button>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Revenue Dashboard Sub-tab ── */}
          {adminSubTab === 'revenue' && (
            <div>
              <div className="module-stats">
                <div className="stat-card"><div className="stat-value">{formatCurrency(monetizationDashboard?.totalRevenue?.total || 0)}</div><div className="stat-label">{t('marketplace.monetization.totalRevenue')}</div></div>
                <div className="stat-card"><div className="stat-value">{monetizationDashboard?.totalRevenue?.count || 0}</div><div className="stat-label">{t('marketplace.monetization.totalTransactions')}</div></div>
                <div className="stat-card"><div className="stat-value">{monetizationDashboard?.inquiryStats?.total || 0}</div><div className="stat-label">{t('marketplace.monetization.totalInquiries')}</div></div>
                <div className="stat-card"><div className="stat-value">{formatCurrency(monetizationDashboard?.inquiryStats?.revenue || 0)}</div><div className="stat-label">{t('marketplace.monetization.inquiryRevenue')}</div></div>
              </div>
              {/* Revenue by Type */}
              {monetizationDashboard?.revenueByType?.length > 0 && (
                <div className="mp-section">
                  <h3 className="mp-section-title">{t('marketplace.monetization.revenueByType')}</h3>
                  <div className="module-stats">
                    {monetizationDashboard.revenueByType.map((r: any, i: number) => (
                      <div className="stat-card" key={i}>
                        <div className="stat-value">{formatCurrency(r.total || 0)}</div>
                        <div className="stat-label">{r.type} ({r.count})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Subscription Stats */}
              {monetizationDashboard?.subscriptionStats?.length > 0 && (
                <div className="mp-section">
                  <h3 className="mp-section-title">{t('marketplace.monetization.subscriptionStats')}</h3>
                  <div className="module-stats">
                    {monetizationDashboard.subscriptionStats.map((s: any, i: number) => (
                      <div className="stat-card" key={i}>
                        <div className="stat-value">{s.count}</div>
                        <div className="stat-label">{s.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Boost Stats */}
              {monetizationDashboard?.boostStats?.length > 0 && (
                <div className="mp-section">
                  <h3 className="mp-section-title">{t('marketplace.monetization.boostStats')}</h3>
                  <div className="module-stats">
                    {monetizationDashboard.boostStats.map((b: any, i: number) => (
                      <div className="stat-card" key={i}>
                        <div className="stat-value">{b.count}</div>
                        <div className="stat-label">{b.boost_type} ({formatCurrency(b.revenue || 0)})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Recent Transactions */}
              {monetizationDashboard?.recentTransactions?.length > 0 && (
                <div className="mp-section">
                  <h3 className="mp-section-title">{t('marketplace.monetization.recentTransactions')}</h3>
                  <div className="data-table-container">
                    <table className="module-table">
                      <thead><tr><th>{t('marketplace.monetization.user')}</th><th>{t('marketplace.monetization.type')}</th><th>{t('marketplace.monetization.amount')}</th><th>{t('marketplace.orders.status')}</th><th>{t('marketplace.monetization.date')}</th></tr></thead>
                      <tbody>
                        {monetizationDashboard.recentTransactions.map((tx: any) => (
                          <tr key={tx.id}>
                            <td>{tx.userName || '—'}</td>
                            <td><span className="module-badge">{tx.transaction_type}</span></td>
                            <td>{formatCurrency(tx.amount)}</td>
                            <td><span className={`module-badge ${tx.status === 'completed' ? 'success' : ''}`}>{tx.status}</span></td>
                            <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {(!monetizationDashboard?.recentTransactions?.length && !monetizationDashboard?.revenueByType?.length) && (
                <div className="mp-section">
                  <p className="mp-empty">{t('marketplace.monetization.noRevenue')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Listing Card Component ───
const ListingCard: React.FC<{ listing: MarketplaceListing; formatCurrency: (n: number) => string; onView: () => void; t: (key: string) => string; isFavorite?: boolean; onToggleFavorite?: () => void }> = ({ listing: l, formatCurrency, onView, t, isFavorite, onToggleFavorite }) => {
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
  const sellerType = g(l, 'sellerType', 'seller_type')
  const breederVerified = g(l, 'breederVerified', 'breeder_verified')
  const welfareAtt = g(l, 'welfareAttestation', 'welfare_attestation')
  const images = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || [])
  const tags = typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : (l.tags || [])
  const breedAvgPrice = g(l, 'breedAvgPrice', 'breed_avg_price')
  const hasHealthPassport = g(l, 'hasHealthPassport', 'has_health_passport')
  // Moderation state — only ever present on the seller's own listings (and for admins)
  const adminApproved = g(l, 'adminApproved', 'admin_approved')
  const isRejected = adminApproved === false && l.status === 'rejected'
  const isPendingReview = adminApproved === false && !isRejected
  const isReserved = l.status === 'reserved'
  // Fair Deal badge: price is ≥15% below breed average → good deal; ≥15% above → premium priced
  const fairDealPct = breedAvgPrice && l.price ? Math.round(100 * l.price / breedAvgPrice) : null
  const isFairDeal = fairDealPct !== null && fairDealPct < 85
  const isPremiumPriced = fairDealPct !== null && fairDealPct > 115

  return (
    <div className={`mp-listing-card ${tier === 'spotlight' ? 'spotlight' : tier === 'premium' ? 'premium' : ''}`} onClick={onView}>
      {isHot && <div className="mp-hot-ribbon">{t('marketplace.card.hotDeal')}</div>}
      {tier === 'spotlight' && !isHot && <div className="mp-hot-ribbon spotlight-ribbon">{t('marketplace.card.spotlightLabel')}</div>}

      {/* Favorite heart */}
      {onToggleFavorite && (
        <button
          className={`mp-fav-btn ${isFavorite ? 'active' : ''}`}
          title={isFavorite ? t('marketplace.engagement.removeFavorite') : t('marketplace.engagement.addFavorite')}
          aria-label={isFavorite ? t('marketplace.engagement.removeFavorite') : t('marketplace.engagement.addFavorite')}
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
        >{isFavorite ? '❤️' : '🤍'}</button>
      )}

      {/* Image placeholder */}
      <div className="mp-card-img">
        {images.length > 0 ? <img {...cldCardImageProps(images[0])} alt={l.title} loading="lazy" /> : <div className="mp-card-img-placeholder">{CATEGORY_ICONS[l.category] || '📦'}</div>}
        {g(l, 'videoUrl', 'video_url') && <span className="mp-card-video-badge" title={t('marketplace.card.hasVideo')}>🎥</span>}
      </div>

      <div className="mp-card-body">
        {/* Category + Type badges */}
        <div className="mp-card-badges">
          <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
          <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? t('marketplace.listingType.auctionType') : t('marketplace.fixedBadge')}</span>
          {tier === 'premium' && <span className="mp-badge premium">⭐</span>}
          {isPendingReview && <span className="mp-badge pending-review">⏳ {t('marketplace.deal.pendingReview')}</span>}
          {isRejected && <span className="mp-badge rejected">❌ {t('marketplace.deal.rejected')}</span>}
          {isReserved && <span className="mp-badge reserved">🤝 {t('marketplace.deal.status.reserved')}</span>}
        </div>

        <h4 className="mp-card-title">{l.title}</h4>
        {/* VC Animal ID badge */}
        {(g(l, 'animalUniqueId', 'animal_unique_id')) && (
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6366f1', background: '#eef2ff', borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginBottom: 4 }}>
            🏷️ {g(l, 'animalUniqueId', 'animal_unique_id')}
          </div>
        )}

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
          {milkYield && <span className="mp-metric">🥛 {milkYield}{t('marketplace.card.lPerDay')}</span>}
          {weight && <span className="mp-metric">⚖️ {weight}{t('marketplace.card.kg')}</span>}
          {pregnancy === 'pregnant' && <span className="mp-metric pregnant">🤰 {t('marketplace.card.pregnant')}</span>}
          {vax === 'fully_vaccinated' && <span className="mp-metric vax">{t('marketplace.card.vaccinated')}</span>}
          {hasCert && <span className="mp-metric cert">{t('marketplace.card.certified')}</span>}
          {welfareAtt && <span className="mp-metric welfare">🛡️ {t('marketplace.card.welfareAttested')}</span>}
          {sellerType === 'registered_breeder' && <span className={`mp-metric breeder ${breederVerified ? 'verified' : ''}`}>{breederVerified ? '✅' : '📋'} {t('marketplace.card.registeredBreeder')}</span>}
          {hasHealthPassport && <span className="mp-metric cert" title="Vaccination records verified in VetCare system">🏥 {t('marketplace.card.healthPassport')}</span>}
          {isFairDeal && <span className="mp-metric" style={{ background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>💚 {t('marketplace.card.fairDeal')} ({fairDealPct}%)</span>}
          {isPremiumPriced && <span className="mp-metric" style={{ background: '#fef3c7', color: '#92400e' }}>⭐ {t('marketplace.card.premiumPriced')}</span>}
        </div>

        {/* Price */}
        <div className="mp-card-price">
          {l.price ? formatCurrency(l.price) : t('marketplace.card.contact')}
          {listingType === 'auction' && bidCount && <span className="mp-bid-count">{bidCount} {t('marketplace.units.listings').replace('listings', 'bids')}</span>}
        </div>

        {/* Footer */}
        <div className="mp-card-footer">
          <span>{sellerName || t('marketplace.genderLabel.unknown')}</span>
          <span>{viewsCount || 0} {t('marketplace.units.views')}</span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mp-card-tags">
            {tags.slice(0, 3).map((tag: string) => <span key={tag} className="mp-tag">{tag}</span>)}
            {tags.length > 3 && <span className="mp-tag">+{tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Auction Countdown Timer ───
const AuctionCountdown: React.FC<{ endTime: string; t: (key: string) => string }> = ({ endTime, t }) => {
  const [remaining, setRemaining] = React.useState('')
  React.useEffect(() => {
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now()
      if (diff <= 0) { setRemaining(t('marketplace.detail.auctionEnded')); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endTime])
  const isUrgent = new Date(endTime).getTime() - Date.now() < 3600000
  return <span className={`mp-countdown ${isUrgent ? 'urgent' : ''}`}>{remaining}</span>
}

// ─── Listing Detail Component ───
const ListingDetail: React.FC<{
  listing: MarketplaceListing; bids: MarketplaceBid[]; formatCurrency: (n: number) => string;
  bidAmount: string; bidMessage: string; onBidAmountChange: (v: string) => void; onBidMessageChange: (v: string) => void;
  onPlaceBid: () => void; onBuyNow: () => void; onBack: () => void;
  isAdmin: boolean; onToggleHotDeal: (id: string, v: boolean) => void; onToggleFeatured: (id: string, v: boolean) => void;
  userId?: string; onRequestContact?: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void; onMessageSeller?: () => void;
  onReport?: () => void; onBookVetCheck?: () => void; transport?: { url: string };
  t: (key: string) => string;
}> = ({ listing: l, bids, formatCurrency, bidAmount, bidMessage, onBidAmountChange, onBidMessageChange, onPlaceBid, onBuyNow, onBack, isAdmin, onToggleHotDeal, onToggleFeatured, userId, onRequestContact, isFavorite, onToggleFavorite, onMessageSeller, onReport, onBookVetCheck, transport, t }) => {
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
  const sellerType = g(l, 'sellerType', 'seller_type')
  const breederVerified = g(l, 'breederVerified', 'breeder_verified')
  const welfareAtt = g(l, 'welfareAttestation', 'welfare_attestation')
  const tags = typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : (l.tags || [])
  const images = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || [])
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  return (
    <div className="mp-detail">
      <button className="module-btn small" onClick={onBack}>{t('marketplace.detail.backToListings')}</button>

      <div className="mp-detail-layout">
        <div className="mp-detail-main">
          {/* Header badges */}
          <div className="mp-card-badges">
            <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
            <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? t('marketplace.listingType.auctionType') : t('marketplace.listingType.fixedPrice')}</span>
            {tier && <span className="mp-badge premium">{{ standard: t('marketplace.tier.standard'), premium: t('marketplace.tier.premium'), spotlight: t('marketplace.tier.spotlight') }[tier as 'standard' | 'premium' | 'spotlight'] || tier}</span>}
            {isHot && <span className="mp-badge hot">{t('marketplace.card.hotDeal')}</span>}
            {l.featured && <span className="mp-badge featured">⭐ Featured</span>}
          </div>

          {images.length > 0 && (
            <div className="mp-detail-gallery">
              <div className="mp-detail-gallery-main">
                <img {...cldDetailImageProps(images[activeImageIdx])} alt={l.title} />
              </div>
              {images.length > 1 && (
                <div className="mp-detail-gallery-thumbs">
                  {images.map((img: string, i: number) => (
                    <button key={i} type="button" className={`mp-detail-thumb ${i === activeImageIdx ? 'active' : ''}`} onClick={() => setActiveImageIdx(i)}>
                      <img {...cldCardImageProps(img)} alt={`${l.title} ${i + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mp-detail-title-row">
            <h2>{l.title}</h2>
            <div className="mp-detail-title-actions">
              {onToggleFavorite && (
                <button className={`mp-fav-btn inline ${isFavorite ? 'active' : ''}`} onClick={onToggleFavorite}
                  title={isFavorite ? t('marketplace.engagement.removeFavorite') : t('marketplace.engagement.addFavorite')}>
                  {isFavorite ? '❤️' : '🤍'}
                </button>
              )}
              {onMessageSeller && userId && l.seller_id !== userId && (
                <button className="module-btn small" onClick={onMessageSeller}>💬 {t('marketplace.engagement.messageSeller')}</button>
              )}
            </div>
          </div>
          <p className="mp-sell-step-desc">{l.description || t('marketplace.detail.noDescription')}</p>

          {/* Price */}
          <div className="mp-detail-price">{l.price ? formatCurrency(l.price) : t('marketplace.contactForPrice')}</div>

          {/* Video */}
          {(() => {
            const videoUrl = g(l, 'videoUrl', 'video_url')
            if (!videoUrl) return null
            const isUploaded = String(videoUrl).startsWith('/uploads/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoUrl)
            return (
              <div className="mp-detail-video">
                {isUploaded ? (
                  <video controls preload="metadata" src={videoUrl} className="mp-detail-video-el" />
                ) : (
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="module-btn small">▶ {t('marketplace.detail.watchVideo')}</a>
                )}
              </div>
            )
          })()}

          {/* Animal Profile Section */}
          {(species || breed || milkYield || weight || age) && (
            <div className="mp-detail-section">
              <h3>{t('marketplace.detail.animalProfile')}</h3>
              <div className="mp-detail-grid">
                {species && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.species')}</span><span className="mp-detail-value">{species}</span></div>}
                {breed && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.breed')}</span><span className="mp-detail-value">{breed}</span></div>}
                {gender && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.gender')}</span><span className="mp-detail-value">{{ male: t('marketplace.genderLabel.male'), female: t('marketplace.genderLabel.female'), unknown: t('marketplace.genderLabel.unknown') }[gender] || gender}</span></div>}
                {age && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.age')}</span><span className="mp-detail-value">{age >= 12 ? `${Math.floor(age / 12)}y ${age % 12}m` : `${age} ${t('marketplace.units.months')}`}</span></div>}
                {weight && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.weightKg')}</span><span className="mp-detail-value">{weight} {t('marketplace.units.kg')}</span></div>}
                {lactation !== undefined && lactation !== null && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.lactation')}</span><span className="mp-detail-value">{lactation}</span></div>}
                {milkYield && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.dailyMilk')}</span><span className="mp-detail-value highlight">🥛 {milkYield} {t('marketplace.units.lPerDay')}</span></div>}
                {pregnancy && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.pregnancy')}</span><span className="mp-detail-value">{pregnancy === 'pregnant' ? `${t('marketplace.pregnancyLabel.pregnant')}${pregMonth ? ` (${pregMonth} ${t('marketplace.units.months')})` : ''}` : pregnancy}</span></div>}
              </div>
            </div>
          )}

          {/* Health Section */}
          <div className="mp-detail-section">
            <h3>{t('marketplace.detail.healthCert')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.vaccination')}</span><span className="mp-detail-value">{vax ? ({ fully_vaccinated: t('marketplace.vaxLabel.fully'), partially_vaccinated: t('marketplace.vaxLabel.partial'), not_vaccinated: t('marketplace.vaxLabel.none'), unknown: t('marketplace.vaxLabel.unknown') } as Record<string, string>)[vax] || vax : t('marketplace.genderLabel.unknown')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.reviewLabels.healthCert')}</span><span className="mp-detail-value">{hasCert ? t('marketplace.reviewLabels.yes') : t('marketplace.reviewLabels.no')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.condition')}</span><span className="mp-detail-value">{l.condition}</span></div>
            </div>
          </div>

          {/* Seller & Location */}
          <div className="mp-detail-section">
            <h3>{t('marketplace.detail.sellerLocation')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.seller')}</span><span className="mp-detail-value">{sellerName || t('marketplace.genderLabel.unknown')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.location')}</span><span className="mp-detail-value">{l.location || t('marketplace.detail.notSpecified')}</span></div>
              <div className="mp-detail-item">
                <span className="mp-detail-label">{t('marketplace.livestock.contact')}</span>
                <span className="mp-detail-value">
                  {contact ? (
                    <div className="mp-contact-actions">
                      <span>{contact}</span>
                      <a href={`https://wa.me/${contact.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in your listing: ${l.title}`)}`}
                        target="_blank" rel="noopener noreferrer" className="mp-contact-btn whatsapp"
                        onClick={e => e.stopPropagation()}>
                        💬 WhatsApp
                      </a>
                      <a href={`tel:${contact}`} className="mp-contact-btn call" onClick={e => e.stopPropagation()}>
                        📞 {t('marketplace.detail.call')}
                      </a>
                    </div>
                  ) : userId && l.seller_id !== userId ? (
                    <div>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>{t('marketplace.detail.contactHidden')}</span>
                      {onRequestContact && (
                        <button className="module-btn small" style={{ marginTop: 6 }} onClick={onRequestContact}>
                          📩 {t('marketplace.detail.requestContact')}
                        </button>
                      )}
                    </div>
                  ) : <span style={{ color: '#9ca3af' }}>—</span>}
                </span>
              </div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.views')}</span><span className="mp-detail-value">{viewsCount || 0}</span></div>
              {sellerType === 'registered_breeder' && (
                <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.sellerType')}</span><span className="mp-detail-value">{breederVerified ? '✅ ' : '📋 '}{t('marketplace.compliance.registeredBreeder')}{breederVerified ? ` (${t('marketplace.compliance.verified')})` : ''}</span></div>
              )}
              {sellerType === 'individual' && (
                <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.sellerType')}</span><span className="mp-detail-value">{t('marketplace.compliance.individualOwner')}</span></div>
              )}
            </div>
          </div>

          {/* Compliance & Welfare */}
          <div className="mp-detail-section mp-compliance-detail">
            <h3>⚖️ {t('marketplace.compliance.complianceTitle')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.welfareStatus')}</span><span className="mp-detail-value">{welfareAtt ? '✅ ' + t('marketplace.compliance.attested') : '—'}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.termsStatus')}</span><span className="mp-detail-value">✅ {t('marketplace.compliance.accepted')}</span></div>
            </div>
            <div className="mp-compliance-info">{t('marketplace.compliance.detailDisclaimer')}</div>
          </div>

          {tags.length > 0 && (
            <div className="mp-card-tags">
              {tags.map((tag: string) => <span key={tag} className="mp-tag">{tag}</span>)}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="mp-admin-bg">
              <h3>{t('marketplace.detail.adminControls')}</h3>
              <div className="mp-action-cluster">
                <button className="module-btn small" onClick={() => onToggleHotDeal(l.id, isHot || false)}>{isHot ? t('marketplace.detail.removeHotDeal') : t('marketplace.detail.makeHotDeal')}</button>
                <button className="module-btn small" onClick={() => onToggleFeatured(l.id, l.featured || false)}>{l.featured ? t('marketplace.detail.unfeature') : t('marketplace.detail.feature')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Buy/Bid panel */}
        <div className="mp-detail-sidebar">
          {(l.seller_id && l.seller_id === userId) ? (
            <div className="mp-buy-panel">
              <h4>{t('marketplace.detail.yourListing')}</h4>
              <p className="mp-sell-step-desc">{t('marketplace.detail.yourListingDesc')}</p>
            </div>
          ) : listingType !== 'auction' ? (
            <div className="mp-buy-panel">
              <h4>🤝 {t('marketplace.deal.reserveTitle')}</h4>
              <div className="mp-buy-price">{l.price ? formatCurrency(l.price) : t('marketplace.detail.contactSeller')}</div>
              <div className="mp-sell-step-desc">{t('marketplace.orders.qty')}: {l.quantity} {l.unit || t('marketplace.units.head')}</div>
              {/* Free-classifieds deal: how it works */}
              <div className="mp-deal-steps">
                <div className="mp-deal-step"><span className="mp-deal-step-num">1</span>{t('marketplace.deal.howStep1')}</div>
                <div className="mp-deal-step"><span className="mp-deal-step-num">2</span>{t('marketplace.deal.howStep2')}</div>
                <div className="mp-deal-step"><span className="mp-deal-step-num">3</span>{t('marketplace.deal.howStep3')}</div>
                <div className="mp-deal-step"><span className="mp-deal-step-num">4</span>{t('marketplace.deal.howStep4')}</div>
              </div>
              <div className="mp-deal-free-note">{t('marketplace.deal.freeNote')}</div>
              {l.status === 'active' && <button className="module-btn primary" onClick={onBuyNow}>🤝 {t('marketplace.deal.reserveNow')}</button>}
              {l.status === 'reserved' && <div className="mp-deal-reserved-badge">⏳ {t('marketplace.deal.currentlyReserved')}</div>}
            </div>
          ) : (
            <div className="mp-bid-panel">
              <h4>{t('marketplace.detail.placeBidTitle')}</h4>
              <div className="mp-bid-current">
                <span>{t('marketplace.detail.currentHighest')}</span>
                <span className="mp-bid-amount">{formatCurrency(highestBid || l.price || 0)}</span>
              </div>
              {auctionEnd && (
                <div className="mp-auction-end">
                  <span>{t('marketplace.detail.ends')} </span>
                  <AuctionCountdown endTime={auctionEnd} t={t} />
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{new Date(auctionEnd).toLocaleString()}</div>
                </div>
              )}
              <input className="module-input" type="number" placeholder={t('marketplace.detail.yourBidAmount')} value={bidAmount} onChange={e => onBidAmountChange(e.target.value)} />
              <textarea className="module-input" placeholder={t('marketplace.detail.messageOptional')} value={bidMessage} onChange={e => onBidMessageChange(e.target.value)} />
              <button className="module-btn primary" onClick={onPlaceBid}>{t('marketplace.detail.placeBidTitle')}</button>

              {bids.length > 0 && (
                <div className="mp-bid-history">
                  <h5>{t('marketplace.detail.placeBidTitle').replace('🔨 ', '')} ({bids.length})</h5>
                  {bids.slice(0, 8).map(b => (
                    <div key={b.id} className="mp-bid-row">
                      <span className="mp-bid-row-amount">{formatCurrency(b.amount)}</span>
                      <span>{g(b, 'bidderName', 'bidder_name')}</span>
                      {(g(b, 'isWinning', 'is_winning')) && <span className="mp-bid-winning">{t('marketplace.detail.leading')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paid-services funnel: pre-purchase vet check (only for animal listings, non-owners) */}
          {onBookVetCheck && l.category === 'animal' && userId && l.seller_id !== userId && (
            <div className="mp-vetcheck-panel">
              <div className="mp-vetcheck-title">🩺 {t('marketplace.services.vetCheckTitle')}</div>
              <p className="mp-vetcheck-desc">{t('marketplace.services.vetCheckDesc')}</p>
              <button className="module-btn primary" onClick={onBookVetCheck}>{t('marketplace.services.bookVetCheck')}</button>
            </div>
          )}

          {/* Transport referral (config-driven) */}
          {transport && userId && l.seller_id !== userId && (
            <div className="mp-transport-panel">
              <span>🚚 {t('marketplace.services.transportDesc')}</span>
              <a className="module-btn small" href={transport.url} target="_blank" rel="noopener noreferrer">{t('marketplace.services.arrangeTransport')}</a>
            </div>
          )}

          {/* Report */}
          {onReport && (
            <button className="mp-report-link" onClick={onReport}>🚩 {t('marketplace.report.reportListing')}</button>
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

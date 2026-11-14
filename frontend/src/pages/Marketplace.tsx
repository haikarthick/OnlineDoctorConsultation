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
import { useMasterData } from '../context/MasterDataContext'
import { g } from '../components/marketplace/publicListingShared'
import { MAX_LISTING_IMAGES, MAX_IMAGE_SIZE_MB, MAX_VIDEO_SIZE_MB, MAX_VIDEO_DURATION_SECONDS, readVideoDuration, TabKey, AdminSubTab } from '../components/marketplace/marketplaceShared'
import { ReportModal } from '../components/marketplace/ReportModal'
import { DashboardTab } from '../components/marketplace/DashboardTab'
import { BrowseTab } from '../components/marketplace/BrowseTab'
import { SellWizard } from '../components/marketplace/SellWizard'
import { OrdersTab } from '../components/marketplace/OrdersTab'
import { MessagesTab } from '../components/marketplace/MessagesTab'
import { FavoritesTab } from '../components/marketplace/FavoritesTab'
import { SavedSearchesTab } from '../components/marketplace/SavedSearchesTab'
import { PricesTab } from '../components/marketplace/PricesTab'
import { AdminPanel } from '../components/marketplace/AdminPanel'

const Marketplace: React.FC = () => {
  const { formatCurrency, settings } = useSettings()
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { speciesCategories, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm, marketplaceCategories, marketplaceConditions, resolveLabel, marketplaceEligibleSpecies, speciesLabel } = useMasterData()
  const isAdmin = user?.role === 'admin'
  const SPECIES_LIST = marketplaceEligibleSpecies
  const CATEGORY_KEYS: Array<{ value: string; label: string }> = [
    { value: '', label: t('marketplace.categories.all') },
    ...marketplaceCategories.map(c => ({ value: c.code, label: resolveLabel(c, t) })),
  ]

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
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('listings')
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
      setError(t('marketplace.sell.videoTooLarge', { maxMb: MAX_VIDEO_SIZE_MB, defaultValue: `Video is too large - max ${MAX_VIDEO_SIZE_MB}MB` }))
      e.target.value = ''
      return
    }

    // Fail fast on the device before spending mobile data on an upload
    // the backend will reject anyway.
    try {
      const duration = await readVideoDuration(file)
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        setError(t('marketplace.sell.videoTooLong', { maxSec: MAX_VIDEO_DURATION_SECONDS, defaultValue: `Video is too long - max ${MAX_VIDEO_DURATION_SECONDS} seconds` }))
        e.target.value = ''
        return
      }
    } catch {
      // Couldn't read duration client-side (unsupported format/browser) -
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
        setError(t('marketplace.sell.videoTooLong', { maxSec: apiErr.maxSeconds || MAX_VIDEO_DURATION_SECONDS, defaultValue: `Video is too long - max ${MAX_VIDEO_DURATION_SECONDS} seconds` }))
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

  // Pre-purchase vet check - funnel into a paid consultation (the revenue layer)
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

  // Shared by the dashboard and favorites tabs: switch to Browse and open a listing's detail.
  const viewListingFromTab = (listing: MarketplaceListing) => { setTab('browse'); viewListing(listing) }

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
    const animalClassVal = animal.animalClass || animal.animal_class
    if (animalClassVal) updates.animalClass = animalClassVal
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
    // Auto-generate title - prefer the species-correct class label ("Bullock")
    // over raw gender ("male") when the linked animal has one set
    const ageStr = updates.animalAgeMonths ? `${updates.animalAgeMonths}m` : ''
    const classTerm = animalClassVal ? findClassTerm(animal.species, animalClassVal) : undefined
    const genderStr = classTerm ? ` ${resolveLabel(classTerm, t)}` : (animal.gender ? ` ${animal.gender}` : '')
    updates.title = `${animal.name} - ${animal.species || ''}${animal.breed ? ' ' + animal.breed : ''}${genderStr}${ageStr ? ', ' + ageStr : ''}`.trim()
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
      setError(t('marketplace.sell.imageTooLarge', { maxMb: MAX_IMAGE_SIZE_MB, defaultValue: `Image is too large - max ${MAX_IMAGE_SIZE_MB}MB` }))
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
  // connect and settle directly - no payment happens on the platform
  const reserveListing = async (listing: MarketplaceListing) => {
    if (listing.price == null) {
      // "Contact for fee" listing - send inquiry instead of reserving
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

  // ── Browse/Sell/Orders/Admin tab prop-wiring handlers ──
  const handleClearAllFilters = () => { setFilters({}); setSortBy(''); setNearMeActive(false) }
  const handleBuyNow = () => { if (selectedListing) reserveListing(selectedListing) }
  const handleBack = () => setSelectedListing(null)
  const handleRequestContact = async () => {
    if (!selectedListing) return
    try {
      await apiService.createInquiry(selectedListing.id, '')
      setSuccessMsg(t('marketplace.inquirySent', 'Inquiry sent! The seller will be notified.'))
      viewListing(selectedListing)
    } catch (e: any) { setError(e?.response?.data?.error?.message || e.message) }
  }
  const handleMessageSellerClick = () => { if (selectedListing) messageSeller(selectedListing) }
  const handleReportClick = () => { if (selectedListing) setReportModal({ listingId: selectedListing.id, title: selectedListing.title }) }
  const handleBookVetCheckClick = () => { if (selectedListing) bookVetCheck(selectedListing) }

  const handleClearFieldError = (key: string) => setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
    }).catch(() => setError(t('common.copyFailed')))
  }
  const handleSellStep0Next = () => {
    if (!sellForm.title.trim()) {
      setError(t('marketplace.sell.titleRequired'))
      setFieldErrors({ title: t('marketplace.sell.titleRequired') })
      return
    }
    setFieldErrors({})
    setSellStep(1)
  }

  const handleOrderRoleChange = (role: 'buyer' | 'seller') => { setOrderRole(role); fetchOrders(role); fetchInquiries(role) }
  const handleDealPaymentMethodChange = (orderId: string, method: string) => setDealPaymentMethod(prev => ({ ...prev, [orderId]: method }))

  const handleAdminSubTabChange = (st: AdminSubTab) => { setAdminSubTab(st); if (st === 'reports') fetchAdminReports() }
  const handleAdminFilterChange = (v: string) => { setAdminFilter(v); fetchAdminData() }
  const handleAdminTitleClick = (l: MarketplaceListing) => viewListingFromTab(l)
  const handleAdminReportFilterChange = (v: string) => { setAdminReportFilter(v); fetchAdminReports(v) }
  const handleAdminReportViewListing = (listingId: string, title: string) => { setTab('browse'); viewListing({ id: listingId, title } as MarketplaceListing) }
  const handleAdminResolutionChange = (id: string, v: string) => setAdminReportResolution(prev => ({ ...prev, [id]: v }))
  const handleEditPlan = (p: any) => {
    setEditingPlan(p)
    setPlanForm({
      name: p.name, description: p.description || '', price: String(p.price),
      durationDays: String(p.duration_days), maxListings: p.max_listings ? String(p.max_listings) : '',
      maxBoostsPerMonth: String(p.max_boosts_per_month || 0), isActive: p.is_active, sortOrder: String(p.sort_order || 0),
    })
  }
  const handleCancelEditPlan = () => {
    setEditingPlan(null)
    setPlanForm({ name: '', description: '', price: '', durationDays: '30', maxListings: '', maxBoostsPerMonth: '0', isActive: false, sortOrder: '0' })
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
    <div className="module-page mp-page">
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
        <ReportModal
          reportModal={reportModal}
          reportReason={reportReason} onReasonChange={setReportReason}
          reportDetails={reportDetails} onDetailsChange={setReportDetails}
          onClose={() => setReportModal(null)} onSubmit={submitReport} t={t}
        />
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
        <DashboardTab
          dashboard={dashboard} formatCurrency={formatCurrency} speciesLabel={speciesLabel}
          onViewListing={viewListingFromTab}
          onFilterBySpecies={(species) => { setTab('browse'); updateFilter('species', species) }}
          t={t}
        />
      )}

      {/* ════════ BROWSE ════════ */}
      {(tab === 'browse' || tab === 'auctions') && (
        <BrowseTab
          filters={filters} updateFilter={updateFilter}
          sortBy={sortBy} onSortByChange={setSortBy}
          categoryKeys={CATEGORY_KEYS} speciesList={SPECIES_LIST}
          classTermsForSpecies={classTermsForSpecies} resolveLabel={resolveLabel} speciesLabel={speciesLabel}
          onSearch={fetchListings} onClearAllFilters={handleClearAllFilters}
          nearMeActive={nearMeActive} onNearMeToggle={handleNearMeToggle} radiusKm={radiusKm} onRadiusChange={setRadiusKm}
          userLocation={userLocation} locationError={locationError}
          treasureMount={mpConfig?.treasureMount}
          showSaveSearch={showSaveSearch} onShowSaveSearchChange={setShowSaveSearch}
          saveSearchName={saveSearchName} onSaveSearchNameChange={setSaveSearchName} onSaveCurrentSearch={saveCurrentSearch}
          loading={loading} listings={listings} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} isAuthenticated={!!user}
          onViewListing={viewListing}
          totalListings={totalListings} pageSize={PAGE_SIZE} page={page} onPageChange={setPage}
          formatCurrency={formatCurrency}
          selectedListing={selectedListing} bids={bids}
          bidAmount={bidAmount} bidMessage={bidMessage} onBidAmountChange={setBidAmount} onBidMessageChange={setBidMessage}
          onPlaceBid={placeBid} onBuyNow={handleBuyNow} onBack={handleBack}
          isAdmin={isAdmin} onToggleHotDeal={handleToggleHotDeal} onToggleFeatured={handleToggleFeatured}
          userId={user?.id} onRequestContact={handleRequestContact} onMessageSeller={handleMessageSellerClick} onReport={handleReportClick} onBookVetCheck={handleBookVetCheckClick}
          transport={mpConfig?.transport?.enabled && mpConfig.transport.url ? mpConfig.transport : undefined}
          t={t}
        />
      )}

      {/* ════════ SELL (Multi-Step) ════════ */}
      {tab === 'sell' && (
        <SellWizard
          sellSteps={sellSteps} sellStep={sellStep} onStepClick={setSellStep}
          step0Props={{
            sellForm, sf, fieldErrors, onClearFieldError: handleClearFieldError,
            userAnimals, selectedAnimalId, onAnimalSelect: handleAnimalSelect,
            copiedId, onCopyId: handleCopyId,
            speciesLabel, auctionEnabled, isAdmin, categoryKeys: CATEGORY_KEYS,
            onNext: handleSellStep0Next, t,
          }}
          step1Props={{
            sellForm, sf, setSellForm, selectedAnimalId,
            speciesCategories, marketplaceEligibleSpecies, speciesLabel,
            breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm, resolveLabel,
            onBack: () => setSellStep(0), onNext: () => setSellStep(2), t,
          }}
          step2Props={{
            sellForm, sf, setSellForm, marketplaceConditions, resolveLabel,
            maxListingImages: MAX_LISTING_IMAGES, uploadingImages, onImageUpload: handleImageUpload,
            uploadingVideo, onVideoUpload: handleVideoUpload, maxVideoDurationSeconds: MAX_VIDEO_DURATION_SECONDS, maxVideoSizeMb: MAX_VIDEO_SIZE_MB,
            onBack: () => setSellStep(1), onNext: () => setSellStep(3), t,
          }}
          step3Props={{
            sellForm, sf, currency: settings.currency, priceHint, formatCurrency,
            geoLocating, onUseMyLocation: useMyLocationForListing,
            onBack: () => setSellStep(2), onReview: () => setSellStep(4), t,
          }}
          step4Props={{
            sellForm, sf, currency: settings.currency, speciesLabel, breedLabel, findClassTerm, resolveLabel,
            genderLabels: GENDER_LABELS, vaxLabels: VAX_LABELS,
            onBack: () => setSellStep(3), onPublish: createListing, t,
          }}
          t={t}
        />
      )}

      {/* ════════ ORDERS ════════ */}
      {tab === 'orders' && (
        <OrdersTab
          orderRole={orderRole} onOrderRoleChange={handleOrderRoleChange}
          inquiries={inquiries} orders={orders}
          speciesLabel={speciesLabel} formatCurrency={formatCurrency}
          dealPaymentMethod={dealPaymentMethod} onDealPaymentMethodChange={handleDealPaymentMethodChange}
          onConfirmDeal={confirmDeal} onCancelDeal={cancelDeal} t={t}
        />
      )}

      {/* ════════ MESSAGES ════════ */}
      {tab === 'messages' && (
        <MessagesTab
          threads={threads} activeThread={activeThread} onOpenThread={openThread} onCloseThread={() => setActiveThread(null)}
          threadMessages={threadMessages} currentUserId={user?.id}
          messageDraft={messageDraft} onMessageDraftChange={setMessageDraft} onSendMessage={sendMessage} t={t}
        />
      )}

      {/* ════════ FAVORITES ════════ */}
      {tab === 'favorites' && (
        <FavoritesTab
          favorites={favorites} formatCurrency={formatCurrency}
          onViewListing={viewListingFromTab}
          favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} t={t}
        />
      )}

      {/* ════════ SAVED SEARCHES ════════ */}
      {tab === 'saved' && (
        <SavedSearchesTab
          savedSearches={savedSearches} onApplySearch={applySavedSearch}
          onToggleAlerts={toggleSearchAlerts} onDeleteSearch={deleteSavedSearch} t={t}
        />
      )}

      {/* ════════ MARKET PRICES ════════ */}
      {tab === 'prices' && (
        <PricesTab marketPrices={marketPrices} speciesLabel={speciesLabel} formatCurrency={formatCurrency} t={t} />
      )}

      {/* ════════ ADMIN PANEL ════════ */}
      {tab === 'admin' && isAdmin && (
        <AdminPanel
          adminSubTab={adminSubTab} onSubTabChange={handleAdminSubTabChange}
          listingsProps={{
            adminStats, adminFilter, onAdminFilterChange: handleAdminFilterChange,
            adminListings, speciesLabel, formatCurrency,
            onTitleClick: handleAdminTitleClick,
            onApprove: handleAdminApprove, onToggleHotDeal: handleToggleHotDeal, onToggleFeatured: handleToggleFeatured,
            adminRejectReason, onRejectReasonChange: setAdminRejectReason, onReject: handleAdminReject, t,
          }}
          reportsProps={{
            adminReportFilter, onFilterChange: handleAdminReportFilterChange,
            adminReports, onViewListing: handleAdminReportViewListing,
            adminReportResolution, onResolutionChange: handleAdminResolutionChange,
            onResolve: resolveReport, t,
          }}
          settingsProps={{
            auctionEnabled, onAuctionToggle: handleAdminAuctionToggle,
            monetizationSettings, onToggleSetting: handleToggleSetting, t,
          }}
          plansProps={{
            monetizationPlans, formatCurrency,
            onTogglePlanActive: handleTogglePlanActive, onEditPlan: handleEditPlan, onDeletePlan: handleDeletePlan,
            editingPlan, planForm, onPlanFormChange: setPlanForm,
            onSavePlan: handleSavePlan, onCancelEdit: handleCancelEditPlan, t,
          }}
          revenueProps={{ monetizationDashboard, formatCurrency, t }}
          t={t}
        />
      )}
    </div>
  )
}

export default Marketplace

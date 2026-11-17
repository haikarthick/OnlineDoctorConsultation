// ─── Marketplace & Auctions ─────────────────────────────────
export interface MarketplaceListing {
  id: string
  enterpriseId?: string
  sellerId: string
  title: string
  description?: string
  category: 'animal' | 'feed' | 'equipment' | 'medicine' | 'semen_embryo' | 'service' | 'other'
  listingType: 'fixed_price' | 'auction'
  price?: number
  currency: string
  quantity: number
  unit?: string
  condition: 'new' | 'used' | 'refurbished'
  images: string[]
  location?: string
  shippingOptions: any[]
  tags: string[]
  status: 'draft' | 'active' | 'sold' | 'expired' | 'deleted' | 'rejected' | 'pending' | 'reserved' | 'rehomed' | 'pending_closure'
  featured: boolean
  viewsCount: number
  sellerName?: string
  enterpriseName?: string
  bidCount?: number
  highestBid?: number
  expiresAt?: string
  createdAt: string
  // Livestock-specific fields
  species?: string
  breed?: string
  animalAgeMonths?: number
  animal_age_months?: number
  animalWeightKg?: number
  animal_weight_kg?: number
  gender?: 'male' | 'female' | 'unknown'
  animalClass?: string
  animal_class?: string
  lactationNumber?: number
  lactation_number?: number
  dailyMilkYield?: number
  daily_milk_yield?: number
  pregnancyStatus?: 'not_pregnant' | 'pregnant' | 'unknown'
  pregnancy_status?: string
  pregnancyMonth?: number
  pregnancy_month?: number
  vaccinationStatus?: 'fully_vaccinated' | 'partially_vaccinated' | 'not_vaccinated' | 'unknown'
  vaccination_status?: string
  healthCertificate?: boolean
  health_certificate?: boolean
  listingTier?: 'standard' | 'premium' | 'spotlight'
  listing_tier?: string
  isHotDeal?: boolean
  is_hot_deal?: boolean
  linkedAnimalId?: string
  linked_animal_id?: string
  animalUniqueId?: string
  animal_unique_id?: string
  auctionEndTime?: string
  auction_end_time?: string
  reservePrice?: number
  reserve_price?: number
  contactPhone?: string
  contact_phone?: string
  latitude?: number
  longitude?: number
  adminApproved?: boolean
  admin_approved?: boolean
  adminNotes?: string
  admin_notes?: string
  rejectionReason?: string
  rejection_reason?: string
  views_count?: number
  listing_type?: string
  seller_name?: string
  enterprise_name?: string
  bid_count?: number | string
  highest_bid?: number | string
  seller_id?: string
  created_at?: string
  updated_at?: string
}

export interface MarketplaceBid {
  id: string
  listingId: string
  bidderId: string
  amount: number
  message?: string
  isWinning: boolean
  status: 'active' | 'outbid' | 'won' | 'cancelled'
  bidderName?: string
  bidder_name?: string
  is_winning?: boolean
  createdAt: string
  created_at?: string
}

export interface MarketplaceOrder {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'disputed' | 'reserved'
  shippingAddress: Record<string, any>
  trackingNumber?: string
  notes?: string
  // Deal handshake (free classifieds - settlement happens off-platform)
  buyerConfirmedAt?: string
  buyer_confirmed_at?: string
  sellerConfirmedAt?: string
  seller_confirmed_at?: string
  paymentMethod?: string
  payment_method?: string
  reservedUntil?: string
  reserved_until?: string
  cancelReason?: string
  cancel_reason?: string
  listingTitle?: string
  listing_title?: string
  category?: string
  species?: string
  breed?: string
  buyerName?: string
  buyer_name?: string
  sellerName?: string
  seller_name?: string
  completedAt?: string
  completed_at?: string
  createdAt: string
  created_at?: string
  unit_price?: number
  total_price?: number
  images?: string[]
}

export interface MarketplaceThread {
  id: string
  listing_id: string
  listing_title?: string
  listing_images?: any
  listing_status?: string
  listing_price?: number
  buyer_id: string
  seller_id: string
  my_role?: 'buyer' | 'seller'
  my_unread?: number
  buyer_name?: string
  seller_name?: string
  last_message?: string
  last_message_at?: string
  last_sender_id?: string
  created_at?: string
}

export interface MarketplaceMessage {
  id: string
  thread_id: string
  sender_id: string
  sender_name?: string
  body: string
  read_at?: string
  created_at: string
}

export interface MarketplaceSavedSearch {
  id: string
  name: string
  filters: Record<string, any>
  alertsEnabled: boolean
  lastAlertedAt?: string
  createdAt?: string
}

export interface MarketplaceStats {
  overview: {
    total_listings: number
    active_listings: number
    sold_listings: number
    rejected_listings: number
    pending_review: number
    hot_deals: number
    auctions: number
    avg_price: number
    max_price: number
    total_views: number
  }
  bySpecies: Array<{ species: string; count: number; avg_price: number; avg_milk_yield: number; avg_weight: number }>
  priceDistribution: { under_10k: number; range_10k_50k: number; range_50k_100k: number; above_100k: number }
  auctions: { total_bids: number; listings_with_bids: number; avg_bid: number }
  orders: Array<{ status: string; count: number; total_value: number }>
}

export interface MarketPriceData {
  species: string
  breed: string
  total_listings: number
  avg_price: number
  min_price: number
  max_price: number
  avg_milk_yield: number
  avg_weight: number
}


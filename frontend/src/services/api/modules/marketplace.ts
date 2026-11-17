import axios from 'axios'
import { sharedClient, API_BASE_URL } from '../core'

export const marketplaceApi = {
  // ─── Public Marketplace (no auth required) ──────────────────
  async listPublicMarketplaceListings(filters: any = {}) {
    const response = await axios.get(`${API_BASE_URL}/public/marketplace/listings`, { params: filters })
    return response.data
  },

  async getPublicMarketplaceListing(id: string) {
    const response = await axios.get(`${API_BASE_URL}/public/marketplace/listings/${id}`)
    return response.data
  },

  async getPublicMarketplaceStats() {
    const response = await axios.get(`${API_BASE_URL}/public/marketplace/stats`)
    return response.data
  },

  // ─── Marketplace & Auctions ─────────────────────────────────
  async getMarketplaceDashboard(filters: any = {}) {
    const response = await sharedClient.get('/marketplace/dashboard', { params: filters })
    return response.data
  },

  async listMarketplaceListings(filters: any = {}) {
    const response = await sharedClient.get('/marketplace/listings', { params: filters })
    return response.data
  },

  async getMarketplaceListing(id: string) {
    const response = await sharedClient.get(`/marketplace/listings/${id}`)
    return response.data
  },

  async createMarketplaceListing(data: any) {
    const response = await sharedClient.post('/marketplace/listings', data)
    return response.data
  },

  async updateMarketplaceListing(id: string, data: any) {
    const response = await sharedClient.put(`/marketplace/listings/${id}`, data)
    return response.data
  },

  async deleteMarketplaceListing(id: string) {
    const response = await sharedClient.delete(`/marketplace/listings/${id}`)
    return response.data
  },

  async listMarketplaceBids(listingId: string) {
    const response = await sharedClient.get(`/marketplace/listings/${listingId}/bids`)
    return response.data
  },

  async placeMarketplaceBid(listingId: string, data: any) {
    const response = await sharedClient.post(`/marketplace/listings/${listingId}/bids`, data)
    return response.data
  },

  async listMarketplaceOrders(role: 'buyer' | 'seller' = 'buyer') {
    const response = await sharedClient.get('/marketplace/orders', { params: { role } })
    return response.data
  },

  async createMarketplaceOrder(data: any) {
    const response = await sharedClient.post('/marketplace/orders', data)
    return response.data
  },

  // Deal handshake: both parties confirm the off-platform settlement
  async confirmMarketplaceDeal(orderId: string, paymentMethod?: string) {
    const response = await sharedClient.post(`/marketplace/orders/${orderId}/confirm`, paymentMethod ? { paymentMethod } : {})
    return response.data
  },

  async cancelMarketplaceDeal(orderId: string, reason?: string) {
    const response = await sharedClient.post(`/marketplace/orders/${orderId}/cancel`, reason ? { reason } : {})
    return response.data
  },

  // ── Marketplace engagement (Phase 3): messaging, favorites, saved searches ──
  async listMarketplaceThreads() {
    const response = await sharedClient.get('/marketplace/threads')
    return response.data
  },

  async getMarketplaceUnreadCount() {
    const response = await sharedClient.get('/marketplace/threads/unread-count')
    return response.data
  },

  async startMarketplaceThread(listingId: string, message?: string) {
    const response = await sharedClient.post(`/marketplace/listings/${listingId}/threads`, message ? { message } : {})
    return response.data
  },

  async getMarketplaceThreadMessages(threadId: string) {
    const response = await sharedClient.get(`/marketplace/threads/${threadId}/messages`)
    return response.data
  },

  async sendMarketplaceMessage(threadId: string, message: string) {
    const response = await sharedClient.post(`/marketplace/threads/${threadId}/messages`, { message })
    return response.data
  },

  async listMarketplaceFavorites() {
    const response = await sharedClient.get('/marketplace/favorites')
    return response.data
  },

  async getMarketplaceFavoriteIds() {
    const response = await sharedClient.get('/marketplace/favorites/ids')
    return response.data
  },

  async addMarketplaceFavorite(listingId: string) {
    const response = await sharedClient.post(`/marketplace/listings/${listingId}/favorite`, {})
    return response.data
  },

  async removeMarketplaceFavorite(listingId: string) {
    const response = await sharedClient.delete(`/marketplace/listings/${listingId}/favorite`)
    return response.data
  },

  async listMarketplaceSavedSearches() {
    const response = await sharedClient.get('/marketplace/saved-searches')
    return response.data
  },

  async createMarketplaceSavedSearch(data: { name: string; filters?: any; alertsEnabled?: boolean }) {
    const response = await sharedClient.post('/marketplace/saved-searches', data)
    return response.data
  },

  async updateMarketplaceSavedSearch(id: string, data: { name?: string; filters?: any; alertsEnabled?: boolean }) {
    const response = await sharedClient.put(`/marketplace/saved-searches/${id}`, data)
    return response.data
  },

  async deleteMarketplaceSavedSearch(id: string) {
    const response = await sharedClient.delete(`/marketplace/saved-searches/${id}`)
    return response.data
  },

  // ── Phase 5: config, reports ──
  async getMarketplaceConfig() {
    const response = await sharedClient.get('/marketplace/config')
    return response.data
  },

  async reportMarketplaceListing(listingId: string, reason: string, details?: string) {
    const response = await sharedClient.post(`/marketplace/listings/${listingId}/report`, { reason, details })
    return response.data
  },

  async adminListMarketplaceReports(status?: string) {
    const response = await sharedClient.get('/marketplace/admin/reports', { params: status ? { status } : {} })
    return response.data
  },

  async adminResolveMarketplaceReport(id: string, status: string, resolution?: string) {
    const response = await sharedClient.patch(`/marketplace/admin/reports/${id}`, { status, resolution })
    return response.data
  },

  async updateOrderStatus(id: string, status: string) {
    const response = await sharedClient.patch(`/marketplace/orders/${id}/status`, { status })
    return response.data
  },

  async getMarketPrices(filters: any = {}) {
    const response = await sharedClient.get('/marketplace/prices', { params: filters })
    return response.data
  },

  async adminListMarketplaceListings(filters: any = {}) {
    const response = await sharedClient.get('/marketplace/admin/listings', { params: filters })
    return response.data
  },

  async adminGetMarketplaceStats() {
    const response = await sharedClient.get('/marketplace/admin/stats')
    return response.data
  },

  async adminApproveMarketplaceListing(id: string, notes?: string) {
    const response = await sharedClient.patch(`/marketplace/admin/listings/${id}/approve`, { notes })
    return response.data
  },

  async adminRejectMarketplaceListing(id: string, reason: string) {
    const response = await sharedClient.patch(`/marketplace/admin/listings/${id}/reject`, { reason })
    return response.data
  },

  async adminToggleHotDeal(id: string, isHotDeal: boolean) {
    const response = await sharedClient.patch(`/marketplace/admin/listings/${id}/hot-deal`, { isHotDeal })
    return response.data
  },

  async adminToggleFeatured(id: string, featured: boolean) {
    const response = await sharedClient.patch(`/marketplace/admin/listings/${id}/featured`, { featured })
    return response.data
  },

  // ─── Marketplace Monetization - Admin ───────────────────────
  async getMonetizationSettings() {
    const response = await sharedClient.get('/marketplace/admin/monetization/settings')
    return response.data
  },

  async updateMonetizationSetting(key: string, data: { settingValue?: any; isEnabled?: boolean }) {
    const response = await sharedClient.put(`/marketplace/admin/monetization/settings/${key}`, data)
    return response.data
  },

  async getMonetizationPlans() {
    const response = await sharedClient.get('/marketplace/admin/monetization/plans')
    return response.data
  },

  async createMonetizationPlan(data: any) {
    const response = await sharedClient.post('/marketplace/admin/monetization/plans', data)
    return response.data
  },

  async updateMonetizationPlan(id: string, data: any) {
    const response = await sharedClient.put(`/marketplace/admin/monetization/plans/${id}`, data)
    return response.data
  },

  async deleteMonetizationPlan(id: string) {
    const response = await sharedClient.delete(`/marketplace/admin/monetization/plans/${id}`)
    return response.data
  },

  async getMonetizationDashboard() {
    const response = await sharedClient.get('/marketplace/admin/monetization/dashboard')
    return response.data
  },

  // ─── Marketplace Monetization - User ────────────────────────
  async getUserSubscription() {
    const response = await sharedClient.get('/marketplace/subscription')
    return response.data
  },

  async createUserSubscription(planId: string) {
    const response = await sharedClient.post('/marketplace/subscription', { planId })
    return response.data
  },

  async cancelUserSubscription() {
    const response = await sharedClient.delete('/marketplace/subscription')
    return response.data
  },

  async boostListing(id: string, boostType: string = 'standard') {
    const response = await sharedClient.post(`/marketplace/listings/${id}/boost`, { boostType })
    return response.data
  },

  async createInquiry(listingId: string, message: string) {
    const response = await sharedClient.post(`/marketplace/listings/${listingId}/inquiries`, { message })
    return response.data
  },

  async listInquiries(role: 'buyer' | 'seller' = 'buyer') {
    const response = await sharedClient.get('/marketplace/inquiries', { params: { role } })
    return response.data
  },

  async respondToInquiry(id: string, revealContact: boolean) {
    const response = await sharedClient.patch(`/marketplace/inquiries/${id}/respond`, { revealContact })
    return response.data
  },

  async getUserMonetizationStatus() {
    const response = await sharedClient.get('/marketplace/monetization-status')
    return response.data
  },

  async getAuctionEnabled() {
    const response = await sharedClient.get('/marketplace/auction-enabled')
    return response.data
  },

  async setAuctionEnabled(enabled: boolean) {
    const response = await sharedClient.put('/marketplace/admin/auction-enabled', { enabled })
    return response.data
  }

}

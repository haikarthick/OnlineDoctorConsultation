import { sharedClient } from '../core'

export const groomingApi = {
  // ── Grooming & Spa ──
  async groomingStatus() {
    const response = await sharedClient.get('/grooming/status')
    return response.data
  },
  async createGroomingProvider(data: any) {
    const response = await sharedClient.post('/grooming/providers', data)
    return response.data
  },
  async getMyGroomingProvider() {
    const response = await sharedClient.get('/grooming/providers/me')
    return response.data
  },
  async updateGroomingProvider(id: string, data: any) {
    const response = await sharedClient.put(`/grooming/providers/${id}`, data)
    return response.data
  },
  async listGroomingLocations(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/locations`)
    return response.data
  },
  async addGroomingLocation(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/providers/${id}/locations`, data)
    return response.data
  },
  async deleteGroomingLocation(id: string, locId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${id}/locations/${locId}`)
    return response.data
  },
  async listGroomingResources(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/resources`)
    return response.data
  },
  async addGroomingResource(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/providers/${id}/resources`, data)
    return response.data
  },
  async deleteGroomingResource(id: string, resId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${id}/resources/${resId}`)
    return response.data
  },
  async listGroomingServices(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/services`)
    return response.data
  },
  async addGroomingService(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/providers/${id}/services`, data)
    return response.data
  },
  async updateGroomingService(id: string, svcId: string, data: any) {
    const response = await sharedClient.put(`/grooming/providers/${id}/services/${svcId}`, data)
    return response.data
  },
  async deleteGroomingService(id: string, svcId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${id}/services/${svcId}`)
    return response.data
  },
  async listGroomingStaff(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/staff`)
    return response.data
  },
  async addGroomingStaff(id: string, email: string, role: string) {
    const response = await sharedClient.post(`/grooming/providers/${id}/staff`, { email, role })
    return response.data
  },
  async removeGroomingStaff(id: string, userId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${id}/staff/${userId}`)
    return response.data
  },
  async discoverGroomingProviders(params: Record<string, any> = {}) {
    const response = await sharedClient.get('/grooming/discover', { params })
    return response.data
  },
  async getPublicGroomingProvider(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/public`)
    return response.data
  },
  async adminListGroomingProviders(status = 'pending') {
    const response = await sharedClient.get('/grooming/admin/providers', { params: { status } })
    return response.data
  },
  async adminVerifyGroomingProvider(id: string) {
    const response = await sharedClient.put(`/grooming/admin/providers/${id}/verify`, {})
    return response.data
  },
  async adminRejectGroomingProvider(id: string, reason: string) {
    const response = await sharedClient.put(`/grooming/admin/providers/${id}/reject`, { reason })
    return response.data
  },
  async adminSuspendGroomingProvider(id: string, reason: string) {
    const response = await sharedClient.put(`/grooming/admin/providers/${id}/suspend`, { reason })
    return response.data
  },
  async createGroomingOrder(data: any) {
    const response = await sharedClient.post('/grooming/orders', data)
    return response.data
  },
  async listMyGroomingOrders() {
    const response = await sharedClient.get('/grooming/orders')
    return response.data
  },
  async getGroomingOrder(id: string) {
    const response = await sharedClient.get(`/grooming/orders/${id}`)
    return response.data
  },
  async createGroomingCheckout(id: string, deposit = false) {
    const response = await sharedClient.post(`/grooming/orders/${id}/checkout`, { deposit })
    return response.data
  },
  async confirmGroomingPayment(id: string, body: any) {
    const response = await sharedClient.post(`/grooming/orders/${id}/confirm-payment`, body)
    return response.data
  },
  async createGroomingBalanceCheckout(id: string) {
    const response = await sharedClient.post(`/grooming/orders/${id}/balance-checkout`, {})
    return response.data
  },
  async confirmGroomingBalancePayment(id: string, body: any) {
    const response = await sharedClient.post(`/grooming/orders/${id}/confirm-balance`, body)
    return response.data
  },
  async getGroomingRefundPreview(id: string) {
    const response = await sharedClient.get(`/grooming/orders/${id}/refund-preview`)
    return response.data
  },
  async cancelGroomingOrder(id: string, reason?: string) {
    const response = await sharedClient.put(`/grooming/orders/${id}/cancel`, { reason })
    return response.data
  },
  async listGroomingProviderOrders(id: string, status?: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/orders`, { params: status ? { status } : {} })
    return response.data
  },
  async getGroomingOrderDetail(id: string) {
    const response = await sharedClient.get(`/grooming/orders/${id}/detail`)
    return response.data
  },
  async transitionGroomingOrder(id: string, toStatus: string, note?: string) {
    const response = await sharedClient.put(`/grooming/orders/${id}/transition`, { toStatus, note })
    return response.data
  },

  // ── Payables: who the platform currently owes, and payout evidence ──
  async getGroomingPayables() {
    const response = await sharedClient.get('/grooming/admin/payables')
    return response.data
  },

  async getDoctorPayables() {
    const response = await sharedClient.get('/admin/withdrawals/payables')
    return response.data
  },

  async getGroomingSettlementStatement(settlementId: string) {
    const response = await sharedClient.get(`/grooming/settlements/${settlementId}/statement`)
    return response.data
  },

  // ── Wallet withdrawals (038) - money out of the platform ──
  async requestWalletWithdrawal(data: {
    amount: number; method?: string; accountName?: string; accountNumber?: string; ifsc?: string; upiId?: string
  }) {
    const response = await sharedClient.post('/wallet/withdrawals', data)
    return response.data
  },

  async listMyWalletWithdrawals() {
    const response = await sharedClient.get('/wallet/withdrawals')
    return response.data
  },

  async cancelWalletWithdrawal(id: string) {
    const response = await sharedClient.post(`/wallet/withdrawals/${id}/cancel`, {})
    return response.data
  },

  async adminListWalletWithdrawals(status?: string) {
    const response = await sharedClient.get('/admin/wallet-withdrawals', { params: { status } })
    return response.data
  },

  async adminApproveWalletWithdrawal(id: string, note?: string) {
    const response = await sharedClient.put(`/admin/wallet-withdrawals/${id}/approve`, { note })
    return response.data
  },

  async adminRejectWalletWithdrawal(id: string, reason: string) {
    const response = await sharedClient.put(`/admin/wallet-withdrawals/${id}/reject`, { reason })
    return response.data
  },

  async adminSettleWalletWithdrawal(id: string, utrReference: string, note?: string) {
    const response = await sharedClient.put(`/admin/wallet-withdrawals/${id}/settle`, { utrReference, note })
    return response.data
  },

  // ── Grooming availability & working hours (037) ──
  /** Bookable slots for one provider/date. Sized to the service when one is given. */
  async getGroomingAvailability(providerId: string, date: string, opts: { serviceId?: string; locationId?: string } = {}) {
    const response = await sharedClient.get(`/grooming/providers/${providerId}/availability`, {
      params: { date, serviceId: opts.serviceId, locationId: opts.locationId },
    })
    return response.data
  },

  /** Which days in a month have any capacity - drives the booking calendar. */
  async getGroomingMonthAvailability(providerId: string, year: number, month: number, opts: { serviceId?: string; locationId?: string } = {}) {
    const response = await sharedClient.get(`/grooming/providers/${providerId}/availability/month`, {
      params: { year, month, serviceId: opts.serviceId, locationId: opts.locationId },
    })
    return response.data
  },

  async listGroomingSchedules(providerId: string) {
    const response = await sharedClient.get(`/grooming/providers/${providerId}/schedules`)
    return response.data
  },

  async saveGroomingSchedule(providerId: string, data: any) {
    const response = await sharedClient.put(`/grooming/providers/${providerId}/schedules`, data)
    return response.data
  },

  async deleteGroomingSchedule(providerId: string, scheduleId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${providerId}/schedules/${scheduleId}`)
    return response.data
  },

  async listGroomingDateOverrides(providerId: string, from?: string, to?: string) {
    const response = await sharedClient.get(`/grooming/providers/${providerId}/date-overrides`, { params: { from, to } })
    return response.data
  },

  async saveGroomingDateOverride(providerId: string, data: any) {
    const response = await sharedClient.put(`/grooming/providers/${providerId}/date-overrides`, data)
    return response.data
  },

  async deleteGroomingDateOverride(providerId: string, overrideId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${providerId}/date-overrides/${overrideId}`)
    return response.data
  },

  async listGroomingBlockedSlots(providerId: string) {
    const response = await sharedClient.get(`/grooming/providers/${providerId}/blocked-slots`)
    return response.data
  },

  async createGroomingBlockedSlot(providerId: string, data: any) {
    const response = await sharedClient.post(`/grooming/providers/${providerId}/blocked-slots`, data)
    return response.data
  },

  async deleteGroomingBlockedSlot(providerId: string, slotId: string) {
    const response = await sharedClient.delete(`/grooming/providers/${providerId}/blocked-slots/${slotId}`)
    return response.data
  },

  /** Provider accepts a paid booking sitting at the acceptance gate → confirmed. */
  async acceptGroomingOrder(id: string, note?: string) {
    const response = await sharedClient.put(`/grooming/orders/${id}/accept`, { note })
    return response.data
  },

  /** Provider declines a paid booking → customer is refunded in full. Reason is required. */
  async declineGroomingOrder(id: string, reason: string) {
    const response = await sharedClient.put(`/grooming/orders/${id}/decline`, { reason })
    return response.data
  },
  async assignGroomingOrder(id: string, data: any) {
    const response = await sharedClient.put(`/grooming/orders/${id}/assign`, data)
    return response.data
  },
  async saveGroomingIntake(id: string, data: any) {
    const response = await sharedClient.put(`/grooming/orders/${id}/intake`, data)
    return response.data
  },
  async updateGroomingItem(id: string, itemId: string, status: string, reason?: string) {
    const response = await sharedClient.put(`/grooming/orders/${id}/items/${itemId}`, { status, reason })
    return response.data
  },
  async createGroomingReportCard(id: string, data: any) {
    const response = await sharedClient.put(`/grooming/orders/${id}/report-card`, data)
    return response.data
  },
  async getGroomingEarnings(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/earnings`)
    return response.data
  },
  async listGroomingSettlements(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/settlements`)
    return response.data
  },
  async adminSettleGrooming(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/admin/providers/${id}/settle`, data)
    return response.data
  },
  async adminGroomingReconciliation() {
    const response = await sharedClient.get('/grooming/admin/reconciliation')
    return response.data
  },
  async requestGroomingVariableItem(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/orders/${id}/variable-items`, data)
    return response.data
  },
  async respondGroomingVariableItem(id: string, itemId: string, approve: boolean) {
    const response = await sharedClient.put(`/grooming/orders/${id}/variable-items/${itemId}/respond`, { approve })
    return response.data
  },
  async raiseGroomingEscalation(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/orders/${id}/escalations`, data)
    return response.data
  },
  async listGroomingEscalations(id: string) {
    const response = await sharedClient.get(`/grooming/orders/${id}/escalations`)
    return response.data
  },
  async respondGroomingEscalation(escId: string, status: string, consultationBookingId?: string) {
    const response = await sharedClient.put(`/grooming/escalations/${escId}/respond`, { status, consultationBookingId })
    return response.data
  },
  async getGroomingPetPassport(animalId: string) {
    const response = await sharedClient.get(`/grooming/pets/${animalId}/passport`)
    return response.data
  },
  async raiseGroomingDispute(id: string, data: any) {
    const response = await sharedClient.post(`/grooming/orders/${id}/disputes`, data)
    return response.data
  },
  async listMyGroomingDisputes() {
    const response = await sharedClient.get('/grooming/disputes/mine')
    return response.data
  },
  async listGroomingProviderDisputes(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/disputes`)
    return response.data
  },
  async respondGroomingDispute(disputeId: string, data: any) {
    const response = await sharedClient.put(`/grooming/disputes/${disputeId}/respond`, data)
    return response.data
  },
  /** Platform-wide dispute queue. Optional status filter; omit for all. */
  async adminListGroomingDisputes(status?: string) {
    const response = await sharedClient.get('/grooming/admin/disputes', { params: status ? { status } : undefined })
    return response.data
  },
  /** A single provider's earnings ledger, for reviewing what is owed before settling. */
  async adminGroomingProviderEarnings(providerId: string) {
    const response = await sharedClient.get(`/grooming/admin/providers/${providerId}/earnings`)
    return response.data
  },
  async getGroomingProviderReport(id: string) {
    const response = await sharedClient.get(`/grooming/providers/${id}/report`)
    return response.data
  },
  async getGroomingPlatformReport() {
    const response = await sharedClient.get('/grooming/admin/report')
    return response.data
  }

}

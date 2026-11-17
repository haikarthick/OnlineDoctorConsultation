import { sharedClient } from '../core'

export const paymentsApi = {
  // ─── Payments ─────────────────────────────────────────────
  async createPayment(data: { consultationId: string; bookingId?: string; amount: number; currency?: string; paymentMethod?: string }) {
    const response = await sharedClient.post('/payments', data)
    return response.data
  },

  async listPayments(params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get('/payments', { params })
    return response.data
  },

  async getPaymentByBooking(bookingId: string) {
    const response = await sharedClient.get(`/payments/booking/${bookingId}`)
    return response.data
  },

  // ─── Payment module: checkout lifecycle ────────────────────
  async initiatePaymentCheckout(bookingId: string, useWallet: boolean) {
    const response = await sharedClient.post(`/payments/checkout/${bookingId}`, { useWallet })
    return response.data
  },

  async verifyPayment(data: { paymentId: string; gatewayOrderId?: string; gatewayPaymentId?: string; gatewaySignature?: string }) {
    const response = await sharedClient.post('/payments/verify', data)
    return response.data
  },

  async getRefundPreview(bookingId: string) {
    const response = await sharedClient.get(`/payments/refund-preview/${bookingId}`)
    return response.data
  },

  async getPaymentReceipt(paymentId: string) {
    const response = await sharedClient.get(`/payments/receipt/${paymentId}`)
    return response.data
  },

  // ─── Doctor earnings ledger ─────────────────────────────────
  async getEarningsSummary() {
    const response = await sharedClient.get('/earnings/summary')
    return response.data
  },

  async getEarningsStatement(params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get('/earnings/statement', { params })
    return response.data
  },

  // ─── Invoices & GST ─────────────────────────────────────────
  async getInvoiceByPayment(paymentId: string) {
    const response = await sharedClient.get(`/invoices/payment/${paymentId}`)
    return response.data
  },

  async adminListTaxCodes() {
    const response = await sharedClient.get('/admin/tax-codes')
    return response.data
  },

  async adminUpdateTaxCode(sacCode: string, ratePercent: number) {
    const response = await sharedClient.put(`/admin/tax-codes/${sacCode}`, { ratePercent })
    return response.data
  },

  async adminFinanceOverview(from: string, to: string) {
    const response = await sharedClient.get('/admin/reports/finance/overview', { params: { from, to } })
    return response.data
  },

  async adminDownloadGstExport(from: string, to: string) {
    const response = await sharedClient.get('/admin/reports/gst-export', { params: { from, to }, responseType: 'blob' })
    return response.data
  },

  // ─── Platform referrals ─────────────────────────────────────
  async createPlatformReferral(data: { toVetId?: string | null; reason: string; bookingId?: string; consultationId?: string }) {
    const response = await sharedClient.post('/referrals/platform', data)
    return response.data
  },

  async listMyPlatformReferrals() {
    const response = await sharedClient.get('/referrals/platform/my')
    return response.data
  },

  async getReferableItems() {
    const response = await sharedClient.get('/referrals/platform/referable')
    return response.data
  },

  async acceptPlatformReferral(id: string, data: { veterinarianId?: string; scheduledDate: string; timeSlotStart: string; timeSlotEnd: string; bookingType?: string; reasonForVisit?: string }) {
    const response = await sharedClient.post(`/referrals/platform/${id}/accept`, data)
    return response.data
  },

  async declinePlatformReferral(id: string, refundDestination?: 'wallet' | 'gateway') {
    const response = await sharedClient.post(`/referrals/platform/${id}/decline`, { refundDestination })
    return response.data
  },

  async requestWithdrawal() {
    const response = await sharedClient.post('/withdrawals/request', {})
    return response.data
  },

  async cancelWithdrawal(id: string) {
    const response = await sharedClient.post(`/withdrawals/${id}/cancel`, {})
    return response.data
  },

  async listMyWithdrawals() {
    const response = await sharedClient.get('/withdrawals/my')
    return response.data
  },

  async adminListWithdrawals(status?: string) {
    const response = await sharedClient.get('/admin/withdrawals', { params: { status } })
    return response.data
  },

  async adminNegativeBalances() {
    const response = await sharedClient.get('/admin/withdrawals/negative-balances')
    return response.data
  },

  async adminApproveWithdrawal(id: string, note?: string) {
    const response = await sharedClient.put(`/admin/withdrawals/${id}/approve`, { note })
    return response.data
  },

  async adminRejectWithdrawal(id: string, reason: string) {
    const response = await sharedClient.put(`/admin/withdrawals/${id}/reject`, { reason })
    return response.data
  },

  async adminSettleWithdrawal(id: string, utrReference: string, note?: string) {
    const response = await sharedClient.put(`/admin/withdrawals/${id}/settle`, { utrReference, note })
    return response.data
  },

  async adminDiscretionaryPayout(doctorId: string, utrReference: string, note: string) {
    const response = await sharedClient.post('/admin/withdrawals/discretionary', { doctorId, utrReference, note })
    return response.data
  },

  async adminListCommissionDoctors(search?: string) {
    const response = await sharedClient.get('/admin/commission/doctors', { params: { search } })
    return response.data
  },

  async adminUpdateCommissionOverride(userId: string, data: { commissionPercentOverride: number | null; commissionFlatOverride: number | null }) {
    const response = await sharedClient.put(`/admin/commission/doctors/${userId}`, data)
    return response.data
  },

  // ─── Legal documents & consent ──────────────────────────────
  async getLegalDocuments() {
    const response = await sharedClient.get('/legal/documents')
    return response.data
  },

  async getLegalDocument(docType: string) {
    const response = await sharedClient.get(`/legal/documents/${docType}`)
    return response.data
  },

  async getPendingPolicyAcceptances() {
    const response = await sharedClient.get('/legal/acceptances/pending')
    return response.data
  },

  async acceptPolicies(docTypes: string[], context?: string) {
    const response = await sharedClient.post('/legal/acceptances', { docTypes, context })
    return response.data
  },

  async adminListLegalDocuments() {
    const response = await sharedClient.get('/admin/legal-documents')
    return response.data
  },

  async adminPublishLegalDocument(data: { docType: string; title: string; content: string; requiresReacceptance?: boolean }) {
    const response = await sharedClient.post('/admin/legal-documents', data)
    return response.data
  },

  async adminGetAcceptanceStats() {
    const response = await sharedClient.get('/admin/legal-documents/acceptance-stats')
    return response.data
  },

  // ─── Wallet ───────────────────────────────────────────────
  async getWallet() {
    const response = await sharedClient.get('/wallet')
    return response.data
  },

  async getWalletTransactions(params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get('/wallet/transactions', { params })
    return response.data
  },

  // ─── Doctor Reliability ───────────────────────────────────
  async getDoctorReliability(vetId: string) {
    const response = await sharedClient.get(`/doctors/${vetId}/reliability`)
    return response.data
  },

  // ─── Reviews ──────────────────────────────────────────────
  async createReview(data: { consultationId: string; veterinarianId: string; rating: number; comment?: string; isPublic?: boolean }) {
    const response = await sharedClient.post('/reviews', data)
    return response.data
  },

  async getReviewableConsultations() {
    const response = await sharedClient.get('/reviews/reviewable')
    return response.data
  },

  async listVetReviews(vetId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/reviews/vet/${vetId}`, { params })
    return response.data
  },

  async addVetResponse(reviewId: string, response: string) {
    const res = await sharedClient.put(`/reviews/${reviewId}/vet-response`, { response })
    return res.data
  },

  async markReviewHelpful(reviewId: string) {
    const response = await sharedClient.post(`/reviews/${reviewId}/helpful`)
    return response.data
  },

  async reportReview(reviewId: string) {
    const response = await sharedClient.post(`/reviews/${reviewId}/report`)
    return response.data
  }

}

import { sharedClient } from '../core'

export const scheduleApi2 = {
  // ─── Schedule & Availability ──────────────────────────────
  async createSchedule(data: { dayOfWeek: string; startTime: string; endTime: string; slotDuration?: number; maxAppointments?: number }) {
    const response = await sharedClient.post('/schedules', data)
    return response.data
  },

  async getMySchedules() {
    const response = await sharedClient.get('/schedules/me')
    return response.data
  },

  async getVetSchedules(vetId: string) {
    const response = await sharedClient.get(`/schedules/vet/${vetId}`)
    return response.data
  },

  async updateSchedule(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/schedules/${id}`, data)
    return response.data
  },

  async deleteSchedule(id: string) {
    const response = await sharedClient.delete(`/schedules/${id}`)
    return response.data
  },

  async getVetAvailability(vetId: string, date: string) {
    const response = await sharedClient.get(`/availability/${vetId}/${date}`)
    return response.data
  },

  async getMonthlyAvailability(vetId: string, year: number, month: number) {
    const response = await sharedClient.get(`/availability/${vetId}/monthly/summary`, { params: { year, month } })
    return response.data
  },

  // ─── Date Overrides & Time Blocks ─────────────────────────
  async createDateOverride(data: { veterinarianId?: string; overrideDate: string; overrideType: string; startTime?: string; endTime?: string; slotDuration?: number; reason?: string }) {
    const response = await sharedClient.post('/schedules/date-overrides', data)
    return response.data
  },

  async bulkCreateDateOverrides(data: { veterinarianId?: string; dates: string[]; overrideType: string; startTime?: string; endTime?: string; slotDuration?: number; reason?: string }) {
    const response = await sharedClient.post('/schedules/date-overrides/bulk', data)
    return response.data
  },

  async listDateOverrides(vetId?: string, fromDate?: string, toDate?: string) {
    const url = vetId ? `/schedules/date-overrides/vet/${vetId}` : '/schedules/date-overrides/me'
    const response = await sharedClient.get(url, { params: { fromDate, toDate } })
    return response.data
  },

  async deleteDateOverride(id: string) {
    const response = await sharedClient.delete(`/schedules/date-overrides/${id}`)
    return response.data
  },

  async createBlockedSlot(data: { veterinarianId?: string; blockDate?: string; startTime: string; endTime: string; reason?: string; isRecurring?: boolean; recurringDay?: string }) {
    const response = await sharedClient.post('/schedules/blocked-slots', data)
    return response.data
  },

  async listBlockedSlots(vetId?: string) {
    const url = vetId ? `/schedules/blocked-slots/vet/${vetId}` : '/schedules/blocked-slots/me'
    const response = await sharedClient.get(url)
    return response.data
  },

  async deleteBlockedSlot(id: string) {
    const response = await sharedClient.delete(`/schedules/blocked-slots/${id}`)
    return response.data
  },

  // ─── Hospital Holidays ────────────────────────────────────
  async createHoliday(data: { hospitalId?: string; holidayDate: string; name: string; holidayType?: string; isFullDay?: boolean; startTime?: string; endTime?: string }) {
    const response = await sharedClient.post('/holidays', data)
    return response.data
  },

  async listHolidays(params?: { hospitalId?: string; fromDate?: string; toDate?: string; year?: number }) {
    const response = await sharedClient.get('/holidays', { params })
    return response.data
  },

  async updateHoliday(id: string, data: { holidayDate?: string; name?: string; holidayType?: string; isFullDay?: boolean; startTime?: string; endTime?: string }) {
    const response = await sharedClient.put(`/holidays/${id}`, data)
    return response.data
  },

  async deleteHoliday(id: string) {
    const response = await sharedClient.delete(`/holidays/${id}`)
    return response.data
  }

}

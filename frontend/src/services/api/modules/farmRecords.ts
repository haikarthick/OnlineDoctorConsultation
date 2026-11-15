import { sharedClient } from '../core'

// Farm daily records (milk, eggs, feed, sample weight, water quality) - backend routes/farm-records.routes.ts.
export const farmRecordsApi = {
  /** Whether the module is switched on (farm.records.enabled). Needs a signed-in user. */
  async farmRecordsStatus() {
    const response = await sharedClient.get('/farm-records/enabled')
    return response.data
  },
  async listFarmRecords(params: { enterpriseId?: string; animalId?: string; groupId?: string; recordType?: string; from?: string; to?: string; limit?: number }) {
    const response = await sharedClient.get('/farm-records', { params })
    return response.data
  },
  async farmRecordsSummary(enterpriseId: string, days = 7) {
    const response = await sharedClient.get('/farm-records/summary', { params: { enterpriseId, days } })
    return response.data
  },
  /** Saving the same animal/group, type, day and session again corrects the earlier entry. */
  async saveFarmRecord(data: {
    enterpriseId?: string; animalId?: string; groupId?: string; recordType: string; recordDate?: string
    session?: string; quantity?: number | null; detail?: Record<string, unknown>; notes?: string
  }) {
    const response = await sharedClient.post('/farm-records', data)
    return response.data
  },
  async deleteFarmRecord(id: string) {
    const response = await sharedClient.delete(`/farm-records/${id}`)
    return response.data
  },
}

import { sharedClient } from '../core'

// Farm daily records (milk, eggs, feed, sample weight, water quality) - backend routes/farm-records.routes.ts.
export const farmRecordsApi = {
  /** Whether the module is switched on (farm.records.enabled). Needs a signed-in user. */
  async farmRecordsStatus() {
    const response = await sharedClient.get('/farm-records/enabled')
    return response.data
  },
  async listFarmRecords(params: { enterpriseId?: string; animalId?: string; groupId?: string; recordType?: string; from?: string; to?: string; limit?: number; wholeFarm?: boolean }) {
    const response = await sharedClient.get('/farm-records', { params })
    return response.data
  },
  /** What is coming up on the farm: expected births, vaccinations due, withdrawals ending. */
  async farmRecordsDue(enterpriseId: string) {
    const response = await sharedClient.get('/farm-records/due', { params: { enterpriseId } })
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
    /** Feed: the stock item used (empty = home-grown). No animal and no group = all the farm's animals. */
    feedId?: string | null
  }) {
    const response = await sharedClient.post('/farm-records', data)
    return response.data
  },
  /** An event on a batch group (place flock, cull, sale, harvest, clear-out) or on one animal (heat, mating, pregnancy check, birth, dry-off, weight, sale, death). */
  async saveGroupEvent(data: { groupId?: string; animalId?: string; eventType: string; eventDate?: string; quantity?: number | null; detail?: Record<string, unknown>; notes?: string; offspring?: Array<{ name?: string; gender?: string }> }, idempotencyKey?: string) {
    // The key makes a retry (an entry sent again after the phone was offline) safe: the server answers it once.
    const response = await sharedClient.post('/farm-records/events', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined)
    return response.data
  },
  async deleteFarmRecord(id: string) {
    const response = await sharedClient.delete(`/farm-records/${id}`)
    return response.data
  },
}

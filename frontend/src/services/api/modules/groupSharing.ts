import { sharedClient } from '../core'

// Sharing a group (herd / flock) with a hospital network for one production cycle (backend
// routes/group-network-sharing.routes.ts). The farm owner makes a code; the network redeems it.
export const groupSharingApi = {
  // ── Farm side (owner) ──
  async createGroupShareCode(groupId: string, scope: { medicalRecords?: boolean; vaccinationRecords?: boolean; prescriptions?: boolean }) {
    const response = await sharedClient.post(`/animal-groups/${groupId}/network-share-codes`, scope)
    return response.data
  },
  async listGroupNetworkShares(groupId: string) {
    const response = await sharedClient.get(`/animal-groups/${groupId}/network-shares`)
    return response.data
  },
  async cancelGroupShareCode(groupId: string, codeId: string) {
    const response = await sharedClient.delete(`/animal-groups/${groupId}/network-share-codes/${codeId}`)
    return response.data
  },
  async stopGroupNetworkShare(groupId: string, contextId: string) {
    const response = await sharedClient.delete(`/animal-groups/${groupId}/network-shares/${contextId}`)
    return response.data
  },
  // ── Network side ──
  async enrollGroupByCode(networkId: string, data: { code: string; hospitalId?: string }) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/enroll-group`, data)
    return response.data
  },
  async listNetworkSharedGroups(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/shared-groups`)
    return response.data
  },
  async getSharedGroupRecords(networkId: string, groupId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/shared-groups/${groupId}/records`)
    return response.data
  },
}

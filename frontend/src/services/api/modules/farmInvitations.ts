import { sharedClient } from '../core'

// Farm team invitations (backend routes/farm-invitations.routes.ts). The owner / managers invite by mobile
// number and/or email; the invited person answers from the link or from their own list.
export const farmInvitationsApi = {
  async inviteToFarm(enterpriseId: string, data: { phone?: string; email?: string; name?: string; role: string }) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/invitations`, data)
    return response.data
  },
  async listFarmInvitations(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/invitations`)
    return response.data
  },
  async resendFarmInvitation(enterpriseId: string, invitationId: string) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/invitations/${invitationId}/resend`)
    return response.data
  },
  async cancelFarmInvitation(enterpriseId: string, invitationId: string) {
    const response = await sharedClient.delete(`/enterprises/${enterpriseId}/invitations/${invitationId}`)
    return response.data
  },
  /** Public: what the link shows before anyone signs in. */
  async previewFarmInvitation(token: string) {
    const response = await sharedClient.get(`/farm-invitations/by-token/${encodeURIComponent(token)}`)
    return response.data
  },
  async myFarmInvitations() {
    const response = await sharedClient.get('/farm-invitations/mine')
    return response.data
  },
  async acceptFarmInvitation(token: string) {
    const response = await sharedClient.post('/farm-invitations/accept', { token })
    return response.data
  },
  async declineFarmInvitation(token: string) {
    const response = await sharedClient.post('/farm-invitations/decline', { token })
    return response.data
  },
  async acceptFarmInvitationById(id: string) {
    const response = await sharedClient.post(`/farm-invitations/${id}/accept`)
    return response.data
  },
  async declineFarmInvitationById(id: string) {
    const response = await sharedClient.post(`/farm-invitations/${id}/decline`)
    return response.data
  },
  async registerFromFarmInvitation(data: { token: string; firstName: string; lastName: string; password: string; email?: string }) {
    const response = await sharedClient.post('/farm-invitations/register', data)
    return response.data
  },
}

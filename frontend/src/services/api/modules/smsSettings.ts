import { sharedClient } from '../core'

// Admin -> SMS Settings (backend routes/sms-settings.routes.ts). Secrets are write-only: they are sent
// here but never returned.
export const smsSettingsApi = {
  async getSmsSettings() {
    const response = await sharedClient.get('/admin/sms-settings')
    return response.data
  },
  /** `changes` maps setting keys to new values; a blank secret keeps the current one, null clears it. */
  async saveSmsSettings(changes: Record<string, string | null>) {
    const response = await sharedClient.put('/admin/sms-settings', { changes })
    return response.data
  },
  async testSms(to: string) {
    const response = await sharedClient.post('/admin/sms-settings/test', { to })
    return response.data
  },
  async getSmsLog() {
    const response = await sharedClient.get('/admin/sms-settings/log')
    return response.data
  },
}

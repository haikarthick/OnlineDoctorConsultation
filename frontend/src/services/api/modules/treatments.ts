import { sharedClient } from '../core'

// Treatments and withdrawal - backend routes/treatments.routes.ts (docs/modules/withdrawal-ledger.md).
// A treatment is written once, on the vet's prescription; the farm's "under withdrawal" and "my medicines" come from it.
export interface SelfTreatmentPayload {
  /** The outbox id of a queued entry (a replay never makes a second row). */
  id?: string
  animalId?: string | null; groupId?: string | null; medicineName: string; treatmentDays: number
  withdrawalMilkDays: number; withdrawalMeatDays: number; startedOn?: string | null; note?: string | null
}

export const treatmentsApi = {
  /** One animal: is it under a milk / egg or meat withdrawal, and is it a food-producing animal (label days are required for it). */
  async animalWithdrawal(animalId: string) {
    const response = await sharedClient.get(`/animals/${animalId}/withdrawal`)
    return response.data
  },
  /** The farm's under-withdrawal list and treatment history (the vet's prescriptions and the farmer's own entries). */
  async farmTreatments(enterpriseId: string, limit = 60) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/treatments`, { params: { limit } })
    return response.data
  },
  async addSelfTreatment(enterpriseId: string, data: SelfTreatmentPayload) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/treatments`, data)
    return response.data
  },
  /** "Stopped early" / "last dose on"; null puts the course back as prescribed. */
  async correctTreatmentCourse(prescriptionId: string, lastDoseOn: string | null) {
    const response = await sharedClient.patch(`/treatments/prescriptions/${prescriptionId}/course`, { lastDoseOn })
    return response.data
  },
  async correctSelfTreatmentCourse(id: string, lastDoseOn: string | null) {
    const response = await sharedClient.patch(`/treatments/self/${id}/course`, { lastDoseOn })
    return response.data
  },
  /** Medicated-feed courses still running for an animal or a herd. */
  async feedCourses(subject: { animalId?: string; groupId?: string }) {
    const response = subject.animalId
      ? await sharedClient.get(`/treatments/animals/${subject.animalId}/feed-courses`)
      : await sharedClient.get(`/treatments/groups/${subject.groupId}/feed-courses`)
    return response.data
  },
  /** The vet's own recent medicines with the label days they typed last time (pre-fills a prescription line). */
  async myRecentPrescriptionLines() {
    const response = await sharedClient.get('/treatments/my-recent-lines')
    return response.data
  },
}

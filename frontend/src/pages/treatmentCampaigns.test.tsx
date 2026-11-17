import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TreatmentCampaigns from './TreatmentCampaigns'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'farmer' } }) }))
vi.mock('../context/SettingsContext', () => ({ useSettings: () => ({ formatDate: (d: string) => `D:${String(d).slice(0, 10)}` }) }))

const create = vi.fn()
const update = vi.fn()
const api = {
  listEnterprises: vi.fn(), listCampaigns: vi.fn(), listAnimalGroups: vi.fn(), listEnterpriseMembers: vi.fn(),
  createCampaign: (...a: unknown[]) => create(...a), updateCampaign: (...a: unknown[]) => update(...a), deleteCampaign: vi.fn(),
}
vi.mock('../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

beforeEach(() => {
  vi.clearAllMocks()
  api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'f1', name: 'Farm', ownerId: 'u1' }] } })
  api.listCampaigns.mockResolvedValue({ data: { items: [
    { id: 'c1', name: 'FMD round', campaignType: 'vaccination', status: 'in_progress', groupName: 'Herd A', productUsed: 'FMD vaccine', dosage: '2 ml', targetCount: 40, completedCount: 10, scheduledDate: '2026-11-20' },
    { id: 'c2', name: 'Dip', campaignType: 'dipping', status: 'planned', targetCount: 0, completedCount: 0 },
  ] } })
  api.listAnimalGroups.mockResolvedValue({ data: { items: [{ id: 'g1', name: 'Herd A', currentCount: 40 }] } })
  api.listEnterpriseMembers.mockResolvedValue({ data: [] })
  create.mockResolvedValue({})
  update.mockResolvedValue({})
})

describe('TreatmentCampaigns', () => {
  it('shows cards with the treated count the server really returns', async () => {
    const { container } = render(<TreatmentCampaigns />)
    await screen.findByText(/FMD round/)
    expect(container.querySelectorAll('.camp-card')).toHaveLength(2)
    expect(screen.getByText('10/40')).toBeTruthy()
    expect(screen.getByText('FMD vaccine')).toBeTruthy()
    expect(container.querySelector('.camp-progress-5')).not.toBeNull() // 10 of 40 = 25% = step 5
  })

  it('creates with the field names the server accepts (groupId, productUsed) and fills the head count from the group', async () => {
    render(<TreatmentCampaigns />)
    await screen.findByText(/FMD round/)
    fireEvent.click(screen.getByText('treatmentCampaigns.newCampaign'))
    fireEvent.change(await screen.findByLabelText('treatmentCampaigns.modal.name'), { target: { value: 'Deworm round' } })
    fireEvent.click(screen.getByRole('button', { name: /mobileUi.step.next/ }))
    fireEvent.change(await screen.findByLabelText('treatmentCampaigns.modal.group'), { target: { value: 'g1' } })
    fireEvent.change(screen.getByLabelText('treatmentCampaigns.modal.medication'), { target: { value: 'Albendazole' } })
    fireEvent.click(screen.getByRole('button', { name: /mobileUi.step.next/ }))
    fireEvent.click(screen.getByRole('button', { name: 'treatmentCampaigns.modal.createBtn' }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    const sent = create.mock.calls[0][0]
    expect(sent).toMatchObject({ enterpriseId: 'f1', name: 'Deworm round', campaignType: 'vaccination', groupId: 'g1', productUsed: 'Albendazole', targetCount: 40 })
    expect(sent).not.toHaveProperty('targetGroupId')
    expect(sent).not.toHaveProperty('medication')
  })

  it('"Mark done" opens the progress step so the real number treated is entered', async () => {
    render(<TreatmentCampaigns />)
    await screen.findByText(/FMD round/)
    fireEvent.click(screen.getAllByText('treatmentCampaigns.markDone')[0])
    expect(await screen.findByLabelText('treatmentCampaigns.modal.completedCount')).toBeTruthy()
  })

  it('offers no create / edit buttons to someone whose role cannot (a worker)', async () => {
    api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'f1', name: 'Farm', ownerId: 'someone-else' }] } })
    api.listEnterpriseMembers.mockResolvedValue({ data: [{ userId: 'u1', role: 'worker' }] })
    render(<TreatmentCampaigns />)
    await screen.findByText(/FMD round/)
    expect(screen.queryByText('treatmentCampaigns.newCampaign')).toBeNull()
    expect(screen.queryByText('common.edit')).toBeNull()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GroupSummary, groupFromConsultation } from './GroupSummary'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o && o.count !== undefined ? `${k}:${o.count}` : k) }) }))
vi.mock('../../context/MasterDataContext', () => ({
  useMasterData: () => ({ speciesLabel: (s: string) => s, speciesIcon: () => '🐔', groupTypeLabel: (_s: string, v: string) => `type:${v}` }),
}))

describe('GroupSummary', () => {
  it('shows the group, its kind and the head count the treatment will be recorded against', () => {
    render(<GroupSummary group={{ groupId: 'g1', groupName: 'Layer flock A', groupType: 'layer_flock', groupSpecies: 'Chicken', groupHeadCount: 120 }} />)
    expect(screen.getByText('Layer flock A')).toBeTruthy()
    expect(screen.getByText('Chicken · type:layer_flock')).toBeTruthy()
    expect(screen.getByText('consultationRoom.group.headCount:120')).toBeTruthy()
    expect(screen.getByText('consultationRoom.group.oneRecord')).toBeTruthy()
  })

  it('renders nothing when the appointment is not about a group', () => {
    const { container } = render(<GroupSummary group={groupFromConsultation({ animalId: 'a1' })} />)
    expect(container.firstChild).toBeNull()
  })

  it('reads the group off a consultation', () => {
    expect(groupFromConsultation({ groupId: 'g1', groupName: 'X', groupHeadCount: 5 })).toMatchObject({ groupId: 'g1', groupName: 'X', groupHeadCount: 5 })
    expect(groupFromConsultation(null)).toBeNull()
  })
})

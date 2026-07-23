import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NetworkMemberships from './NetworkMemberships'
import apiService from '../../services/api'

vi.mock('../../services/api', () => ({
  default: {
    getMyNetworkEnrollments: vi.fn(),
    acceptEnrollment: vi.fn(),
    declineEnrollment: vi.fn(),
  },
}))

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    formatDate: (d: string) => `formatted:${d}`,
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../context/MasterDataContext', () => ({
  useMasterData: () => ({
    speciesLabel: (species: string) => species,
  }),
}))

const mockedApi = apiService as unknown as {
  getMyNetworkEnrollments: ReturnType<typeof vi.fn>
}

describe('NetworkMemberships error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the error banner with the failure message when the API call fails', async () => {
    mockedApi.getMyNetworkEnrollments.mockRejectedValue({ message: 'Network request failed' })

    render(<NetworkMemberships />)

    expect(await screen.findByText('Network request failed')).toBeInTheDocument()
  })

  it('clears the error banner when the dismiss button is clicked', async () => {
    mockedApi.getMyNetworkEnrollments.mockRejectedValue({ message: 'Network request failed' })

    render(<NetworkMemberships />)

    const errorText = await screen.findByText('Network request failed')
    expect(errorText).toBeInTheDocument()

    const dismissBtn = screen.getByRole('button', { name: '✕' })
    fireEvent.click(dismissBtn)

    await waitFor(() => expect(screen.queryByText('Network request failed')).not.toBeInTheDocument())
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

/**
 * Login calls useNavigate, so it needs a Router - which it always has in the real app.
 */
function render(ui: React.ReactElement) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>)
}

const mockLogin = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

/** The exact shape AuthContext throws for a blocked account. */
function blockedError(accountStatus: string, message: string) {
  const err = new Error(message) as Error & { accountStatus?: string }
  err.accountStatus = accountStatus
  return err
}

async function submit(email = 'vet@example.com', password = 'Password1') {
  fireEvent.change(screen.getByLabelText('login.email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('login.password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }))
}

describe('Login - blocked account states', () => {
  beforeEach(() => { mockLogin.mockReset() })

  const PENDING_MSG =
    'Your registration is currently under review by our platform team. ' +
    'You will be notified by email once your credentials have been verified.'

  it('shows the real approval message, never a bare "Login failed"', async () => {
    // The regression: a pending vet used to see only "Login failed" - identical to what a
    // typo'd password shows - so they assumed registration had not worked and signed up again.
    mockLogin.mockRejectedValue(blockedError('pending_approval', PENDING_MSG))
    render(<Login />)
    await submit()

    await waitFor(() => expect(screen.getByText(PENDING_MSG)).toBeInTheDocument())
    expect(screen.queryByText(/login failed/i)).not.toBeInTheDocument()
  })

  it('tells a pending user not to register again', async () => {
    mockLogin.mockRejectedValue(blockedError('pending_approval', PENDING_MSG))
    render(<Login />)
    await submit()

    await waitFor(() => {
      expect(screen.getByText('login.pendingTitle')).toBeInTheDocument()
      expect(screen.getByText('login.pendingNoReRegister')).toBeInTheDocument()
    })
  })

  it('renders a blocked account as information, not as a red error', async () => {
    mockLogin.mockRejectedValue(blockedError('pending_approval', PENDING_MSG))
    const { container } = render(<Login />)
    await submit()

    await waitFor(() => {
      expect(container.querySelector('.message.account-status')).toBeTruthy()
    })
    // The error styling is what made this read as "you did something wrong".
    expect(container.querySelector('.message.error')).toBeNull()
  })

  it('uses the lock treatment for frozen/suspended, without the re-register note', async () => {
    mockLogin.mockRejectedValue(blockedError('frozen', 'Your account has been temporarily restricted.'))
    render(<Login />)
    await submit()

    await waitFor(() => expect(screen.getByText('login.blockedTitle')).toBeInTheDocument())
    expect(screen.queryByText('login.pendingNoReRegister')).not.toBeInTheDocument()
  })

  it('still shows a genuine credential failure as an error', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'))
    const { container } = render(<Login />)
    await submit()

    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument())
    expect(container.querySelector('.message.error')).toBeTruthy()
    expect(container.querySelector('.message.account-status')).toBeNull()
  })
})

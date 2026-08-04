import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'

/**
 * Register reads ?role= via useSearchParams, so it needs a Router - which it
 * always has in the real app (App.tsx renders it inside the route tree).
 * `initialPath` lets a test drive the query string.
 */
function render(ui: React.ReactElement, initialPath = '/register') {
  return rtlRender(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>)
}

const mockRegister = vi.fn()
const mockGroomingEnabled = vi.fn(() => ({ enabled: false, loading: false }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}))

// Keep the module-flag probe out of the test - the real hook hits GET /grooming/status.
vi.mock('../hooks/useGroomingEnabled', () => ({
  useGroomingEnabled: () => mockGroomingEnabled(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('Register form validation', () => {
  const onSwitchToLogin = vi.fn()

  beforeEach(() => {
    mockRegister.mockReset()
    mockRegister.mockResolvedValue(undefined)
    mockGroomingEnabled.mockReturnValue({ enabled: false, loading: false })
  })

  function fillRequiredFields(overrides: Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'password' | 'confirmPassword', string>> = {}) {
    const values = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '5551234567',
      password: 'Password1',
      confirmPassword: 'Password1',
      ...overrides,
    }
    fireEvent.change(screen.getByLabelText('register.firstName'), { target: { value: values.firstName } })
    fireEvent.change(screen.getByLabelText('register.lastName'), { target: { value: values.lastName } })
    fireEvent.change(screen.getByLabelText('register.email'), { target: { value: values.email } })
    fireEvent.change(screen.getByLabelText('register.phone'), { target: { value: values.phone } })
    fireEvent.change(screen.getByLabelText('register.password'), { target: { value: values.password } })
    fireEvent.change(screen.getByLabelText('register.confirmPassword'), { target: { value: values.confirmPassword } })
  }

  function acceptTerms() {
    const termsCheckbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(termsCheckbox)
  }

  it('blocks submission and shows an error when a required field is empty', () => {
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    // Leave firstName empty; fill the rest; accept terms so the submit button isn't disabled.
    // Submit the form directly (fireEvent.submit) rather than clicking the submit button,
    // since a real click would be blocked by the native HTML5 `required` constraint before
    // React's own handleSubmit validation ever runs.
    fillRequiredFields({ firstName: '' })
    acceptTerms()
    fireEvent.submit(screen.getByRole('form', { name: /create account form/i }))

    expect(screen.getByText('register.validation.allRequired')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('blocks submission and shows an error when passwords do not match', () => {
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    fillRequiredFields({ password: 'Password1', confirmPassword: 'Different1' })
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: /register.createAccountBtn/ }))

    expect(screen.getByText('register.validation.passwordMismatch')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('blocks submission and shows an error when the password fails the complexity check', () => {
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    fillRequiredFields({ password: 'alllowercase', confirmPassword: 'alllowercase' })
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: /register.createAccountBtn/ }))

    expect(screen.getByText('register.validation.passwordComplexity')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('submits successfully and calls register() when the form is valid and terms are accepted', async () => {
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    fillRequiredFields()
    acceptTerms()

    const submitBtn = screen.getByRole('button', { name: /register.createAccountBtn/ })
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1))
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '5551234567',
        password: 'Password1',
        role: 'pet_owner',
        acceptTerms: true,
      })
    )
  })

  it('disables the submit button until the terms checkbox is accepted', () => {
    render(<Register onSwitchToLogin={onSwitchToLogin} />)
    fillRequiredFields()

    const submitBtn = screen.getByRole('button', { name: /register.createAccountBtn/ })
    expect(submitBtn).toBeDisabled()
  })

  it('reveals and re-masks the password when the show/hide toggle is used', () => {
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    const passwordInput = screen.getByLabelText('register.password') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    // Two password fields on this form; each toggle drives only its own input.
    const [toggle] = screen.getAllByLabelText('common.showPassword')
    fireEvent.click(toggle)
    expect(passwordInput.type).toBe('text')
    expect((screen.getByLabelText('register.confirmPassword') as HTMLInputElement).type).toBe('password')

    fireEvent.click(screen.getByLabelText('common.hidePassword'))
    expect(passwordInput.type).toBe('password')
  })

  it('hides the grooming provider role while the grooming module is disabled', () => {
    mockGroomingEnabled.mockReturnValue({ enabled: false, loading: false })
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    expect(document.querySelector('input[name="role"][value="groomer"]')).toBeNull()
  })

  it('offers the grooming provider role and submits it once the module is enabled', async () => {
    mockGroomingEnabled.mockReturnValue({ enabled: true, loading: false })
    render(<Register onSwitchToLogin={onSwitchToLogin} />)

    const groomerRadio = document.querySelector('input[name="role"][value="groomer"]') as HTMLInputElement
    expect(groomerRadio).not.toBeNull()

    fireEvent.click(groomerRadio)
    fillRequiredFields()
    acceptTerms()
    fireEvent.click(screen.getByRole('button', { name: /register.createAccountBtn/ }))

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1))
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ role: 'groomer' }))
    // groomer is NOT an approval-gated role - no licence field, no review banner
    expect(screen.queryByText('Account Review Required')).toBeNull()
  })

  // The home page's "List your business" CTA links to /register?role=groomer,
  // so a visitor lands on the right form instead of hunting for the role.
  describe('?role= preselection', () => {
    it('preselects groomer from the query string when the module is enabled', () => {
      mockGroomingEnabled.mockReturnValue({ enabled: true, loading: false })
      render(<Register onSwitchToLogin={onSwitchToLogin} />, '/register?role=groomer')

      const groomerRadio = document.querySelector('input[name="role"][value="groomer"]') as HTMLInputElement
      expect(groomerRadio.checked).toBe(true)
    })

    it('falls back to pet_owner when the grooming module is disabled', () => {
      // The existing guard effect must still win - otherwise a stale link would
      // submit a role the backend rejects.
      mockGroomingEnabled.mockReturnValue({ enabled: false, loading: false })
      render(<Register onSwitchToLogin={onSwitchToLogin} />, '/register?role=groomer')

      const petOwnerRadio = document.querySelector('input[name="role"][value="pet_owner"]') as HTMLInputElement
      expect(petOwnerRadio.checked).toBe(true)
    })

    it('ignores a role that is not self-registerable', () => {
      render(<Register onSwitchToLogin={onSwitchToLogin} />, '/register?role=admin')

      const petOwnerRadio = document.querySelector('input[name="role"][value="pet_owner"]') as HTMLInputElement
      expect(petOwnerRadio.checked).toBe(true)
      expect(document.querySelector('input[name="role"][value="admin"]')).toBeNull()
    })

    it('defaults to pet_owner with no query string', () => {
      render(<Register onSwitchToLogin={onSwitchToLogin} />)

      const petOwnerRadio = document.querySelector('input[name="role"][value="pet_owner"]') as HTMLInputElement
      expect(petOwnerRadio.checked).toBe(true)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Register from './Register'

const mockRegister = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('Register form validation', () => {
  const onSwitchToLogin = vi.fn()

  beforeEach(() => {
    mockRegister.mockReset()
    mockRegister.mockResolvedValue(undefined)
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
})

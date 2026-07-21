import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PaymentCheckout from './PaymentCheckout'
import apiService from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    getWallet: vi.fn(),
    initiatePaymentCheckout: vi.fn(),
    verifyPayment: vi.fn(),
  },
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    formatCurrency: (amount: number) => `₹${amount}`,
    settings: { paymentGatewayMode: 'demo' },
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockedApi = apiService as unknown as {
  getWallet: ReturnType<typeof vi.fn>
  initiatePaymentCheckout: ReturnType<typeof vi.fn>
  verifyPayment: ReturnType<typeof vi.fn>
}

describe('PaymentCheckout', () => {
  const onSuccess = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getWallet.mockResolvedValue({ data: { balance: 0, bonusCredits: 0 } })
  })

  it('shows the checkout UI with the expected amount once wallet data loads', async () => {
    render(<PaymentCheckout bookingId="booking-1" amount={500} onSuccess={onSuccess} onCancel={onCancel} />)

    await waitFor(() => expect(mockedApi.getWallet).toHaveBeenCalled())

    expect(screen.getByText('payment.title')).toBeInTheDocument()
    expect(screen.getByText('payment.consultationFee')).toBeInTheDocument()
    // Fee row and payable-now row both show the formatted amount (no wallet applied)
    expect(screen.getAllByText('₹500').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: /payment.payButton/ })).toBeInTheDocument()
  })

  it('surfaces a visible error banner when checkout initiation fails, without calling onSuccess', async () => {
    mockedApi.initiatePaymentCheckout.mockRejectedValue(new Error('network down'))

    render(<PaymentCheckout bookingId="booking-1" amount={500} onSuccess={onSuccess} onCancel={onCancel} />)
    await waitFor(() => expect(mockedApi.getWallet).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /payment.payButton/ }))

    await waitFor(() => expect(mockedApi.initiatePaymentCheckout).toHaveBeenCalledWith('booking-1', false))
    expect(await screen.findByText('payment.checkoutFailed')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('completes the demo gateway flow by calling verifyPayment with the returned paymentId', async () => {
    mockedApi.initiatePaymentCheckout.mockResolvedValue({
      data: {
        paymentId: 'pay-123',
        amount: 500,
        walletApplied: 0,
        payableNow: 500,
        gatewayMode: 'demo',
        paid: false,
      },
    })
    mockedApi.verifyPayment.mockResolvedValue({ data: { verified: true } })

    render(<PaymentCheckout bookingId="booking-1" amount={500} onSuccess={onSuccess} onCancel={onCancel} />)
    await waitFor(() => expect(mockedApi.getWallet).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /payment.payButton/ }))

    // Demo gateway dialog appears
    expect(await screen.findByText('payment.demoGatewayTitle')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'payment.demoPay' }))

    await waitFor(() => expect(mockedApi.verifyPayment).toHaveBeenCalledWith({ paymentId: 'pay-123' }))
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})

import apiService from '../services/api'

/** Loads Razorpay checkout.js once; resolves when window.Razorpay is available. */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true)
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]')
    if (existing) { existing.addEventListener('load', () => resolve(true)); existing.addEventListener('error', () => resolve(false)); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true); s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

/**
 * Runs the full grooming payment: creates a gateway checkout, then either auto-confirms (demo)
 * or opens the Razorpay widget and confirms on success. Resolves with the confirmation result
 * (incl. invoiceNumber) or rejects/aborts. Reuses the shared payment gateways via the backend.
 */
export async function payGroomingOrderFlow(orderId: string, deposit = false): Promise<any> {
  return runGroomingGatewayFlow(
    () => apiService.createGroomingCheckout(orderId, deposit),
    (body) => apiService.confirmGroomingPayment(orderId, body),
    'Grooming & Spa service',
  )
}

/**
 * Pays an order's outstanding balance — the remainder after a deposit, or extra work the customer
 * approved mid-service. Same gateway mechanics, different endpoints and its own payments row.
 */
export async function payGroomingBalanceFlow(orderId: string): Promise<any> {
  return runGroomingGatewayFlow(
    () => apiService.createGroomingBalanceCheckout(orderId),
    (body) => apiService.confirmGroomingBalancePayment(orderId, body),
    'Grooming balance due',
  )
}

/** Shared gateway mechanics for both grooming collections (initial and balance). */
async function runGroomingGatewayFlow(
  createCheckout: () => Promise<any>,
  confirm: (body: any) => Promise<any>,
  description: string,
): Promise<any> {
  const res = await createCheckout()
  const data = res?.data || res
  const mode: string = data.mode
  const payload = data.checkoutPayload || {}

  if (mode === 'demo') {
    return (await confirm({ gatewayOrderId: data.gatewayOrderId })).data
  }

  // Razorpay checkout
  const loaded = await loadRazorpayScript()
  if (!loaded || !(window as any).Razorpay || !payload.orderId) {
    throw new Error('Payment gateway unavailable. Please try again.')
  }
  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: payload.keyId,
      amount: payload.amountPaise,
      currency: payload.currency || 'INR',
      order_id: payload.orderId,
      name: 'VetCare Grooming',
      description,
      handler: async (r: any) => {
        try {
          const out = await confirm({
            gatewayOrderId: r.razorpay_order_id,
            gatewayPaymentId: r.razorpay_payment_id,
            gatewaySignature: r.razorpay_signature,
          })
          resolve(out.data)
        } catch (e) { reject(e) }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
      theme: { color: '#4F46E5' },
    })
    rzp.open()
  })
}

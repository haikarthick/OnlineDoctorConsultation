import { PaymentGateway, PaymentGatewayMode } from '../types';
import demoGateway from './DemoGateway';
import PaymentModuleConfig from '../PaymentModuleConfig';

/**
 * Gateway factory — resolves the active adapter from `payment.gatewayMode`.
 * RazorpayGateway lands in Phase P2; until then non-demo modes fail loudly
 * so a misconfigured environment can't silently fake payments.
 */
export function getGatewayForMode(mode: PaymentGatewayMode): PaymentGateway {
  switch (mode) {
    case 'demo':
      return demoGateway;
    case 'razorpay_test':
    case 'razorpay_live':
      throw new Error(
        `Payment gateway mode '${mode}' is not available yet (Razorpay adapter ships in Phase P2). ` +
        `Set system setting payment.gatewayMode to 'demo'.`
      );
    default:
      return demoGateway;
  }
}

export async function getActiveGateway(): Promise<PaymentGateway> {
  const mode = await PaymentModuleConfig.getGatewayMode();
  return getGatewayForMode(mode);
}

export { demoGateway };

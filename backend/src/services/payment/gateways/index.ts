import { PaymentGateway, PaymentGatewayMode } from '../types';
import demoGateway from './DemoGateway';
import RazorpayGateway from './RazorpayGateway';
import PaymentModuleConfig from '../PaymentModuleConfig';
import PaymentCredentialsService from '../PaymentCredentialsService';

/**
 * Gateway factory - resolves the active adapter from `payment.gatewayMode`.
 * Credentials are fetched fresh each call (PaymentCredentialsService has its
 * own short TTL cache) rather than cached on a long-lived gateway instance,
 * so an admin updating credentials takes effect within the cache window
 * without needing a restart. A misconfigured razorpay mode (credentials not
 * set) fails loudly rather than silently faking payments.
 */
export async function getGatewayForMode(mode: PaymentGatewayMode): Promise<PaymentGateway> {
  switch (mode) {
    case 'razorpay_test': {
      const creds = await PaymentCredentialsService.getForGateway('test');
      return new RazorpayGateway('razorpay_test', creds);
    }
    case 'razorpay_live': {
      const creds = await PaymentCredentialsService.getForGateway('live');
      return new RazorpayGateway('razorpay_live', creds);
    }
    case 'demo':
    default:
      return demoGateway;
  }
}

export async function getActiveGateway(): Promise<PaymentGateway> {
  const mode = await PaymentModuleConfig.getGatewayMode();
  return getGatewayForMode(mode);
}

export { demoGateway };

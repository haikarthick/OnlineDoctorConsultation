import { PaymentGateway, PaymentGatewayMode } from '../types';
import demoGateway from './DemoGateway';
import RazorpayGateway from './RazorpayGateway';
import PaymentModuleConfig from '../PaymentModuleConfig';

// Razorpay instances are cached per mode (constructor validates env keys loudly)
const razorpayInstances = new Map<string, RazorpayGateway>();

/**
 * Gateway factory — resolves the active adapter from `payment.gatewayMode`.
 * A misconfigured razorpay mode (missing env keys) fails loudly rather than
 * silently faking payments.
 */
export function getGatewayForMode(mode: PaymentGatewayMode): PaymentGateway {
  switch (mode) {
    case 'demo':
      return demoGateway;
    case 'razorpay_test':
    case 'razorpay_live': {
      let inst = razorpayInstances.get(mode);
      if (!inst) {
        inst = new RazorpayGateway(mode);
        razorpayInstances.set(mode, inst);
      }
      return inst;
    }
    default:
      return demoGateway;
  }
}

export async function getActiveGateway(): Promise<PaymentGateway> {
  const mode = await PaymentModuleConfig.getGatewayMode();
  return getGatewayForMode(mode);
}

export { demoGateway };

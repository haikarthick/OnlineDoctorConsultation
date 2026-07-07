import dotenv from 'dotenv';
dotenv.config();

import { RazorpayGateway } from '../src/services/payment/gateways/RazorpayGateway';

async function main() {
  const gw = new RazorpayGateway('razorpay_test');
  const order = await gw.createOrder(10, 'INR', `verify_${Date.now()}`, { purpose: 'credential-verification' });
  console.log('SUCCESS — Razorpay test order created:');
  console.log(JSON.stringify(order, null, 2));
}

main().catch((err) => {
  console.error('FAILED —', err?.response?.data || err.message || err);
  process.exit(1);
});

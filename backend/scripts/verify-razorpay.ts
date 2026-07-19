/**
 * Standalone pre-flight check for a Razorpay Key Id/Secret pair — verifies
 * against Razorpay's real API BEFORE you paste it into Admin -> System
 * Settings -> Razorpay Credentials (which is where the app actually stores
 * and reads credentials from, encrypted, not from env vars).
 *
 * Usage: set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET as temporary env vars
 * (or in .env) just for this one-off command, then:
 *   npx ts-node --project tsconfig.json scripts/verify-razorpay.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { RazorpayGateway } from '../src/services/payment/gateways/RazorpayGateway';

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) {
    throw new Error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (temporarily) before running this script.');
  }
  const gw = new RazorpayGateway('razorpay_test', { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '' });
  const order = await gw.createOrder(10, 'INR', `verify_${Date.now()}`, { purpose: 'credential-verification' });
  console.log('SUCCESS — Razorpay test order created:');
  console.log(JSON.stringify(order, null, 2));
}

main().catch((err) => {
  console.error('FAILED —', err?.response?.data || err.message || err);
  process.exit(1);
});

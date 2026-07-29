-- Migration 038: customer wallet withdrawals (money OUT of the platform)
--
-- Refunds defaulted to the in-house wallet, and there was NO way for a customer to get that
-- money back out: withdrawal_requests is veterinarian-only (it settles doctor_earnings), and
-- WalletController exposed only getWallet + listTransactions. A customer whose booking was
-- cancelled therefore received permanent store credit rather than a refund — money they could
-- only ever spend back on this platform. That is a consumer-protection exposure, not a UX gap.
--
-- Two changes close it, per the owner decision:
--   1. Refunds now default to the ORIGINAL PAYMENT METHOD (a settings default, applied in
--      GroomingModuleConfig — no schema change needed).
--   2. This table gives the wallet a real exit for balances that are already there, for
--      goodwill credits, and for gateway refunds that fail and fall back to the wallet.
--
-- Deliberately NOT reusing withdrawal_requests: that table is keyed to doctor earnings and
-- carries TDS/commission-invoice semantics that do not apply to a customer being handed back
-- their own money. Same reasoning as the grooming/consultation module split.

CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'settled', 'cancelled')),
  -- Payout destination, captured per request: a customer's bank details are not stored on the
  -- user record, and they may legitimately differ between requests.
  method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer'
    CHECK (method IN ('bank_transfer', 'upi')),
  account_name VARCHAR(255),
  account_number VARCHAR(50),
  ifsc VARCHAR(20),
  upi_id VARCHAR(100),
  -- Evidence the money actually left: bank/UPI reference recorded by the admin who paid it.
  utr_reference VARCHAR(100),
  admin_note TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  settled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user ON wallet_withdrawal_requests (user_id, created_at DESC);
-- The admin queue is "everything still open, oldest first"; a partial index keeps it cheap as
-- settled history accumulates.
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_open
  ON wallet_withdrawal_requests (created_at ASC) WHERE status IN ('requested', 'approved');

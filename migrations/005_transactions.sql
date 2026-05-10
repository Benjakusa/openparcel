-- Migration 005: Transactions

-- Platform subscription transactions
CREATE TABLE IF NOT EXISTS platform_subscription_transactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  checkout_request_id TEXT UNIQUE,
  mpesa_receipt_number TEXT,
  amount NUMERIC,
  plan TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parcel fee transactions
CREATE TABLE IF NOT EXISTS parcel_fee_transactions (
  id SERIAL PRIMARY KEY,
  parcel_id INTEGER REFERENCES parcels(id),
  company_id INTEGER REFERENCES companies(id),
  checkout_request_id TEXT UNIQUE,
  mpesa_receipt_number TEXT,
  amount NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration 001: Companies (tenants)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing','active','expired','suspended')),
  subscription_plan TEXT,
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  trial_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trial_end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
  -- Company M-Pesa credentials (encrypted)
  mpesa_shortcode TEXT,
  mpesa_consumer_key TEXT,
  mpesa_consumer_secret TEXT,
  mpesa_passkey TEXT,
  mpesa_environment TEXT DEFAULT 'sandbox',
  mpesa_configured BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved BOOLEAN DEFAULT FALSE
);

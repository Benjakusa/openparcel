-- Migration: 001_initial_schema.sql
-- Run this first to create all tables

-- Companies (tenants)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'trialing',
  subscription_plan TEXT,
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  trial_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trial_end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
  mpesa_shortcode TEXT,
  mpesa_consumer_key TEXT,
  mpesa_consumer_secret TEXT,
  mpesa_passkey TEXT,
  mpesa_environment TEXT DEFAULT 'sandbox',
  mpesa_configured BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved BOOLEAN DEFAULT FALSE
);

-- Offices
CREATE TABLE IF NOT EXISTS offices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  UNIQUE(company_id, name)
);

-- Users (super_admin has no company_id)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('super_admin','company_admin','office_staff')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parcels
CREATE TABLE IF NOT EXISTS parcels (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  tracking_id TEXT UNIQUE,
  qr_code TEXT,
  sending_office_id INTEGER REFERENCES offices(id),
  receiving_office_id INTEGER REFERENCES offices(id),
  status TEXT CHECK (status IN ('pending_payment','payment_failed','created','dispatched','arrived','picked_up')) DEFAULT 'pending_payment',
  payment_retry_count INTEGER DEFAULT 0,
  sender_name TEXT,
  sender_phone TEXT,
  sender_id_number TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  weight_kg NUMERIC,
  fee_paid NUMERIC,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dispatched_at TIMESTAMP,
  arrived_at TIMESTAMP,
  picked_up_at TIMESTAMP
);

-- Platform subscription transactions
CREATE TABLE IF NOT EXISTS platform_subscription_transactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  checkout_request_id TEXT UNIQUE,
  mpesa_receipt_number TEXT,
  amount NUMERIC,
  plan TEXT,
  status TEXT DEFAULT 'pending',
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
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_id ON parcels(tracking_id);
CREATE INDEX IF NOT EXISTS idx_parcels_company_status ON parcels(company_id, status);
CREATE INDEX IF NOT EXISTS idx_parcels_sending_office_status ON parcels(sending_office_id, status);
CREATE INDEX IF NOT EXISTS idx_parcels_receiving_office_status ON parcels(receiving_office_id, status);
CREATE INDEX IF NOT EXISTS idx_companies_approved ON companies(approved);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON platform_subscription_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_parcel_fee_checkout ON parcel_fee_transactions(checkout_request_id);

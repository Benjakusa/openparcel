-- Migration 004: Parcels
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

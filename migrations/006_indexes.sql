-- Migration 006: Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_id ON parcels(tracking_id);
CREATE INDEX IF NOT EXISTS idx_parcels_company_status ON parcels(company_id, status);
CREATE INDEX IF NOT EXISTS idx_parcels_sending_office_status ON parcels(sending_office_id, status);
CREATE INDEX IF NOT EXISTS idx_parcels_receiving_office_status ON parcels(receiving_office_id, status);
CREATE INDEX IF NOT EXISTS idx_companies_approved ON companies(approved);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON platform_subscription_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_parcel_fee_checkout ON parcel_fee_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_offices_company ON offices(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

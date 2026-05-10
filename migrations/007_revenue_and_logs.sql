-- Migration 007: Revenue & Logs

-- Add payment_method to parcels if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='payment_method') THEN
        ALTER TABLE parcels ADD COLUMN payment_method TEXT DEFAULT 'mpesa' CHECK (payment_method IN ('mpesa', 'cash'));
    END IF;
END $$;

-- Create user_logs table
CREATE TABLE IF NOT EXISTS user_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying logs quickly
CREATE INDEX IF NOT EXISTS idx_user_logs_company_id_created_at ON user_logs(company_id, created_at DESC);

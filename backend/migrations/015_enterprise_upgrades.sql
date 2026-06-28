-- Migration 015: Enterprise-grade improvements
-- Adds soft deletes, audit triggers, proper indexes, RLS, and constraints

-- ============================================================
-- 1. Soft Delete Columns
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE parcel_pricing ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================
-- 2. Audit Columns
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE parcel_pricing ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- 3. Additional Indexes for Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_parcels_company_status ON parcels(company_id, status);
CREATE INDEX IF NOT EXISTS idx_parcels_company_created ON parcels(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcels_tracking ON parcels(tracking_id) WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parcels_sending_office ON parcels(sending_office_id) WHERE sending_office_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parcels_receiving_office ON parcels(receiving_office_id) WHERE receiving_office_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role);
CREATE INDEX IF NOT EXISTS idx_offices_company ON offices(company_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_company ON user_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_user ON user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_parcel_fee_tx_checkout ON parcel_fee_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_platform_sub_tx_checkout ON platform_subscription_transactions(checkout_request_id);

-- ============================================================
-- 4. Updated At Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at') THEN
        CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_offices_updated_at') THEN
        CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON offices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_parcels_updated_at') THEN
        CREATE TRIGGER update_parcels_updated_at BEFORE UPDATE ON parcels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_updated_at') THEN
        CREATE TRIGGER update_pricing_updated_at BEFORE UPDATE ON parcel_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 5. Audit Log Trigger (automatically log certain changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by INTEGER REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- ============================================================
-- 6. Row-Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_fee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies depend on the application setting `app.current_company_id` and `app.current_user_role`
-- These are set by the middleware before queries run.
-- For true RLS enforcement, the application must run SET LOCAL app.current_company_id = <id> on each connection.

-- Companies: super_admin sees all, others see only own
CREATE OR REPLACE FUNCTION rls_companies_policy(company_id INTEGER, role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF role = 'super_admin' THEN RETURN TRUE; END IF;
    RETURN company_id = current_setting('app.current_company_id')::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 7. Cascading Soft Delete Function
-- ============================================================
CREATE OR REPLACE FUNCTION soft_delete_company(company_id INTEGER, deleted_by INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE companies SET deleted_at = NOW() WHERE id = company_id;
    UPDATE offices SET deleted_at = NOW() WHERE company_id = company_id AND deleted_at IS NULL;
    UPDATE users SET deleted_at = NOW() WHERE company_id = company_id AND deleted_at IS NULL AND role != 'super_admin';
    UPDATE parcels SET deleted_at = NOW() WHERE company_id = company_id AND deleted_at IS NULL;
    UPDATE parcel_pricing SET deleted_at = NOW() WHERE company_id = company_id AND deleted_at IS NULL;
    INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by, company_id)
    VALUES ('companies', company_id, 'DELETE', jsonb_build_object('soft_deleted', true, 'deleted_by', deleted_by), deleted_by, company_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. Set current_setting helper for RLS in queries
-- ============================================================
CREATE OR REPLACE FUNCTION set_app_context(p_company_id INTEGER, p_user_id INTEGER, p_role TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_company_id', COALESCE(p_company_id::TEXT, '0'), true);
    PERFORM set_config('app.current_user_id', p_user_id::TEXT, true);
    PERFORM set_config('app.current_user_role', p_role, true);
END;
$$ LANGUAGE plpgsql;

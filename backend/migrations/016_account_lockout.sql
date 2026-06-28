-- Migration 016: Account lockout, audit columns, FK constraints

-- ============================================================
-- 1. Account lockout columns
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;

-- ============================================================
-- 2. Audit columns on parcels
-- ============================================================
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- 3. Audit columns on offices
-- ============================================================
ALTER TABLE offices ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- 4. Fix parcels FK — add ON DELETE RESTRICT
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'parcels_company_id_fkey'
        AND table_name = 'parcels'
    ) THEN
        ALTER TABLE parcels DROP CONSTRAINT parcels_company_id_fkey;
    END IF;
END $$;
ALTER TABLE parcels ADD CONSTRAINT parcels_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- ============================================================
-- 5. Token revocation table for JWT management
-- ============================================================
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id SERIAL PRIMARY KEY,
    jti TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- ============================================================
-- 6. Email verification columns
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP;

-- ============================================================
-- 7. Refresh tokens table
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Migration 011: Add phone to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;

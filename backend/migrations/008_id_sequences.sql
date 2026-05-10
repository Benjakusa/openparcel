-- Migration 008: ID generation sequences and parcel_id column

-- Single sequence for both parcel IDs and tracking numbers (ensures global uniqueness)
CREATE SEQUENCE IF NOT EXISTS parcel_identifier_seq START WITH 1 INCREMENT BY 1;

-- Add user-facing parcel_id column (5-char alphanumeric unique identifier)
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(5) UNIQUE;

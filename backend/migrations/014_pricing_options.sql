-- Migration 014: Add pricing options for one-time parcel types
ALTER TABLE parcel_pricing ADD COLUMN IF NOT EXISTS option_name TEXT DEFAULT 'Standard';
ALTER TABLE parcel_pricing DROP CONSTRAINT IF EXISTS parcel_pricing_company_id_destination_office_id_parcel_type_key;
DROP INDEX IF EXISTS parcel_pricing_company_id_destination_office_id_parcel_type_key;
ALTER TABLE parcel_pricing ADD UNIQUE (company_id, destination_office_id, parcel_type, option_name);

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS pricing_option TEXT;

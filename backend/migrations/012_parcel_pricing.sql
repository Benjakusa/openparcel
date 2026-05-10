-- Migration 012: Parcel pricing per destination
CREATE TABLE IF NOT EXISTS parcel_pricing (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    destination_office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
    parcel_type TEXT NOT NULL CHECK (parcel_type IN ('one_time', 'per_kg')),
    price NUMERIC NOT NULL CHECK (price >= 0),
    UNIQUE(company_id, destination_office_id, parcel_type)
);

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS parcel_type TEXT CHECK (parcel_type IN ('one_time', 'per_kg'));

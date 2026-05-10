-- Add vehicle_numberplate column
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS vehicle_numberplate TEXT;

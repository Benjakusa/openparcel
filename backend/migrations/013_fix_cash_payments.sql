-- Fix existing parcels: cash parcels have no M-Pesa transaction record
UPDATE parcels SET payment_method = 'cash'
WHERE payment_method IS NULL OR payment_method = 'mpesa'
  AND id NOT IN (
    SELECT parcel_id FROM parcel_fee_transactions WHERE parcel_id IS NOT NULL
  );

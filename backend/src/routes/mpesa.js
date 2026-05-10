const router = require('express').Router();
const pool = require('../db');
const { generateTrackingId, generateQRDataURL } = require('../utils/qr');
const logger = require('../utils/logger');

// POST /api/mpesa/platform-callback
// M-Pesa calls this after subscription payment
router.post('/platform-callback', async (req, res) => {
    try {
        const body = req.body?.Body?.stkCallback;
        if (!body) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;
        logger.info(`Platform callback received: ${CheckoutRequestID} – ResultCode=${ResultCode}`);

        const txRes = await pool.query(
            'SELECT * FROM platform_subscription_transactions WHERE checkout_request_id=$1',
            [CheckoutRequestID]
        );
        if (!txRes.rows.length) {
            logger.warn(`Platform callback: no transaction found for ${CheckoutRequestID}`);
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        const tx = txRes.rows[0];

        if (ResultCode === 0) {
            // Success – extract receipt
            const items = CallbackMetadata?.Item || [];
            const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
            const amount = items.find(i => i.Name === 'Amount')?.Value;

            // Update transaction
            await pool.query(
                `UPDATE platform_subscription_transactions
         SET status='success', mpesa_receipt_number=$1
         WHERE checkout_request_id=$2`,
                [receipt, CheckoutRequestID]
            );

            // Update company subscription
            const now = new Date();
            let endDate = null;
            if (tx.plan === 'monthly') {
                endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            }
            await pool.query(`
        UPDATE companies SET
          subscription_status='active',
          subscription_plan=$1,
          subscription_start_date=$2,
          subscription_end_date=$3
        WHERE id=$4`,
                [tx.plan, now, endDate, tx.company_id]
            );

            logger.info(`Company ${tx.company_id} subscribed to ${tx.plan} plan. Receipt: ${receipt}`);
        } else {
            await pool.query(
                `UPDATE platform_subscription_transactions SET status='failed' WHERE checkout_request_id=$1`,
                [CheckoutRequestID]
            );
            logger.warn(`Platform payment failed for company ${tx.company_id}: ${ResultDesc}`);
        }

        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err) {
        logger.error('Platform callback error:', err);
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});

// POST /api/mpesa/parcel-callback
// M-Pesa calls this after parcel fee payment
router.post('/parcel-callback', async (req, res) => {
    try {
        const body = req.body?.Body?.stkCallback;
        if (!body) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;
        logger.info(`Parcel fee callback: ${CheckoutRequestID} – ResultCode=${ResultCode}`);

        const txRes = await pool.query(
            `SELECT pft.*, p.payment_retry_count
       FROM parcel_fee_transactions pft
       JOIN parcels p ON p.id = pft.parcel_id
       WHERE pft.checkout_request_id=$1`,
            [CheckoutRequestID]
        );
        if (!txRes.rows.length) {
            logger.warn(`Parcel callback: no transaction found for ${CheckoutRequestID}`);
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        const tx = txRes.rows[0];

        if (ResultCode === 0) {
            const items = CallbackMetadata?.Item || [];
            const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

            await pool.query(
                `UPDATE parcel_fee_transactions SET status='success', mpesa_receipt_number=$1 WHERE checkout_request_id=$2`,
                [receipt, CheckoutRequestID]
            );

            // Generate unique 5-char tracking ID
            const trackingId = await generateTrackingId(pool);

            // Fetch parcel data with office names for QR code
            const parcelRes = await pool.query(`
                SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name
                FROM parcels p
                LEFT JOIN offices so ON so.id = p.sending_office_id
                LEFT JOIN offices ro ON ro.id = p.receiving_office_id
                WHERE p.id=$1`, [tx.parcel_id]
            );
            const parcel = parcelRes.rows[0];

            const qrPayload = {
                id: trackingId,
                s_name: parcel.sender_name || '',
                s_phone: parcel.sender_phone || '',
                r_name: parcel.receiver_name || '',
                r_phone: parcel.receiver_phone || '',
                date: parcel.created_at ? new Date(parcel.created_at).toLocaleDateString() : '',
                from: parcel.sending_office_name || '',
                to: parcel.receiving_office_name || '',
            };
            const qrCode = await generateQRDataURL(qrPayload);

            await pool.query(
                `UPDATE parcels SET status='created', tracking_id=$1, qr_code=$2 WHERE id=$3`,
                [trackingId, qrCode, tx.parcel_id]
            );

            logger.info(`Parcel ${tx.parcel_id} payment confirmed. Tracking: ${trackingId}. Receipt: ${receipt}`);
        } else {
            // Payment failed
            const retryCount = (tx.payment_retry_count || 0) + 1;
            await pool.query(
                `UPDATE parcel_fee_transactions SET status='failed' WHERE checkout_request_id=$1`,
                [CheckoutRequestID]
            );

            if (retryCount >= 3) {
                await pool.query(
                    "UPDATE parcels SET status='payment_failed', payment_retry_count=$1 WHERE id=$2",
                    [retryCount, tx.parcel_id]
                );
                logger.warn(`Parcel ${tx.parcel_id} permanently failed after ${retryCount} attempts`);
            } else {
                await pool.query(
                    "UPDATE parcels SET payment_retry_count=$1 WHERE id=$2",
                    [retryCount, tx.parcel_id]
                );
                logger.warn(`Parcel ${tx.parcel_id} payment failed (attempt ${retryCount}): ${ResultDesc}`);
            }
        }

        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err) {
        logger.error('Parcel callback error:', err);
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});

module.exports = router;

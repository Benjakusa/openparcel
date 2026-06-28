const router = require('express').Router();
const db = require('../db');
const { generateQR } = require('../utils/qr');
const { generateReceipt } = require('../utils/pdf');
const { sendWhatsAppWithPDF, templates } = require('../utils/whatsapp');
const { generateTrackingId, buildQRData } = require('../utils/helpers');

const MPESA_CALLBACK_IPS = ['196.201.214.200', '196.201.214.206', '196.201.213.114', '196.201.214.207', '196.201.213.44', '196.201.212.127'];

function mpesaIpWhitelist(req, res, next) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    if (!MPESA_CALLBACK_IPS.includes(clientIp)) {
        getLogger(req).warn('M-Pesa callback from untrusted IP', { ip: clientIp });
        return res.status(403).json({ ResultCode: 1 });
    }
    next();
}

function getLogger(req) {
    return req.app.get('logger') || console;
}

// POST /api/mpesa/platform-callback – platform subscription payments
router.post('/platform-callback', mpesaIpWhitelist, async (req, res) => {
    const log = getLogger(req);
    try {
        const callback = req.body?.Body?.stkCallback;
        if (!callback) return res.json({ ResultCode: 0 });

        const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;

        if (ResultCode === 0) {
            const items = CallbackMetadata?.Item || [];
            const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

            const txRes = await db.query('SELECT * FROM platform_subscription_transactions WHERE checkout_request_id=$1', [CheckoutRequestID]);
            if (!txRes.rows.length) return res.json({ ResultCode: 0 });
            const tx = txRes.rows[0];

            await db.query(
                `UPDATE platform_subscription_transactions SET status='success', mpesa_receipt_number=$1 WHERE checkout_request_id=$2`,
                [receipt, CheckoutRequestID]
            );

            const plan = tx.plan;
            const startDate = new Date();
            const endDate = plan === 'monthly' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

            await db.query(
                `UPDATE companies SET subscription_status='active', subscription_plan=$1, subscription_start_date=$2, subscription_end_date=$3 WHERE id=$4`,
                [plan, startDate, endDate, tx.company_id]
            );
            log.info(`M-Pesa platform subscription activated for company ${tx.company_id}, plan: ${plan}`, { receipt, companyId: tx.company_id });
        } else {
            await db.query(
                `UPDATE platform_subscription_transactions SET status='failed' WHERE checkout_request_id=$1`,
                [CheckoutRequestID]
            );
            log.warn(`M-Pesa platform subscription failed`, { checkoutRequestId: CheckoutRequestID, resultCode: ResultCode });
        }

        res.json({ ResultCode: 0 });
    } catch (err) {
        getLogger(req).error('M-Pesa platform callback error', { error: err.message });
        res.json({ ResultCode: 0 });
    }
});

// POST /api/mpesa/parcel-callback – parcel fee payments
router.post('/parcel-callback', mpesaIpWhitelist, async (req, res) => {
    const log = getLogger(req);
    try {
        const callback = req.body?.Body?.stkCallback;
        if (!callback) return res.json({ ResultCode: 0 });

        const { CheckoutRequestID, ResultCode } = callback;
        const items = callback.CallbackMetadata?.Item || [];
        const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

        const txRes = await db.query('SELECT * FROM parcel_fee_transactions WHERE checkout_request_id=$1', [CheckoutRequestID]);
        if (!txRes.rows.length) return res.json({ ResultCode: 0 });
        const tx = txRes.rows[0];

        if (ResultCode === 0) {
            const trackingId = await generateTrackingId(db);

            await db.query(
                `UPDATE parcel_fee_transactions SET status='success', mpesa_receipt_number=$1 WHERE checkout_request_id=$2`,
                [receipt, CheckoutRequestID]
            );

            const parcelRes = await db.query(
                `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name,
                        ro.address as receiving_office_address, c.name as company_name
           FROM parcels p
           LEFT JOIN offices so ON so.id=p.sending_office_id
           LEFT JOIN offices ro ON ro.id=p.receiving_office_id
           LEFT JOIN companies c ON c.id=p.company_id
           WHERE p.id=$1`, [tx.parcel_id]
            );
            const p = parcelRes.rows[0];
            if (!p || p.company_id !== tx.company_id) {
                log.warn(`M-Pesa callback company_id mismatch`, { parcelId: tx.parcel_id, txCompanyId: tx.company_id, parcelCompanyId: p?.company_id });
                return res.json({ ResultCode: 0 });
            }
            const qrData = buildQRData({ ...p, tracking_id: trackingId });
            const qrCode = await generateQR(qrData);

            await db.query(
                `UPDATE parcels SET status='created', tracking_id=$1, qr_code=$2 WHERE id=$3`,
                [trackingId, qrCode, tx.parcel_id]
            );
            log.info(`M-Pesa parcel ${tx.parcel_id} activated with tracking ID ${trackingId}`, { receipt, parcelId: tx.parcel_id });

            const receiptParcel = {
                ...p,
                tracking_id: trackingId,
                qr_code: qrCode,
            };
            const senderReceipt = await generateReceipt(receiptParcel, 'sender');
            const receiverReceipt = await generateReceipt(receiptParcel, 'receiver');

            sendWhatsAppWithPDF(
                p.sender_phone,
                templates.toSender(p.company_name, trackingId, p.fee_paid, p.receiving_office_name),
                senderReceipt,
                `receipt-${trackingId}-sender.pdf`
            );
            sendWhatsAppWithPDF(
                p.receiver_phone,
                templates.toReceiver(p.company_name, trackingId, p.sender_name, p.receiving_office_name),
                receiverReceipt,
                `receipt-${trackingId}-receiver.pdf`
            );
        } else {
            const parcelRes = await db.query('SELECT payment_retry_count FROM parcels WHERE id=$1', [tx.parcel_id]);
            const retryCount = (parcelRes.rows[0]?.payment_retry_count || 0) + 1;
            const newStatus = retryCount >= 3 ? 'payment_failed' : 'pending_payment';

            await db.query(
                `UPDATE parcels SET payment_retry_count=$1, status=$2 WHERE id=$3`,
                [retryCount, newStatus, tx.parcel_id]
            );
            await db.query(
                `UPDATE parcel_fee_transactions SET status='failed' WHERE checkout_request_id=$1`,
                [CheckoutRequestID]
            );
            log.warn(`M-Pesa parcel payment failed`, { parcelId: tx.parcel_id, retryCount, resultCode: ResultCode });
        }

        res.json({ ResultCode: 0 });
    } catch (err) {
        getLogger(req).error('M-Pesa parcel callback error', { error: err.message });
        res.json({ ResultCode: 0 });
    }
});

module.exports = router;

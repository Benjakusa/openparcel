const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { logRead } = require('../utils/audit');
const { stkPush } = require('../utils/mpesa');
const { generateQR } = require('../utils/qr');
const { generateReceipt } = require('../utils/pdf');
const { sendWhatsApp, sendWhatsAppWithPDF, templates } = require('../utils/whatsapp');
const { generateParcelId, generateTrackingId, buildQRData } = require('../utils/helpers');
const { createParcelSchema } = require('../utils/schemas');
const { z } = require('zod');

function getLogger(req) {
    return req.app.get('logger') || console;
}

function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) return res.status(400).json({ message: 'Validation error', errors: result.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
        req.validated = result.data;
        next();
    };
}

const staffAuth = auth('office_staff', 'company_admin');

router.get('/profile', staffAuth, async (req, res) => {
    try {
        if (!req.user.office_id) return res.status(404).json({ message: 'No office assigned' });
        const { rows } = await db.query('SELECT id, name, address, phone FROM offices WHERE id=$1', [req.user.office_id]);
        res.json(rows[0] || null);
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.get('/parcels', staffAuth, async (req, res) => {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);
    const offset = (page - 1) * limit;
    const officeId = req.user.office_id;
    if (!officeId) return res.status(400).json({ message: 'No office assigned' });
    let q = `SELECT p.id, p.parcel_id, p.tracking_id, p.status, p.sender_name, p.sender_phone,
                    p.receiver_name, p.receiver_phone, p.weight_kg, p.fee_paid,
                    p.payment_method, p.parcel_type, p.pricing_option,
                    p.created_at, p.dispatched_at, p.arrived_at, p.picked_up_at,
                    so.name as sending_office_name, ro.name as receiving_office_name,
                    ro.address as receiving_office_address
            FROM parcels p
            LEFT JOIN offices so ON so.id=p.sending_office_id
            LEFT JOIN offices ro ON ro.id=p.receiving_office_id
            WHERE p.company_id=$1 AND (p.sending_office_id=$2 OR p.receiving_office_id=$2)`;
    const params = [req.user.company_id, officeId];
    let countQ = 'SELECT COUNT(*) FROM parcels WHERE company_id=$1 AND (sending_office_id=$2 OR receiving_office_id=$2)';
    const countParams = [req.user.company_id, officeId];
    if (status) {
        params.push(status);
        q += ` AND p.status=$${params.length}`;
        countParams.push(status);
        countQ += ` AND status=$${countParams.length}`;
    }
    q += ' ORDER BY p.created_at DESC';
    params.push(limit, offset);
    q += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    try {
        const [parcelsRes, countRes] = await Promise.all([
            db.query(q, params),
            db.query(countQ, countParams)
        ]);
        res.json({
            parcels: parcelsRes.rows,
            pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) }
        });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.get('/parcels/:id', staffAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name,
                    ro.address as receiving_office_address
             FROM parcels p
             LEFT JOIN offices so ON so.id=p.sending_office_id
             LEFT JOIN offices ro ON ro.id=p.receiving_office_id
             WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Not found' });
        const p = rows[0];
        if (p.sender_id_number) {
            const decrypted = decrypt(p.sender_id_number) || '';
            p.sender_id_masked = decrypted.length > 4 ? '***' + decrypted.slice(-4) : '****';
        }
        delete p.sender_id_number;
        logRead(req.user.id, req.user.company_id, 'VIEW_PARCEL_DETAIL', { parcel_id: p.id, tracking_id: p.tracking_id });
        res.json(p);
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

async function calculateFee(companyId, destinationOfficeId, parcelType, weightKg, optionName) {
    const opt = parcelType === 'one_time' ? (optionName || 'Standard') : 'Standard';
    const { rows } = await db.query(
        'SELECT price FROM parcel_pricing WHERE company_id=$1 AND destination_office_id=$2 AND parcel_type=$3 AND option_name=$4',
        [companyId, destinationOfficeId, parcelType, opt]
    );
    if (rows.length) {
        const price = parseFloat(rows[0].price);
        return parcelType === 'per_kg' ? price * Math.ceil(parseFloat(weightKg || 1)) : price;
    }
    return 100 + Math.ceil(parseFloat(weightKg || 1)) * 20;
}

function logUserAction(companyId, userId, action, details) {
    return db.query(
        'INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1,$2,$3,$4)',
        [companyId, userId, action, JSON.stringify(details)]
    );
}

router.post('/parcels', staffAuth, validate(createParcelSchema), async (req, res) => {
    const { senderName, senderPhone, senderIdNumber, receiverName, receiverPhone, receivingOfficeId, weightKg, paymentMethod, notes, parcelType, pricingOption } = req.validated;
    if (!req.user.office_id) {
        return res.status(400).json({ message: 'You must be assigned to an office to create parcels' });
    }
    const method = paymentMethod === 'cash' ? 'cash' : 'mpesa';
    try {
        const compRes = await db.query(
            'SELECT id, name, approved, subscription_status, subscription_plan, trial_end_date, phone, mpesa_configured, mpesa_environment, mpesa_shortcode, mpesa_consumer_key, mpesa_consumer_secret, mpesa_passkey FROM companies WHERE id=$1',
            [req.user.company_id]
        );
        const company = compRes.rows[0];
        const fee = await calculateFee(req.user.company_id, receivingOfficeId, parcelType || 'one_time', weightKg, pricingOption);
        const encryptedId = senderIdNumber ? encrypt(senderIdNumber) : null;
        if (method === 'cash') {
            const officeRes = await db.query(
                'SELECT id, name, address FROM offices WHERE id=$1 OR id=$2',
                [req.user.office_id, receivingOfficeId]
            );
            const officeMap = {};
            const officeAddrMap = {};
            officeRes.rows.forEach(r => { officeMap[r.id] = r.name; officeAddrMap[r.id] = r.address; });
            const sendingOfficeName = officeMap[req.user.office_id] || '';
            const receivingOfficeName = officeMap[receivingOfficeId] || '';
            const receivingOfficeAddress = officeAddrMap[receivingOfficeId] || '';
            const [parcelId, trackingId] = await Promise.all([
                generateParcelId(db),
                generateTrackingId(db),
            ]);
            const qrData = buildQRData({
                parcel_id: parcelId, tracking_id: trackingId,
                sender_name: senderName, sender_phone: senderPhone,
                receiver_name: receiverName, receiver_phone: receiverPhone,
                sending_office_name: sendingOfficeName, receiving_office_name: receivingOfficeName,
                created_at: new Date(),
            });
            const qrCode = await generateQR(qrData);
            const parcelRes = await db.query(
                `INSERT INTO parcels (company_id, parcel_id, tracking_id, qr_code, sending_office_id, receiving_office_id,
                 status, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone,
                 weight_kg, fee_paid, payment_method, notes, parcel_type, pricing_option)
                 VALUES ($1,$2,$3,$4,$5,$6,'created',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
                [req.user.company_id, parcelId, trackingId, qrCode, req.user.office_id, receivingOfficeId,
                 senderName, senderPhone, encryptedId, receiverName, receiverPhone,
                 weightKg, fee, 'cash', notes || null, parcelType || 'one_time', pricingOption || null]
            );
            const parcel = parcelRes.rows[0];
            const receiptParcel = {
                ...parcel, sending_office_name: sendingOfficeName,
                receiving_office_name: receivingOfficeName, receiving_office_address: receivingOfficeAddress,
                company_name: company.name, company_phone: company.phone,
            };
            const [senderReceipt, receiverReceipt] = await Promise.all([
                generateReceipt(receiptParcel, 'sender'),
                generateReceipt(receiptParcel, 'receiver'),
            ]);
            sendWhatsAppWithPDF(senderPhone, templates.toSender(company.name, trackingId, fee, receivingOfficeName), senderReceipt, `receipt-${trackingId}-sender.pdf`);
            sendWhatsAppWithPDF(receiverPhone, templates.toReceiver(company.name, trackingId, senderName, receivingOfficeName), receiverReceipt, `receipt-${trackingId}-receiver.pdf`);
            await logUserAction(req.user.company_id, req.user.id, 'CREATED_PARCEL', { tracking_id: trackingId, payment_method: 'cash' });
            return res.status(201).json({ message: 'Parcel created (cash)', parcel: { id: parcel.id, parcel_id: parcelId, tracking_id: trackingId, fee }, paymentMethod: 'cash' });
        }
        if (!company.mpesa_configured) return res.status(400).json({ message: 'Company M-Pesa not configured. Contact your admin.' });
        const parcelRes = await db.query(
            `INSERT INTO parcels (company_id, tracking_id, qr_code, sending_office_id, receiving_office_id, status,
             sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone,
             weight_kg, fee_paid, payment_method, notes, parcel_type, pricing_option)
             VALUES ($1,'PENDING','PENDING',$2,$3,'pending_payment',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [req.user.company_id, req.user.office_id, receivingOfficeId,
             senderName, senderPhone, encryptedId, receiverName, receiverPhone,
             weightKg, fee, 'mpesa', notes || null, parcelType || 'one_time', pricingOption || null]
        );
        const parcel = parcelRes.rows[0];
        const callbackUrl = process.env.PARCEL_MPESA_CALLBACK_URL ||
            process.env.PLATFORM_MPESA_CALLBACK_URL?.replace('platform-callback', 'parcel-callback') ||
            'https://example.com/api/mpesa/parcel-callback';
        const stkResult = await stkPush({
            consumerKey: decrypt(company.mpesa_consumer_key),
            consumerSecret: decrypt(company.mpesa_consumer_secret),
            shortcode: company.mpesa_shortcode,
            passkey: decrypt(company.mpesa_passkey),
            environment: company.mpesa_environment,
            phone: senderPhone, amount: fee, callbackUrl,
            description: `Parcel #${parcel.id} fee`,
        });
        await db.query(
            `INSERT INTO parcel_fee_transactions (parcel_id, company_id, checkout_request_id, amount) VALUES ($1,$2,$3,$4)`,
            [parcel.id, req.user.company_id, stkResult.CheckoutRequestID, fee]
        );
        await logUserAction(req.user.company_id, req.user.id, 'CREATED_PARCEL', { tracking_id: parcel.id, payment_method: 'mpesa' });
        res.status(201).json({ message: 'STK Push sent', parcel: { id: parcel.id, fee }, paymentMethod: 'mpesa' });
    } catch (err) {
        getLogger(req).error('Create parcel error', { error: err.message });
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/parcels/:id/retry', staffAuth, async (req, res) => {
    try {
        const parcelRes = await db.query(
            'SELECT id, parcel_id, tracking_id, qr_code, status, sending_office_id, receiving_office_id, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone, weight_kg, fee_paid, payment_method, notes, parcel_type, pricing_option, payment_retry_count, created_at, dispatched_at, arrived_at, picked_up_at, vehicle_numberplate FROM parcels WHERE id=$1 AND company_id=$2',
            [req.params.id, req.user.company_id]
        );
        if (!parcelRes.rows.length) return res.status(404).json({ message: 'Not found' });
        const parcel = parcelRes.rows[0];
        if (!['pending_payment', 'payment_failed'].includes(parcel.status)) {
            return res.status(400).json({ message: 'Cannot retry this parcel' });
        }
        if (parcel.payment_retry_count >= 3) {
            return res.status(400).json({ message: 'Max retries exceeded' });
        }
        const compRes = await db.query(
            'SELECT id, name, approved, subscription_status, subscription_plan, trial_end_date, phone, mpesa_configured, mpesa_environment, mpesa_shortcode, mpesa_consumer_key, mpesa_consumer_secret, mpesa_passkey FROM companies WHERE id=$1',
            [req.user.company_id]
        );
        const company = compRes.rows[0];
        const callbackUrl = process.env.PARCEL_MPESA_CALLBACK_URL || 'https://example.com/api/mpesa/parcel-callback';
        const stkResult = await stkPush({
            consumerKey: decrypt(company.mpesa_consumer_key),
            consumerSecret: decrypt(company.mpesa_consumer_secret),
            shortcode: company.mpesa_shortcode,
            passkey: decrypt(company.mpesa_passkey),
            environment: company.mpesa_environment,
            phone: parcel.sender_phone,
            amount: parcel.fee_paid,
            callbackUrl, description: `Retry Parcel #${parcel.id}`,
        });
        await db.query('UPDATE parcels SET payment_retry_count=payment_retry_count+1, status=$1 WHERE id=$2', ['pending_payment', parcel.id]);
        await db.query(`INSERT INTO parcel_fee_transactions (parcel_id, company_id, checkout_request_id, amount, retry_count) VALUES ($1,$2,$3,$4,$5)`,
            [parcel.id, req.user.company_id, stkResult.CheckoutRequestID, parcel.fee_paid, parcel.payment_retry_count + 1]);
        await logUserAction(req.user.company_id, req.user.id, 'RETRY_PAYMENT', { tracking_id: parcel.tracking_id });
        res.json({ message: 'Retry STK Push sent' });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.post('/parcels/:id/resend-whatsapp', staffAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name
             FROM parcels p LEFT JOIN offices so ON so.id=p.sending_office_id LEFT JOIN offices ro ON ro.id=p.receiving_office_id
             WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Not found' });
        const p = rows[0];
        if (p.status === 'arrived') {
            await sendWhatsApp(p.receiver_phone, templates.arrived(p.tracking_id, p.receiving_office_name));
        } else if (p.status === 'picked_up') {
            await sendWhatsApp(p.sender_phone, templates.pickedUp(p.tracking_id));
        }
        await logUserAction(req.user.company_id, req.user.id, 'RESENT_WHATSAPP', { tracking_id: p.tracking_id, status: p.status });
        res.json({ message: 'WhatsApp notification resent' });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.get('/parcels/:id/print', staffAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name,
                    ro.address as receiving_office_address, c.name as company_name
             FROM parcels p
             LEFT JOIN offices so ON so.id=p.sending_office_id
             LEFT JOIN offices ro ON ro.id=p.receiving_office_id
             LEFT JOIN companies c ON c.id=p.company_id
             WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).send('Not found');
        const p = rows[0];
        const qrData = buildQRData(p);
        const qrDataUrl = await generateQR(qrData);
        const parcelDate = new Date(p.created_at).toLocaleDateString();
        const company = p.company_name || 'PARCEL';
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Parcel Sticker – ${p.tracking_id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;padding:16px;background:#fff}
  .sticker{border:3px dashed #011f4b;border-radius:12px;padding:18px;max-width:380px;margin:0 auto;text-align:center}
  .brand{color:#011f4b;font-size:12px;font-weight:800;letter-spacing:2px;margin-bottom:10px}
  .qr-wrap{margin:8px 0}
  .tracking{font-size:20px;font-weight:800;color:#011f4b;letter-spacing:2px;margin:10px 0 8px}
  .cut-line{font-size:9px;color:#999;margin-top:12px;letter-spacing:1px}
  .powered{font-size:8px;color:#aaa;margin-top:6px;letter-spacing:0.5px}
  .print-btn{display:block;margin:16px auto 0;background:#011f4b;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px}
  @media print{.print-btn{display:none!important}body{padding:0}.sticker{border:2px solid #000;page-break-inside:avoid}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Print Sticker</button>
<div class="sticker">
  <div class="brand">${company.replace(/[<>]/g, '')}</div>
  <div class="qr-wrap"><img src="${qrDataUrl}" width="180" height="180" alt="QR"/></div>
  <div class="tracking">${(p.tracking_id || 'PENDING').replace(/[<>]/g, '')}</div>
  <div class="cut-line">Cut & stick on parcel</div>
  <div class="powered">Powered by OpenDesk</div>
</div></body></html>`;
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'");
        res.send(html);
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).send('Server error'); }
});

router.get('/parcels/:id/receipt', staffAuth, async (req, res) => {
    const type = req.query.type === 'receiver' ? 'receiver' : 'sender';
    try {
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name,
                    ro.address as receiving_office_address, c.name as company_name, c.phone as company_phone
             FROM parcels p
             LEFT JOIN offices so ON so.id=p.sending_office_id
             LEFT JOIN offices ro ON ro.id=p.receiving_office_id
             LEFT JOIN companies c ON c.id=p.company_id
             WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Not found' });
        const p = rows[0];
        if (p.sender_id_number) {
            const dec = decrypt(p.sender_id_number) || '';
            p.sender_id_number = dec.length > 4 ? '***' + dec.slice(-4) : '****';
        }
        logRead(req.user.id, req.user.company_id, 'VIEW_RECEIPT', { parcel_id: p.id, tracking_id: p.tracking_id, receipt_type: type });
        const pdf = await generateReceipt(p, type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${p.tracking_id}-${type}.pdf"`);
        res.send(pdf);
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.get('/revenue', staffAuth, async (req, res) => {
    const cid = req.user.company_id;
    const days = parseInt(req.query.days) || 30;
    try {
        const { rows } = await db.query(`
      SELECT DATE(created_at) AS day, payment_method, COALESCE(SUM(fee_paid),0) AS total
      FROM parcels WHERE company_id=$1 AND status NOT IN ('pending_payment','payment_failed')
        AND created_at >= NOW() - $2::INTERVAL
      GROUP BY day, payment_method ORDER BY day DESC`, [cid, days + ' days']);
        res.json(rows);
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.put('/parcels/tracking/:trackingId/dispatch', staffAuth, async (req, res) => {
    const { trackingId } = req.params;
    const { vehicleNumberplate } = req.body;
    if (!vehicleNumberplate || vehicleNumberplate.trim() === '') {
        return res.status(400).json({ message: 'Vehicle numberplate is required' });
    }
    try {
        const { rows } = await db.query(
            'SELECT id, parcel_id, tracking_id, qr_code, status, sending_office_id, receiving_office_id, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone, weight_kg, fee_paid, payment_method, notes, parcel_type, pricing_option, payment_retry_count, created_at, dispatched_at, arrived_at, picked_up_at, vehicle_numberplate FROM parcels WHERE tracking_id=$1 AND company_id=$2',
            [trackingId, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const parcel = rows[0];
        if (parcel.status !== 'created' && parcel.status !== 'dispatched') {
            return res.status(400).json({ message: `Parcel cannot be dispatched from status: ${parcel.status}` });
        }
        await db.query(
            `UPDATE parcels SET status='dispatched', vehicle_numberplate=$1, dispatched_at=CURRENT_TIMESTAMP WHERE id=$2`,
            [vehicleNumberplate.trim(), parcel.id]
        );
        await logUserAction(req.user.company_id, req.user.id, 'DISPATCHED_PARCEL', { tracking_id: parcel.tracking_id, vehicle: vehicleNumberplate.trim() });
        res.json({ message: 'Parcel dispatched' });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.put('/parcels/tracking/:trackingId/receive', staffAuth, async (req, res) => {
    const { trackingId } = req.params;
    try {
        const { rows } = await db.query(
            'SELECT id, parcel_id, tracking_id, qr_code, status, sending_office_id, receiving_office_id, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone, weight_kg, fee_paid, payment_method, notes, parcel_type, pricing_option, payment_retry_count, created_at, dispatched_at, arrived_at, picked_up_at, vehicle_numberplate FROM parcels WHERE tracking_id=$1 AND company_id=$2',
            [trackingId, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const parcel = rows[0];
        if (parcel.status !== 'dispatched') {
            return res.status(400).json({ message: `Parcel is not in dispatched state (current: ${parcel.status})` });
        }
        if (parcel.receiving_office_id !== req.user.office_id) {
            return res.status(403).json({ message: 'This parcel is destined for a different office' });
        }
        await db.query(`UPDATE parcels SET status='arrived', arrived_at=CURRENT_TIMESTAMP WHERE id=$1`, [parcel.id]);
        await logUserAction(req.user.company_id, req.user.id, 'RECEIVED_PARCEL', { tracking_id: parcel.tracking_id });
        if (parcel.receiver_phone) {
            const { rows: officeRows } = await db.query('SELECT name FROM offices WHERE id=$1', [parcel.receiving_office_id]);
            if (officeRows.length) {
                sendWhatsApp(parcel.receiver_phone, templates.arrived(parcel.tracking_id, officeRows[0].name));
            }
        }
        res.json({ message: 'Parcel marked as arrived' });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.put('/parcels/tracking/:trackingId/collect', staffAuth, async (req, res) => {
    const { trackingId } = req.params;
    try {
        const { rows } = await db.query(
            'SELECT id, parcel_id, tracking_id, qr_code, status, sending_office_id, receiving_office_id, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone, weight_kg, fee_paid, payment_method, notes, parcel_type, pricing_option, payment_retry_count, created_at, dispatched_at, arrived_at, picked_up_at, vehicle_numberplate FROM parcels WHERE tracking_id=$1 AND company_id=$2',
            [trackingId, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const parcel = rows[0];
        if (parcel.status !== 'arrived') {
            return res.status(400).json({ message: `Parcel is not ready for collection (current: ${parcel.status})` });
        }
        if (parcel.receiving_office_id !== req.user.office_id) {
            return res.status(403).json({ message: 'Cannot collect from a different destination office' });
        }
        await db.query(`UPDATE parcels SET status='picked_up', picked_up_at=CURRENT_TIMESTAMP WHERE id=$1`, [parcel.id]);
        await logUserAction(req.user.company_id, req.user.id, 'COLLECTED_PARCEL', { tracking_id: parcel.tracking_id });
        if (parcel.sender_phone) {
            sendWhatsApp(parcel.sender_phone, templates.pickedUp(parcel.tracking_id));
        }
        res.json({ message: 'Parcel collected and verified' });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

router.get('/stats', staffAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT status, sending_office_id, receiving_office_id, COUNT(*) as count
             FROM parcels WHERE company_id=$1 AND (sending_office_id=$2 OR receiving_office_id=$2)
             GROUP BY status, sending_office_id, receiving_office_id`,
            [req.user.company_id, req.user.office_id]
        );
        let pendingDispatch = 0, inTransitInbound = 0, readyForCollection = 0;
        rows.forEach(r => {
            const count = parseInt(r.count);
            if (r.status === 'created' && r.sending_office_id === req.user.office_id) pendingDispatch += count;
            if (r.status === 'dispatched' && r.receiving_office_id === req.user.office_id) inTransitInbound += count;
            if (r.status === 'arrived' && r.receiving_office_id === req.user.office_id) readyForCollection += count;
        });
        res.json({ pending_dispatch: pendingDispatch, in_transit_inbound: inTransitInbound, ready_for_collection: readyForCollection });
    } catch (err) { getLogger(req).error('Operation error', { error: err.message }); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;

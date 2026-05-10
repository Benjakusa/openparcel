const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { stkPush } = require('../utils/mpesa');
const { generateQR, generateQRBuffer } = require('../utils/qr');
const { generateReceipt } = require('../utils/pdf');
const { sendWhatsApp, sendWhatsAppWithPDF, templates } = require('../utils/whatsapp');
const { generateParcelId, generateTrackingId, buildQRData } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');

const staffAuth = auth('office_staff', 'company_admin');

// GET /api/office/profile
router.get('/profile', staffAuth, async (req, res) => {
    try {
        if (!req.user.office_id) return res.status(404).json({ message: 'No office assigned' });
        const { rows } = await db.query('SELECT * FROM offices WHERE id=$1', [req.user.office_id]);
        res.json(rows[0] || null);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/office/parcels
router.get('/parcels', staffAuth, async (req, res) => {
    const { status, limit = 50 } = req.query;
    const officeId = req.user.office_id || null;
    let q = `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name,
                    ro.address as receiving_office_address
            FROM parcels p
            LEFT JOIN offices so ON so.id=p.sending_office_id
            LEFT JOIN offices ro ON ro.id=p.receiving_office_id
            WHERE p.company_id=$1 AND (p.sending_office_id=$2 OR p.receiving_office_id=$2)`;
    const params = [req.user.company_id, officeId];
    if (status) { params.push(status); q += ` AND p.status=$${params.length}`; }
    q += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)}`;
    try {
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/office/parcels/:id
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
        // Mask ID
        if (p.sender_id_number) {
            const decrypted = decrypt(p.sender_id_number) || '';
            p.sender_id_masked = decrypted.length > 4 ? '***' + decrypted.slice(-4) : '****';
        }
        delete p.sender_id_number;
        res.json(p);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/office/parcels – create parcel + STK Push
router.post('/parcels', staffAuth, async (req, res) => {
    const { senderName, senderPhone, senderIdNumber, receiverName, receiverPhone, receivingOfficeId, weightKg, paymentMethod } = req.body;
    if (!senderName || !senderPhone || !receiverName || !receiverPhone || !receivingOfficeId || !weightKg) {
        return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (!req.user.office_id) {
        return res.status(400).json({ message: 'You must be assigned to an office to create parcels' });
    }

    const method = paymentMethod === 'cash' ? 'cash' : 'mpesa';

    try {
        const compRes = await db.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
        const company = compRes.rows[0];

        const fee = 100 + Math.ceil(parseFloat(weightKg)) * 20;
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
                parcel_id: parcelId,
                tracking_id: trackingId,
                sender_name: senderName,
                sender_phone: senderPhone,
                receiver_name: receiverName,
                receiver_phone: receiverPhone,
                sending_office_name: sendingOfficeName,
                receiving_office_name: receivingOfficeName,
                created_at: new Date(),
            });
            const qrCode = await generateQR(qrData);

            const parcelRes = await db.query(
                `INSERT INTO parcels (company_id, parcel_id, tracking_id, qr_code, sending_office_id, receiving_office_id, status, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone, weight_kg, fee_paid)
           VALUES ($1,$2,$3,$4,$5,$6,'created',$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
                [req.user.company_id, parcelId, trackingId, qrCode, req.user.office_id, receivingOfficeId, senderName, senderPhone, encryptedId, receiverName, receiverPhone, weightKg, fee]
            );
            const parcel = parcelRes.rows[0];

            // Send WhatsApp receipts
            const receiptParcel = {
                ...parcel,
                sending_office_name: sendingOfficeName,
                receiving_office_name: receivingOfficeName,
                receiving_office_address: receivingOfficeAddress,
                company_name: company.name,
            };
            const senderReceipt = await generateReceipt(receiptParcel, 'sender');
            const receiverReceipt = await generateReceipt(receiptParcel, 'receiver');

            sendWhatsAppWithPDF(
                senderPhone,
                templates.toSender(company.name, trackingId, fee, receivingOfficeName),
                senderReceipt,
                `receipt-${trackingId}-sender.pdf`
            );
            sendWhatsAppWithPDF(
                receiverPhone,
                templates.toReceiver(company.name, trackingId, senderName, receivingOfficeName),
                receiverReceipt,
                `receipt-${trackingId}-receiver.pdf`
            );

            return res.status(201).json({ message: 'Parcel created (cash payment)', parcel: { id: parcel.id, parcel_id: parcelId, tracking_id: trackingId, fee }, paymentMethod: 'cash' });
        }

        // M-Pesa flow
        if (!company.mpesa_configured) return res.status(400).json({ message: 'Company M-Pesa not configured. Contact your admin.' });

        const parcelRes = await db.query(
            `INSERT INTO parcels (company_id, tracking_id, qr_code, sending_office_id, receiving_office_id, status, sender_name, sender_phone, sender_id_number, receiver_name, receiver_phone, weight_kg, fee_paid)
       VALUES ($1,'PENDING','PENDING',$2,$3,'pending_payment',$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [req.user.company_id, req.user.office_id, receivingOfficeId, senderName, senderPhone, encryptedId, receiverName, receiverPhone, weightKg, fee]
        );
        const parcel = parcelRes.rows[0];

        const callbackUrl = process.env.PARCEL_MPESA_CALLBACK_URL || process.env.PLATFORM_MPESA_CALLBACK_URL?.replace('platform-callback', 'parcel-callback') || 'https://example.com/api/mpesa/parcel-callback';
        const stkResult = await stkPush({
            consumerKey: decrypt(company.mpesa_consumer_key),
            consumerSecret: decrypt(company.mpesa_consumer_secret),
            shortcode: company.mpesa_shortcode,
            passkey: decrypt(company.mpesa_passkey),
            environment: company.mpesa_environment,
            phone: senderPhone,
            amount: fee,
            callbackUrl,
            description: `Parcel #${parcel.id} fee`,
        });

        await db.query(
            `INSERT INTO parcel_fee_transactions (parcel_id, company_id, checkout_request_id, amount) VALUES ($1,$2,$3,$4)`,
            [parcel.id, req.user.company_id, stkResult.CheckoutRequestID, fee]
        );

        res.status(201).json({ message: 'STK Push sent', parcel: { id: parcel.id, fee }, paymentMethod: 'mpesa' });
    } catch (err) {
        console.error('Create parcel error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/office/parcels/:id/retry
router.post('/parcels/:id/retry', staffAuth, async (req, res) => {
    try {
        const parcelRes = await db.query('SELECT * FROM parcels WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
        if (!parcelRes.rows.length) return res.status(404).json({ message: 'Not found' });
        const parcel = parcelRes.rows[0];
        if (!['pending_payment', 'payment_failed'].includes(parcel.status)) {
            return res.status(400).json({ message: 'Cannot retry this parcel' });
        }
        if (parcel.payment_retry_count >= 3) {
            return res.status(400).json({ message: 'Max retries exceeded' });
        }
        const compRes = await db.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
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
            callbackUrl,
            description: `Retry Parcel #${parcel.id}`,
        });
        await db.query('UPDATE parcels SET payment_retry_count=payment_retry_count+1, status=$1 WHERE id=$2', ['pending_payment', parcel.id]);
        await db.query(`INSERT INTO parcel_fee_transactions (parcel_id, company_id, checkout_request_id, amount, retry_count) VALUES ($1,$2,$3,$4,$5)`,
            [parcel.id, req.user.company_id, stkResult.CheckoutRequestID, parcel.fee_paid, parcel.payment_retry_count + 1]);
        res.json({ message: 'Retry STK Push sent' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/office/parcels/:id/resend-whatsapp
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
        res.json({ message: 'WhatsApp notification resent' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/office/parcels/:id/print – HTML sticker
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;padding:16px;background:#fff}
  .sticker{border:3px dashed #011f4b;border-radius:12px;padding:18px;max-width:380px;margin:0 auto;text-align:center}
  .brand{color:#011f4b;font-size:12px;font-weight:800;letter-spacing:2px;margin-bottom:10px}
  .qr-wrap{margin:8px 0}
  .tracking{font-size:20px;font-weight:800;color:#011f4b;letter-spacing:2px;margin:10px 0 8px}
  .cut-line{font-size:9px;color:#999;margin-top:12px;letter-spacing:1px}
  .powered{font-size:8px;color:#aaa;margin-top:6px;letter-spacing:0.5px}
  .print-btn{display:block;margin:16px auto 0;background:#011f4b;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px}
  @media print{.print-btn,.instructions{display:none!important}body{padding:0}.sticker{border:2px solid #000;page-break-inside:avoid}}
</style>
</head><body>
<div class="instructions" style="text-align:center;margin-bottom:12px">
  <button class="print-btn" onclick="window.print()">Print Sticker</button>
</div>
<div class="sticker">
  <div class="brand">${company}</div>
  <div class="qr-wrap"><img src="${qrDataUrl}" width="180" height="180" alt="QR"/></div>
  <div class="tracking">${p.tracking_id || 'PENDING'}</div>
  <div class="cut-line">Cut & stick on parcel</div>
  <div class="powered">Powered by OpenDesk</div>
</div>
</body></html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) { res.status(500).send(err.message); }
});

// GET /api/office/parcels/:id/receipt?type=sender|receiver
router.get('/parcels/:id/receipt', staffAuth, async (req, res) => {
    const type = req.query.type === 'receiver' ? 'receiver' : 'sender';
    try {
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name, ro.address as receiving_office_address, c.name as company_name
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
        const pdf = await generateReceipt(p, type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${p.tracking_id}-${type}.pdf"`);
        res.send(pdf);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/office/revenue – daily revenue breakdown (cash + mpesa)
router.get('/revenue', staffAuth, async (req, res) => {
    const cid = req.user.company_id;
    const days = parseInt(req.query.days) || 30;
    try {
        const { rows } = await db.query(`
      SELECT DATE(created_at) AS day, payment_method, COALESCE(SUM(fee_paid),0) AS total
      FROM parcels
      WHERE company_id=$1
        AND status NOT IN ('pending_payment','payment_failed')
        AND created_at >= NOW() - $2::INTERVAL
      GROUP BY day, payment_method
      ORDER BY day DESC`, [cid, days + ' days']);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});


// PUT /api/office/parcels/tracking/:trackingId/dispatch
router.put('/parcels/tracking/:trackingId/dispatch', staffAuth, async (req, res) => {
    const { trackingId } = req.params;
    const { vehicleNumberplate } = req.body;
    if (!vehicleNumberplate || vehicleNumberplate.trim() === '') {
        return res.status(400).json({ message: 'Vehicle numberplate is required' });
    }
    try {
        const { rows } = await db.query(
            'SELECT * FROM parcels WHERE tracking_id=$1 AND company_id=$2',
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
        res.json({ message: 'Parcel explicitly dispatched' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/office/parcels/tracking/:trackingId/receive
router.put('/parcels/tracking/:trackingId/receive', staffAuth, async (req, res) => {
    const { trackingId } = req.params;
    try {
        const { rows } = await db.query(
            'SELECT * FROM parcels WHERE tracking_id=$1 AND company_id=$2',
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
        
        await db.query(
            `UPDATE parcels SET status='arrived', arrived_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [parcel.id]
        );
        
        // WhatsApp notification
        const { rows: officeRows } = await db.query('SELECT name FROM offices WHERE id=$1', [parcel.receiving_office_id]);
        if (officeRows.length > 0 && parcel.receiver_phone) {
            const { sendWhatsApp, templates } = require('../utils/whatsapp');
            sendWhatsApp(parcel.receiver_phone, templates.arrived(parcel.tracking_id, officeRows[0].name));
        }
        
        res.json({ message: 'Parcel marked as arrived' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/office/parcels/tracking/:trackingId/collect
router.put('/parcels/tracking/:trackingId/collect', staffAuth, async (req, res) => {
    const { trackingId } = req.params;
    try {
        const { rows } = await db.query(
            'SELECT * FROM parcels WHERE tracking_id=$1 AND company_id=$2',
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
        
        await db.query(
            `UPDATE parcels SET status='picked_up', picked_up_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [parcel.id]
        );
        
        // WhatsApp notification to sender
        if (parcel.sender_phone) {
            const { sendWhatsApp, templates } = require('../utils/whatsapp');
            sendWhatsApp(parcel.sender_phone, templates.pickedUp(parcel.tracking_id));
        }
        
        res.json({ message: 'Parcel successfully collected and verified' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});


// GET /api/office/stats
router.get('/stats', staffAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT status, sending_office_id, receiving_office_id, COUNT(*) as count 
             FROM parcels 
             WHERE company_id=$1 AND (sending_office_id=$2 OR receiving_office_id=$2)
             GROUP BY status, sending_office_id, receiving_office_id`,
            [req.user.company_id, req.user.office_id]
        );
        
        let pendingDispatch = 0;
        let inTransitInbound = 0;
        let readyForCollection = 0;
        
        rows.forEach(r => {
            const count = parseInt(r.count);
            if (r.status === 'created' && r.sending_office_id === req.user.office_id) {
                pendingDispatch += count;
            }
            if (r.status === 'dispatched' && r.receiving_office_id === req.user.office_id) {
                inTransitInbound += count;
            }
            if (r.status === 'arrived' && r.receiving_office_id === req.user.office_id) {
                readyForCollection += count;
            }
        });
        
        res.json({
            pending_dispatch: pendingDispatch,
            in_transit_inbound: inTransitInbound,
            ready_for_collection: readyForCollection
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

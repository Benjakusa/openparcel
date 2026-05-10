const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');
const { companySTKPush, calculateParcelFee } = require('../utils/mpesa');
const { generateParcelId, generateTrackingId, generateQRDataURL } = require('../utils/qr');
const { generateReceipt } = require('../utils/pdf');
const { sendWhatsApp, templates } = require('../utils/whatsapp');
const { decrypt } = require('../utils/crypto');
const logger = require('../utils/logger');

router.use(requireAuth);
router.use(requireRole('office_staff', 'company_admin'));
router.use(tenantCheck);

// GET /api/office/profile
router.get('/profile', async (req, res, next) => {
    try {
        if (!req.user.office_id) return res.status(400).json({ message: 'No office assigned' });
        const { rows } = await pool.query(
            'SELECT * FROM offices WHERE id=$1 AND company_id=$2',
            [req.user.office_id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Office not found' });
        res.json(rows[0]);
    } catch (err) { next(err); }
});

// GET /api/office/parcels
router.get('/parcels', async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const officeId = req.user.office_id;

        let query = `
      SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      WHERE p.company_id=$1
        AND (p.sending_office_id=$2 OR p.receiving_office_id=$2)
    `;
        const params = [req.user.company_id, officeId];
        if (status) { params.push(status); query += ` AND p.status=$${params.length}`; }
        query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) { next(err); }
});

// POST /api/office/parcels – Create parcel with M-Pesa payment
router.post('/parcels', async (req, res, next) => {
    try {
        const {
            senderName, senderPhone, senderIdNumber,
            receiverName, receiverPhone,
            receivingOfficeId, weightKg, notes, paymentMethod
        } = req.body;

        if (!senderName || !senderPhone || !receiverName || !receiverPhone || !receivingOfficeId || !weightKg) {
            return res.status(400).json({ message: 'All required fields must be provided' });
        }

        // Verify receiving office is in the same company
        const officeCheck = await pool.query(
            'SELECT * FROM offices WHERE id=$1 AND company_id=$2',
            [receivingOfficeId, req.user.company_id]
        );
        if (!officeCheck.rows.length) return res.status(400).json({ message: 'Invalid receiving office' });

        // Get company M-Pesa config
        const companyRes = await pool.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
        const company = companyRes.rows[0];
        if (paymentMethod === 'mpesa' && !company.mpesa_configured) {
            return res.status(400).json({ message: 'Company M-Pesa is not configured. Ask your admin to set up M-Pesa credentials.' });
        }

        const fee = calculateParcelFee(weightKg);
        const { encrypt } = require('../utils/crypto');

        // Generate unique identifiers
        const parcelId = await generateParcelId(pool);
        let trackingId = null;
        let qrCode = null;

        if (paymentMethod === 'cash') {
            trackingId = await generateTrackingId(pool);
            const qrPayload = {
                id: trackingId,
                s_name: senderName || '',
                s_phone: senderPhone || '',
                r_name: receiverName || '',
                r_phone: receiverPhone || '',
                date: new Date().toLocaleDateString(),
                from: '',
                to: '',
            };
            qrCode = await generateQRDataURL(qrPayload);
        }

        // If cash, status is 'created', otherwise 'pending_payment'
        const initialStatus = paymentMethod === 'cash' ? 'created' : 'pending_payment';

        // Create parcel
        const parcelRes = await pool.query(`
      INSERT INTO parcels
        (company_id, parcel_id, tracking_id, qr_code, sending_office_id, receiving_office_id,
         sender_name, sender_phone, sender_id_number,
         receiver_name, receiver_phone, weight_kg, fee_paid, notes, status, payment_method)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
            [
                req.user.company_id, parcelId, trackingId, qrCode,
                req.user.office_id, receivingOfficeId,
                senderName, senderPhone, senderIdNumber ? encrypt(senderIdNumber) : null,
                receiverName, receiverPhone, weightKg, fee, notes, initialStatus, paymentMethod || 'mpesa'
            ]
        );
        const parcel = parcelRes.rows[0];

        // Audit Trail
        await pool.query(
            "INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1,$2,$3,$4)",
            [req.user.company_id, req.user.id, 'CREATED_PARCEL', JSON.stringify({ tracking_id: trackingId, payment_method: paymentMethod })]
        );

        if (paymentMethod === 'cash') {
            return res.status(201).json({
                message: 'Parcel created (Paid via Cash).',
                parcel: { id: parcel.id, parcel_id: parcelId, tracking_id: trackingId, fee, status: 'created', paymentMethod: 'cash' },
            });
        }

        // Initiate STK Push (for M-Pesa)
        const callbackUrl = `${process.env.PLATFORM_MPESA_CALLBACK_URL?.replace('platform-callback', 'parcel-callback') || 'https://your-domain.com/api/mpesa/parcel-callback'}`;

        try {
            const stkResult = await companySTKPush({
                company,
                phone: senderPhone,
                amount: fee,
                accountRef: `PARCEL-${parcel.id}`,
                description: 'Parcel Fee Payment',
                callbackUrl,
            });

            // Save transaction
            await pool.query(`
        INSERT INTO parcel_fee_transactions (parcel_id, company_id, checkout_request_id, amount, status)
        VALUES ($1,$2,$3,$4,'pending')`,
                [parcel.id, req.user.company_id, stkResult.CheckoutRequestID, fee]
            );

            res.status(201).json({
                message: 'Parcel created. STK Push sent to sender\'s phone.',
                parcel: { id: parcel.id, fee, status: 'pending_payment' },
                checkoutRequestId: stkResult.CheckoutRequestID,
            });
        } catch (stkErr) {
            // Cleanup parcel on STK failure
            await pool.query('DELETE FROM parcels WHERE id=$1', [parcel.id]);
            logger.error('STK Push failed when creating parcel:', stkErr.message);
            return res.status(500).json({ message: `Payment initiation failed: ${stkErr.message}` });
        }
    } catch (err) { next(err); }
});

// POST /api/office/parcels/:id/retry
router.post('/parcels/:id/retry', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM parcels WHERE id=$1 AND company_id=$2',
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });

        const parcel = rows[0];
        if (!['pending_payment', 'payment_failed'].includes(parcel.status)) {
            return res.status(400).json({ message: 'Parcel is not in a retryable state' });
        }
        if (parcel.payment_retry_count >= 3) {
            return res.status(400).json({ message: 'Maximum retry attempts reached' });
        }

        const companyRes = await pool.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
        const company = companyRes.rows[0];

        const callbackUrl = `${process.env.PLATFORM_MPESA_CALLBACK_URL?.replace('platform-callback', 'parcel-callback') || 'https://your-domain.com/api/mpesa/parcel-callback'}`;

        const stkResult = await companySTKPush({
            company,
            phone: parcel.sender_phone,
            amount: parcel.fee_paid,
            accountRef: `PARCEL-${parcel.id}`,
            description: 'Parcel Fee Retry',
            callbackUrl,
        });

        await pool.query(
            `UPDATE parcels SET status='pending_payment', payment_retry_count=payment_retry_count+1 WHERE id=$1`,
            [parcel.id]
        );
        await pool.query(`
      INSERT INTO parcel_fee_transactions (parcel_id, company_id, checkout_request_id, amount, status, retry_count)
      VALUES ($1,$2,$3,$4,'pending',$5)`,
            [parcel.id, req.user.company_id, stkResult.CheckoutRequestID, parcel.fee_paid, parcel.payment_retry_count + 1]
        );

        await pool.query(
            "INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1,$2,$3,$4)",
            [req.user.company_id, req.user.id, 'RETRY_PAYMENT', JSON.stringify({ tracking_id: parcel.tracking_id })]
        );

        res.json({ message: 'Retry STK Push sent', checkoutRequestId: stkResult.CheckoutRequestID });
    } catch (err) {
        logger.error('Parcel retry failed:', err.message);
        res.status(500).json({ message: `Retry failed: ${err.message}` });
    }
});

// GET /api/office/parcels/:id
router.get('/parcels/:id', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name, c.name AS company_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      LEFT JOIN companies c ON c.id = p.company_id
      WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });

        const parcel = rows[0];
        // Decrypt sender ID (mask it in response)
        if (parcel.sender_id_number) {
            const raw = decrypt(parcel.sender_id_number);
            parcel.sender_id_masked = raw ? `***${raw.slice(-4)}` : '****';
            delete parcel.sender_id_number; // never expose encrypted blob
        }
        res.json(parcel);
    } catch (err) { next(err); }
});

// POST /api/office/parcels/:id/resend-whatsapp
router.post('/parcels/:id/resend-whatsapp', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const parcel = rows[0];

        const { status } = parcel;
        if (status === 'dispatched') {
            await sendWhatsApp(parcel.receiver_phone, templates.dispatched_receiver(parcel.tracking_id, parcel.sending_office_name, parcel.receiving_office_name));
        } else if (status === 'arrived') {
            await sendWhatsApp(parcel.sender_phone, templates.arrived_sender(parcel.tracking_id, parcel.receiving_office_name));
            await sendWhatsApp(parcel.receiver_phone, templates.arrived_receiver(parcel.tracking_id, parcel.receiving_office_name));
        } else if (status === 'picked_up') {
            await sendWhatsApp(parcel.sender_phone, templates.picked_up_sender(parcel.tracking_id));
        }

        await pool.query(
            "INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1,$2,$3,$4)",
            [req.user.company_id, req.user.id, 'RESENT_WHATSAPP', JSON.stringify({ tracking_id: parcel.tracking_id, status: parcel.status })]
        );

        res.json({ message: 'WhatsApp notification(s) resent' });
    } catch (err) { next(err); }
});

// GET /api/office/parcels/:id/print – HTML sticker page
router.get('/parcels/:id/print', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT p.tracking_id, p.qr_code, so.name AS sending_office, ro.name AS receiving_office,
             p.sender_name, p.sender_phone, p.receiver_name, p.receiver_phone, p.weight_kg, p.created_at,
             c.name AS company_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      LEFT JOIN companies c ON c.id = p.company_id
      WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).send('Parcel not found');
        const p = rows[0];
        const { generateQRDataURL } = require('../utils/qr');

        const qrPayload = {
            id: p.tracking_id,
            s_name: p.sender_name,
            s_phone: p.sender_phone,
            r_name: p.receiver_name,
            r_phone: p.receiver_phone,
            date: new Date(p.created_at).toLocaleDateString(),
            from: p.sending_office || 'N/A',
            to: p.receiving_office || 'N/A'
        };

        const qrDataUrl = await generateQRDataURL(qrPayload);

        const parcelDate = new Date(p.created_at).toLocaleDateString();
        const company = p.company_name || 'PARCEL';

        res.send(`<!DOCTYPE html>
<html>
<head>
<title>Parcel Sticker – ${p.tracking_id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; padding:16px; background:#fff; }
  .sticker { border:3px dashed #011f4b; border-radius:12px; padding:18px; max-width:380px; margin:0 auto; text-align:center; }
  .brand { color:#011f4b; font-size:12px; font-weight:800; letter-spacing:2px; margin-bottom:10px; }
  .qr-wrap { margin:8px 0; }
  .tracking { font-size:20px; font-weight:800; color:#011f4b; letter-spacing:2px; margin:10px 0 8px; }
  .cut-line { font-size:9px; color:#999; margin-top:12px; letter-spacing:1px; }
  .powered { font-size:8px; color:#aaa; margin-top:6px; letter-spacing:0.5px; }
  .print-btn { display:block; margin:16px auto 0; background:#011f4b; color:#fff; border:none; padding:10px 24px; border-radius:6px; cursor:pointer; font-size:14px; }
  @media print {
    .print-btn, .instructions { display:none !important; }
    body { padding:0; }
    .sticker { border:2px solid #000; page-break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="instructions" style="text-align:center;margin-bottom:12px;">
  <button class="print-btn" onclick="window.print()">Print Sticker</button>
</div>
<div class="sticker">
  <div class="brand">${company}</div>
  <div class="qr-wrap"><img src="${qrDataUrl}" width="180" height="180" alt="QR"/></div>
  <div class="tracking">${p.tracking_id || 'PENDING'}</div>
  <div class="cut-line">Cut & stick on parcel</div>
  <div class="powered">Powered by OpenDesk</div>
</div>
</body>
</html>`);
    } catch (err) { next(err); }
});

// GET /api/office/parcels/:id/receipt
router.get('/parcels/:id/receipt', async (req, res, next) => {
    try {
        const type = req.query.type === 'receiver' ? 'receiver' : 'sender';
        const { rows } = await pool.query(`
      SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name, c.name AS company_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      LEFT JOIN companies c ON c.id = p.company_id
      WHERE p.id=$1 AND p.company_id=$2`,
            [req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });

        const parcel = rows[0];
        // Decrypt sender ID for masking in PDF
        parcel.raw_sender_id = parcel.sender_id_number ? decrypt(parcel.sender_id_number) : null;

        const pdfBuffer = await generateReceipt(parcel, type);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=receipt-${parcel.tracking_id}-${type}.pdf`,
        });
        res.send(pdfBuffer);
    } catch (err) { next(err); }
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

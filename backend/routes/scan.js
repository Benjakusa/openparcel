const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { sendWhatsApp, templates } = require('../utils/whatsapp');

// POST /api/scan/lookup
router.post('/lookup', auth('office_staff', 'company_admin'), async (req, res) => {
    const { trackingId } = req.body;
    if (!trackingId) return res.status(400).json({ message: 'trackingId required' });

    try {
        let lookupValue = trackingId;
        try { const parsed = JSON.parse(trackingId); if (parsed.id) lookupValue = parsed.id; } catch (_) { }
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name
        FROM parcels p
        LEFT JOIN offices so ON so.id=p.sending_office_id
        LEFT JOIN offices ro ON ro.id=p.receiving_office_id
        WHERE (p.tracking_id=$1 OR p.qr_code LIKE '%'||$1||'%') AND p.company_id=$2`,
            [lookupValue, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        res.json({ parcel: rows[0] });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/scan
router.post('/', auth('office_staff', 'company_admin'), async (req, res) => {
    const { trackingId, officeId, action } = req.body;
    if (!trackingId || !officeId) return res.status(400).json({ message: 'trackingId and officeId required' });

    try {
        let lookupValue = trackingId;
        try { const parsed = JSON.parse(trackingId); if (parsed.id) lookupValue = parsed.id; } catch (_) { }
        const { rows } = await db.query(
            `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name
        FROM parcels p
        LEFT JOIN offices so ON so.id=p.sending_office_id
        LEFT JOIN offices ro ON ro.id=p.receiving_office_id
        WHERE (p.tracking_id=$1 OR p.qr_code LIKE '%'||$1||'%') AND p.company_id=$2`,
            [lookupValue, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const p = rows[0];

        const oid = parseInt(officeId);
        const isSender = p.sending_office_id === oid;
        const isReceiver = p.receiving_office_id === oid;

        if (!isSender && !isReceiver) {
            return res.status(403).json({ message: 'This office is not associated with this parcel' });
        }

        let newStatus = p.status;
        let message = '';
        let logAction = '';

        // Status transitions
        if ((!action || action === 'dispatch') && p.status === 'created' && isSender) {
            newStatus = 'dispatched';
            message = 'Parcel dispatched!';
            logAction = 'DISPATCHED_PARCEL';
            await db.query('UPDATE parcels SET status=$1, dispatched_at=NOW() WHERE id=$2', [newStatus, p.id]);
            sendWhatsApp(p.receiver_phone, templates.dispatched(p.tracking_id, p.sending_office_name));
        } else if ((!action || action === 'receive') && p.status === 'dispatched' && isReceiver) {
            newStatus = 'arrived';
            message = 'Parcel marked as arrived!';
            logAction = 'RECEIVED_PARCEL';
            await db.query('UPDATE parcels SET status=$1, arrived_at=NOW() WHERE id=$2', [newStatus, p.id]);
            sendWhatsApp(p.receiver_phone, templates.arrived(p.tracking_id, p.receiving_office_name));
        } else if ((!action || action === 'handover') && p.status === 'arrived' && isReceiver) {
            newStatus = 'picked_up';
            message = 'Parcel handed over successfully!';
            logAction = 'COLLECTED_PARCEL';
            await db.query('UPDATE parcels SET status=$1, picked_up_at=NOW() WHERE id=$2', [newStatus, p.id]);
            sendWhatsApp(p.sender_phone, templates.pickedUp(p.tracking_id));
        } else {
            return res.status(400).json({ message: `Cannot perform action "${action || 'scan'}" on parcel with status "${p.status}" at this office.` });
        }

        if (logAction) {
            await db.query(
                'INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1,$2,$3,$4)',
                [req.user.company_id, req.user.id, logAction, JSON.stringify({ tracking_id: p.tracking_id })]
            );
        }

        res.json({ message, parcel: { ...p, status: newStatus } });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

const router = require('express').Router();
const pool = require('../db');
const { generateTrackingId } = require('../utils/qr');
const { sendWhatsApp, templates } = require('../utils/whatsapp');
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');
const logger = require('../utils/logger');

// POST /api/scan
router.post('/', requireAuth, requireRole('office_staff', 'company_admin'), tenantCheck, async (req, res, next) => {
    try {
        const { trackingId, officeId } = req.body;
        if (!trackingId || !officeId) {
            return res.status(400).json({ message: 'trackingId and officeId are required' });
        }

        const { rows } = await pool.query(`
      SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      WHERE (p.tracking_id=$1 OR p.qr_code=$1) AND p.company_id=$2`,
            [trackingId, req.user.company_id]
        );

        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const parcel = rows[0];

        // Verify the scanning office is a party to this parcel
        if (parcel.sending_office_id !== parseInt(officeId) && parcel.receiving_office_id !== parseInt(officeId)) {
            return res.status(403).json({ message: 'This office is not associated with this parcel' });
        }

        let updatedParcel;
        const sid = parcel.sending_office_id;
        const rid = parcel.receiving_office_id;
        const oid = parseInt(officeId);

        if (parcel.status === 'created' && oid === sid) {
            // Dispatch
            const { rows: updated } = await pool.query(
                "UPDATE parcels SET status='dispatched', dispatched_at=NOW() WHERE id=$1 RETURNING *",
                [parcel.id]
            );
            updatedParcel = updated[0];
            // Notify sender and receiver
            sendWhatsApp(parcel.sender_phone,
                templates.dispatched_sender(parcel.tracking_id, parcel.receiving_office_name)
            );
            sendWhatsApp(parcel.receiver_phone,
                templates.dispatched_receiver(parcel.tracking_id, parcel.sending_office_name, parcel.receiving_office_name)
            );
            logger.info(`Parcel ${parcel.tracking_id} dispatched from ${parcel.sending_office_name}`);

        } else if (parcel.status === 'dispatched' && oid === rid) {
            // Arrived
            const { rows: updated } = await pool.query(
                "UPDATE parcels SET status='arrived', arrived_at=NOW() WHERE id=$1 RETURNING *",
                [parcel.id]
            );
            updatedParcel = updated[0];
            sendWhatsApp(parcel.sender_phone, templates.arrived_sender(parcel.tracking_id, parcel.receiving_office_name));
            sendWhatsApp(parcel.receiver_phone, templates.arrived_receiver(parcel.tracking_id, parcel.receiving_office_name));
            logger.info(`Parcel ${parcel.tracking_id} arrived at ${parcel.receiving_office_name}`);

        } else if (parcel.status === 'arrived' && oid === rid) {
            // Picked up
            const { rows: updated } = await pool.query(
                "UPDATE parcels SET status='picked_up', picked_up_at=NOW() WHERE id=$1 RETURNING *",
                [parcel.id]
            );
            updatedParcel = updated[0];
            sendWhatsApp(parcel.sender_phone, templates.picked_up_sender(parcel.tracking_id));
            logger.info(`Parcel ${parcel.tracking_id} picked up`);

        } else {
            return res.status(400).json({
                message: `Cannot scan parcel. Status is '${parcel.status}' and office ${oid} is the ${oid === sid ? 'sending' : 'receiving'} office.`,
                parcel,
            });
        }

        await pool.query(
            "INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1,$2,$3,$4)",
            [req.user.company_id, req.user.id, 'SCANNED_PARCEL', JSON.stringify({ tracking_id: parcel.tracking_id, old_status: parcel.status, new_status: updatedParcel.status })]
        );

        res.json({
            message: `Parcel status updated to '${updatedParcel.status}'`,
            parcel: updatedParcel,
        });
    } catch (err) { next(err); }
});

module.exports = router;

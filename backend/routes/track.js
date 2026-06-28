const router = require('express').Router();
const db = require('../db');

router.get('/:trackingId', async (req, res) => {
    try {
        const trackingId = req.params.trackingId.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!trackingId || trackingId.length < 3) {
            return res.status(400).json({ message: 'Invalid tracking ID' });
        }
        const { rows } = await db.query(
            `SELECT p.tracking_id, p.status, p.weight_kg, p.fee_paid,
                    p.payment_method, p.parcel_type, p.pricing_option,
                    p.created_at, p.dispatched_at, p.arrived_at, p.picked_up_at,
                    so.name AS sending_office_name, so.address AS sending_office_address,
                    ro.name AS receiving_office_name, ro.address AS receiving_office_address,
                    c.name AS company_name
             FROM parcels p
             LEFT JOIN offices so ON so.id = p.sending_office_id
             LEFT JOIN offices ro ON ro.id = p.receiving_office_id
             LEFT JOIN companies c ON c.id = p.company_id
             WHERE p.tracking_id = $1
               AND p.status NOT IN ('pending_payment', 'payment_failed')`,
            [trackingId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const p = rows[0];
        res.json({
            tracking_id: p.tracking_id,
            status: p.status,
            weight_kg: parseFloat(p.weight_kg),
            fee_paid: parseFloat(p.fee_paid),
            payment_method: p.payment_method,
            parcel_type: p.parcel_type,
            sending_office: { name: p.sending_office_name, address: p.sending_office_address },
            receiving_office: { name: p.receiving_office_name, address: p.receiving_office_address },
            company: { name: p.company_name },
            timeline: {
                created: p.created_at,
                dispatched: p.dispatched_at,
                arrived: p.arrived_at,
                picked_up: p.picked_up_at,
            }
        });
    } catch (err) {
        req.app.get('logger').error('Track lookup error', { error: err.message, trackingId: req.params.trackingId });
        res.status(500).json({ message: 'Failed to lookup parcel' });
    }
});

module.exports = router;

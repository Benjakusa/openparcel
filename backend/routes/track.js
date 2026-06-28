const router = require('express').Router();
const db = require('../db');

router.get('/:trackingId', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT p.tracking_id, p.status, p.sender_name, p.sender_phone,
                    p.receiver_name, p.receiver_phone, p.weight_kg, p.fee_paid,
                    p.payment_method, p.parcel_type, p.pricing_option,
                    p.created_at, p.dispatched_at, p.arrived_at, p.picked_up_at,
                    so.name AS sending_office_name, so.address AS sending_office_address,
                    ro.name AS receiving_office_name, ro.address AS receiving_office_address,
                    c.name AS company_name, c.phone AS company_phone
             FROM parcels p
             LEFT JOIN offices so ON so.id = p.sending_office_id
             LEFT JOIN offices ro ON ro.id = p.receiving_office_id
             LEFT JOIN companies c ON c.id = p.company_id
             WHERE p.tracking_id = $1`,
            [req.params.trackingId.toUpperCase()]
        );
        if (!rows.length) return res.status(404).json({ message: 'Parcel not found' });
        const p = rows[0];
        res.json({
            tracking_id: p.tracking_id,
            status: p.status,
            sender_name: p.sender_name,
            sender_phone: p.sender_phone,
            receiver_name: p.receiver_name,
            receiver_phone: p.receiver_phone,
            weight_kg: parseFloat(p.weight_kg),
            fee_paid: parseFloat(p.fee_paid),
            payment_method: p.payment_method,
            parcel_type: p.parcel_type,
            pricing_option: p.pricing_option,
            sending_office: { name: p.sending_office_name, address: p.sending_office_address },
            receiving_office: { name: p.receiving_office_name, address: p.receiving_office_address },
            company: { name: p.company_name, phone: p.company_phone },
            timeline: {
                created: p.created_at,
                dispatched: p.dispatched_at,
                arrived: p.arrived_at,
                picked_up: p.picked_up_at,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

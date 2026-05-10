const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/encryption');
const { stkPush } = require('../utils/mpesa');

// Middleware: check company is approved & subscription OK
async function tenantCheck(req, res, next) {
    if (req.user.role === 'super_admin') return next();
    try {
        const { rows } = await db.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
        if (!rows.length || !rows[0].approved) return res.status(403).json({ message: 'Account pending approval.' });
        const c = rows[0];
        if (c.subscription_status === 'suspended') return res.status(403).json({ message: 'Account suspended.' });
        if (c.subscription_status !== 'active' && c.subscription_status !== 'trialing') {
            return res.status(402).json({ message: 'Buy Package', plans: [{ id: 'monthly', price: 1999 }, { id: 'lifetime', price: 29999 }] });
        }
        if (c.subscription_status === 'trialing' && new Date(c.trial_end_date) < new Date()) {
            await db.query(`UPDATE companies SET subscription_status='expired' WHERE id=$1`, [c.id]);
            return res.status(402).json({ message: 'Trial expired. Buy Package.', plans: [{ id: 'monthly', price: 1999 }, { id: 'lifetime', price: 29999 }] });
        }
        req.company = c;
        next();
    } catch (err) { res.status(500).json({ message: err.message }); }
}

const companyAuth = [auth('company_admin'), tenantCheck];

// --- DASHBOARD ---
router.get('/dashboard', companyAuth, async (req, res) => {
    const cid = req.user.company_id;
    try {
        const [offices, staff, parcels, revenueRows, byStatus, dailyRev, officesPerf] = await Promise.all([
            db.query('SELECT COUNT(*) FROM offices WHERE company_id=$1', [cid]),
            db.query(`SELECT COUNT(*) FROM users WHERE company_id=$1 AND role='office_staff'`, [cid]),
            db.query('SELECT COUNT(*) FROM parcels WHERE company_id=$1', [cid]),
            db.query(`SELECT payment_method, COALESCE(SUM(fee_paid),0) AS total FROM parcels WHERE company_id=$1 AND status='picked_up' GROUP BY payment_method`, [cid]),
            db.query(`SELECT status, COUNT(*) as count FROM parcels WHERE company_id=$1 GROUP BY status`, [cid]),
            db.query(`
        SELECT DATE(created_at) AS day, payment_method, COALESCE(SUM(fee_paid),0) AS total
        FROM parcels
        WHERE company_id=$1
          AND status NOT IN ('pending_payment','payment_failed')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day, payment_method
        ORDER BY day DESC`, [cid]),
            db.query(`
        SELECT o.id, o.name, COUNT(p.id) as total_dispatched, SUM(CASE WHEN p.status='picked_up' THEN 1 ELSE 0 END) as successfully_delivered
        FROM offices o
        LEFT JOIN parcels p ON p.sending_office_id = o.id
        WHERE o.company_id=$1
        GROUP BY o.id, o.name
        ORDER BY total_dispatched DESC`, [cid])
        ]);
        const statusMap = {};
        byStatus.rows.forEach(r => { statusMap[r.status] = parseInt(r.count); });
        let revenueCash = 0, revenueMpesa = 0;
        for (const r of revenueRows.rows) {
            if (r.payment_method === 'cash') revenueCash = parseFloat(r.total);
            else revenueMpesa = parseFloat(r.total);
        }
        res.json({
            company: req.company,
            offices: parseInt(offices.rows[0].count),
            staff: parseInt(staff.rows[0].count),
            total_parcels: parseInt(parcels.rows[0].count),
            revenue_total: revenueCash + revenueMpesa,
            revenue_cash: revenueCash,
            revenue_mpesa: revenueMpesa,
            parcels_by_status: statusMap,
            daily_revenue: dailyRev.rows,
            per_office_performance: officesPerf.rows
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- OFFICES ---
router.get('/offices', auth('company_admin', 'office_staff'), async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM offices WHERE company_id=$1 ORDER BY name', [req.user.company_id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/offices', companyAuth, async (req, res) => {
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    try {
        const { rows } = await db.query(
            'INSERT INTO offices (company_id, name, address, phone) VALUES ($1,$2,$3,$4) RETURNING *',
            [req.user.company_id, name, address, phone]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'Office name already exists' });
        res.status(500).json({ message: err.message });
    }
});

router.put('/offices/:id', companyAuth, async (req, res) => {
    const { name, address, phone } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE offices SET name=COALESCE($1,name), address=COALESCE($2,address), phone=COALESCE($3,phone) WHERE id=$4 AND company_id=$5 RETURNING *',
            [name, address, phone, req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Not found' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/offices/:id', companyAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM offices WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- STAFF ---
router.get('/staff', companyAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT u.*, o.name as office_name FROM users u LEFT JOIN offices o ON o.id = u.office_id WHERE u.company_id=$1 AND u.role='office_staff' ORDER BY u.created_at DESC`,
            [req.user.company_id]
        );
        res.json(rows.map(r => ({ ...r, password_hash: undefined })));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/staff', companyAuth, async (req, res) => {
    const { email, password, fullName, phone, officeId } = req.body;
    if (!email || !password || !officeId) return res.status(400).json({ message: 'Email, password, and office required' });
    try {
        const hash = await bcrypt.hash(password, 12);
        const { rows } = await db.query(
            `INSERT INTO users (company_id, office_id, email, password_hash, role, full_name, phone) VALUES ($1,$2,$3,$4,'office_staff',$5,$6) RETURNING id, email, full_name, phone, created_at`,
            [req.user.company_id, officeId, email, hash, fullName, phone]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'Email already in use' });
        res.status(500).json({ message: err.message });
    }
});

router.delete('/staff/:id', companyAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id=$1 AND company_id=$2 AND role=$3', [req.params.id, req.user.company_id, 'office_staff']);
        res.json({ message: 'Staff removed' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/staff/:id/reset-password', companyAuth, async (req, res) => {
    const { password, wipeData } = req.body;
    if (!password) return res.status(400).json({ message: 'New password is required' });
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const hash = await bcrypt.hash(password, 12);
        const updateRes = await client.query(
            "UPDATE users SET password_hash=$1 WHERE id=$2 AND company_id=$3 AND role='office_staff' RETURNING id",
            [hash, req.params.id, req.user.company_id]
        );
        if (!updateRes.rows.length) throw new Error('Staff member not found');

        if (wipeData) {
            await client.query('DELETE FROM user_logs WHERE user_id=$1', [req.params.id]);
        }
        await client.query('COMMIT');
        res.json({ message: 'Staff password reset' + (wipeData ? ' AND historical user logs wiped' : '') });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// --- PARCELS ---
router.get('/parcels', companyAuth, async (req, res) => {
    const { status, office_id } = req.query;
    let q = `SELECT p.*, so.name as sending_office_name, ro.name as receiving_office_name
           FROM parcels p
           LEFT JOIN offices so ON so.id=p.sending_office_id
           LEFT JOIN offices ro ON ro.id=p.receiving_office_id
           WHERE p.company_id=$1`;
    const params = [req.user.company_id];
    if (status) { params.push(status); q += ` AND p.status=$${params.length}`; }
    if (office_id) { params.push(office_id); q += ` AND (p.sending_office_id=$${params.length} OR p.receiving_office_id=$${params.length})`; }
    q += ' ORDER BY p.created_at DESC';
    try {
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- MPESA CONFIG ---
router.get('/mpesa/config', companyAuth, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT mpesa_configured, mpesa_shortcode, mpesa_environment FROM companies WHERE id=$1', [req.user.company_id]);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/mpesa/config', companyAuth, async (req, res) => {
    const { shortcode, consumerKey, consumerSecret, passkey, environment } = req.body;
    if (!shortcode || !consumerKey || !consumerSecret || !passkey) {
        return res.status(400).json({ message: 'All M-Pesa fields required' });
    }
    try {
        await db.query(
            `UPDATE companies SET mpesa_shortcode=$1, mpesa_consumer_key=$2, mpesa_consumer_secret=$3, mpesa_passkey=$4, mpesa_environment=$5, mpesa_configured=TRUE WHERE id=$6`,
            [shortcode, encrypt(consumerKey), encrypt(consumerSecret), encrypt(passkey), environment || 'sandbox', req.user.company_id]
        );
        res.json({ message: 'M-Pesa credentials saved' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/mpesa/test', companyAuth, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone required' });
    try {
        const { rows } = await db.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
        const c = rows[0];
        if (!c.mpesa_configured) return res.status(400).json({ message: 'M-Pesa not configured' });
        const result = await stkPush({
            consumerKey: decrypt(c.mpesa_consumer_key),
            consumerSecret: decrypt(c.mpesa_consumer_secret),
            shortcode: c.mpesa_shortcode,
            passkey: decrypt(c.mpesa_passkey),
            environment: c.mpesa_environment,
            phone,
            amount: 1,
            callbackUrl: `${process.env.PLATFORM_MPESA_CALLBACK_URL?.replace('platform-callback', 'parcel-callback') || 'https://example.com/api/mpesa/parcel-callback'}`,
            description: 'M-Pesa Test',
        });
        res.json({ message: 'Test STK Push sent', result });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- SUBSCRIPTION ---
router.get('/subscription/status', auth('company_admin'), async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT subscription_status, subscription_plan, subscription_end_date, trial_end_date FROM companies WHERE id=$1',
            [req.user.company_id]
        );
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/subscribe', auth('company_admin'), async (req, res) => {
    const { plan, phoneNumber } = req.body;
    if (!['monthly', 'lifetime'].includes(plan)) return res.status(400).json({ message: 'Invalid plan' });
    const amount = plan === 'monthly' ? 1999 : 29999;
    try {
        const result = await stkPush({
            consumerKey: process.env.PLATFORM_MPESA_CONSUMER_KEY,
            consumerSecret: process.env.PLATFORM_MPESA_CONSUMER_SECRET,
            shortcode: process.env.PLATFORM_MPESA_SHORTCODE,
            passkey: process.env.PLATFORM_MPESA_PASSKEY,
            environment: process.env.PLATFORM_MPESA_ENVIRONMENT || 'sandbox',
            phone: phoneNumber,
            amount,
            callbackUrl: process.env.PLATFORM_MPESA_CALLBACK_URL || 'https://example.com/api/mpesa/platform-callback',
            description: `OpenDesk Parcel ${plan} Plan`,
        });
        // Store transaction
        await db.query(
            `INSERT INTO platform_subscription_transactions (company_id, checkout_request_id, amount, plan) VALUES ($1,$2,$3,$4)`,
            [req.user.company_id, result.CheckoutRequestID, amount, plan]
        );
        res.json({ message: 'STK Push sent to your phone. Enter your M-Pesa PIN.', checkoutRequestId: result.CheckoutRequestID });
    } catch (err) {
        console.error('Subscribe error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// --- ACTIVITY LOGS ---
router.get('/logs', companyAuth, async (req, res) => {
    const { limit = 100, page = 1, office_id } = req.query;
    const params = [req.user.company_id];
    let officeFilter = '';
    if (office_id) {
        params.push(office_id);
        officeFilter = `AND u.office_id = $${params.length}`;
    }
    params.push(parseInt(limit));
    params.push((parseInt(page) - 1) * parseInt(limit));
    try {
        const { rows } = await db.query(
            `SELECT l.id, l.action, l.details, l.created_at,
                    u.full_name AS user_name, u.email AS user_email, u.role AS user_role,
                    o.name AS office_name, o.id AS office_id
             FROM user_logs l
             LEFT JOIN users u ON u.id = l.user_id
             LEFT JOIN offices o ON o.id = u.office_id
             WHERE l.company_id = $1 ${officeFilter}
             ORDER BY l.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- PARCEL PRICING ---
router.get('/pricing', companyAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT pp.*, o.name as office_name
       FROM parcel_pricing pp
       LEFT JOIN offices o ON o.id = pp.destination_office_id
       WHERE pp.company_id = $1
       ORDER BY o.name, pp.parcel_type`,
            [req.user.company_id]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/pricing', companyAuth, async (req, res) => {
    const { destinationOfficeId, parcelType, optionName, price } = req.body;
    if (!destinationOfficeId || !parcelType || price === undefined) {
        return res.status(400).json({ message: 'destinationOfficeId, parcelType, and price required' });
    }
    if (!['one_time', 'per_kg'].includes(parcelType)) {
        return res.status(400).json({ message: 'parcelType must be one_time or per_kg' });
    }
    try {
        const opt = parcelType === 'one_time' ? (optionName || 'Standard') : 'Standard';
        const { rows } = await db.query(
            `INSERT INTO parcel_pricing (company_id, destination_office_id, parcel_type, option_name, price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, destination_office_id, parcel_type, option_name)
       DO UPDATE SET price = $5
       RETURNING *`,
            [req.user.company_id, destinationOfficeId, parcelType, opt, price]
        );
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/pricing/:id', companyAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM parcel_pricing WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
        res.json({ message: 'Pricing deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/company/pricing/calculate?office_id=X&parcel_type=one_time|per_kg&weight=Y&option=Standard
router.get('/pricing/calculate', companyAuth, async (req, res) => {
    const { office_id, parcel_type, weight, option } = req.query;
    if (!office_id || !parcel_type) return res.status(400).json({ message: 'office_id and parcel_type required' });
    try {
        const opt = parcel_type === 'one_time' ? (option || 'Standard') : 'Standard';
        const { rows } = await db.query(
            'SELECT price, option_name FROM parcel_pricing WHERE company_id=$1 AND destination_office_id=$2 AND parcel_type=$3 AND option_name=$4',
            [req.user.company_id, office_id, parcel_type, opt]
        );
        if (!rows.length) return res.json({ fee: null, options: [], message: 'No pricing set for this destination and type' });
        const price = parseFloat(rows[0].price);
        const fee = parcel_type === 'per_kg' ? price * Math.ceil(parseFloat(weight || 1)) : price;
        res.json({ fee, price, parcel_type, option_name: rows[0].option_name });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/company/pricing/options?office_id=X&parcel_type=one_time
router.get('/pricing/options', companyAuth, async (req, res) => {
    const { office_id, parcel_type } = req.query;
    try {
        const where = ['company_id=$1'];
        const params = [req.user.company_id];
        if (office_id) { params.push(office_id); where.push('destination_office_id=$' + params.length); }
        if (parcel_type) { params.push(parcel_type); where.push('parcel_type=$' + params.length); }
        const { rows } = await db.query(
            `SELECT option_name, price FROM parcel_pricing WHERE ${where.join(' AND ')} ORDER BY option_name`,
            params
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

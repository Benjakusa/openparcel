const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');
const { encrypt, decrypt } = require('../utils/crypto');
const { platformSTKPush, companySTKPush } = require('../utils/mpesa');
const logger = require('../utils/logger');

router.use(requireAuth);
router.use(requireRole('company_admin'));
router.use(tenantCheck);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
    try {
        const cid = req.user.company_id;
        const [offices, staff, parcels, revenueSplit] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM offices WHERE company_id = $1', [cid]),
            pool.query("SELECT COUNT(*) FROM users WHERE company_id = $1 AND role = 'office_staff'", [cid]),
            pool.query('SELECT COUNT(*), status FROM parcels WHERE company_id = $1 GROUP BY status', [cid]),
            pool.query("SELECT payment_method, COALESCE(SUM(fee_paid),0) AS total FROM parcels WHERE company_id = $1 AND status != 'pending_payment' AND status != 'payment_failed' GROUP BY payment_method", [cid]),
        ]);

        const parcelsByStatus = {};
        parcels.rows.forEach(r => { parcelsByStatus[r.status] = parseInt(r.count); });

        let totalRevenue = 0;
        let cashRevenue = 0;
        let mpesaRevenue = 0;
        revenueSplit.rows.forEach(r => {
            const val = parseFloat(r.total);
            totalRevenue += val;
            if (r.payment_method === 'cash') cashRevenue += val;
            if (r.payment_method === 'mpesa') mpesaRevenue += val;
        });

        res.json({
            offices: parseInt(offices.rows[0].count),
            staff: parseInt(staff.rows[0].count),
            parcels_by_status: parcelsByStatus,
            total_parcels: Object.values(parcelsByStatus).reduce((a, b) => a + b, 0),
            revenue_total: totalRevenue,
            revenue_cash: cashRevenue,
            revenue_mpesa: mpesaRevenue,
            company: {
                id: req.company.id,
                name: req.company.name,
                subscription_status: req.company.subscription_status,
                trial_end_date: req.company.trial_end_date,
                subscription_plan: req.company.subscription_plan,
            },
        });
    } catch (err) { next(err); }
});

// ── Offices CRUD ───────────────────────────────────────────────────────────
router.get('/offices', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM offices WHERE company_id = $1 ORDER BY name',
            [req.user.company_id]
        );
        res.json(rows);
    } catch (err) { next(err); }
});

router.post('/offices', async (req, res, next) => {
    try {
        const { name, address, phone } = req.body;
        if (!name) return res.status(400).json({ message: 'Office name is required' });
        const { rows } = await pool.query(
            'INSERT INTO offices (company_id, name, address, phone) VALUES ($1,$2,$3,$4) RETURNING *',
            [req.user.company_id, name, address, phone]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'An office with this name already exists' });
        next(err);
    }
});

router.put('/offices/:id', async (req, res, next) => {
    try {
        const { name, address, phone } = req.body;
        const { rows } = await pool.query(
            `UPDATE offices SET name=COALESCE($1,name), address=COALESCE($2,address), phone=COALESCE($3,phone)
       WHERE id=$4 AND company_id=$5 RETURNING *`,
            [name, address, phone, req.params.id, req.user.company_id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Office not found' });
        res.json(rows[0]);
    } catch (err) { next(err); }
});

router.delete('/offices/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            'DELETE FROM offices WHERE id=$1 AND company_id=$2 RETURNING id',
            [req.params.id, req.user.company_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Office not found' });
        res.json({ message: 'Office deleted' });
    } catch (err) { next(err); }
});

// ── Staff Management ───────────────────────────────────────────────────────
router.get('/staff', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.created_at,
              o.name AS office_name, o.id AS office_id
       FROM users u
       LEFT JOIN offices o ON o.id = u.office_id
       WHERE u.company_id = $1 AND u.role = 'office_staff'
       ORDER BY u.created_at DESC`,
            [req.user.company_id]
        );
        res.json(rows);
    } catch (err) { next(err); }
});

router.post('/staff', async (req, res, next) => {
    try {
        const { email, password, fullName, phone, officeId } = req.body;
        if (!email || !password || !officeId) {
            return res.status(400).json({ message: 'email, password and officeId are required' });
        }
        // Verify office belongs to this company
        const officeCheck = await pool.query(
            'SELECT id FROM offices WHERE id=$1 AND company_id=$2', [officeId, req.user.company_id]
        );
        if (!officeCheck.rows.length) return res.status(400).json({ message: 'Invalid office' });

        const passwordHash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query(
            `INSERT INTO users (company_id, office_id, email, password_hash, role, full_name, phone)
       VALUES ($1,$2,$3,$4,'office_staff',$5,$6) RETURNING id, email, full_name, role, created_at`,
            [req.user.company_id, officeId, email, passwordHash, fullName, phone]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Email already registered' });
        next(err);
    }
});

router.delete('/staff/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            "DELETE FROM users WHERE id=$1 AND company_id=$2 AND role='office_staff' RETURNING id",
            [req.params.id, req.user.company_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Staff not found' });
        res.json({ message: 'Staff removed' });
    } catch (err) { next(err); }
});

// ── Parcels list ───────────────────────────────────────────────────────────
router.get('/parcels', async (req, res, next) => {
    try {
        const { status, office_id, page = 1, limit = 50 } = req.query;
        let query = `
      SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name
      FROM parcels p
      LEFT JOIN offices so ON so.id = p.sending_office_id
      LEFT JOIN offices ro ON ro.id = p.receiving_office_id
      WHERE p.company_id = $1
    `;
        const params = [req.user.company_id];
        if (status) { params.push(status); query += ` AND p.status = $${params.length}`; }
        if (office_id) {
            params.push(office_id);
            query += ` AND (p.sending_office_id = $${params.length} OR p.receiving_office_id = $${params.length})`;
        }
        query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) { next(err); }
});

// ── M-Pesa Config ─────────────────────────────────────────────────────────
router.get('/mpesa/config', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT mpesa_configured, mpesa_shortcode, mpesa_environment FROM companies WHERE id=$1',
            [req.user.company_id]
        );
        const c = rows[0];
        res.json({
            configured: c.mpesa_configured,
            shortcode: c.mpesa_shortcode ? `****${c.mpesa_shortcode.slice(-4)}` : null,
            environment: c.mpesa_environment,
        });
    } catch (err) { next(err); }
});

router.post('/mpesa/config', async (req, res, next) => {
    try {
        const { shortcode, consumerKey, consumerSecret, passkey, environment } = req.body;
        if (!shortcode || !consumerKey || !consumerSecret || !passkey) {
            return res.status(400).json({ message: 'All M-Pesa credentials are required' });
        }
        await pool.query(
            `UPDATE companies SET
        mpesa_shortcode=$1,
        mpesa_consumer_key=$2,
        mpesa_consumer_secret=$3,
        mpesa_passkey=$4,
        mpesa_environment=$5,
        mpesa_configured=TRUE
       WHERE id=$6`,
            [shortcode, encrypt(consumerKey), encrypt(consumerSecret), encrypt(passkey),
                environment || 'sandbox', req.user.company_id]
        );
        res.json({ message: 'M-Pesa credentials saved successfully' });
    } catch (err) { next(err); }
});

router.post('/mpesa/test', async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ message: 'Phone number is required' });

        const cRes = await pool.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
        const company = cRes.rows[0];
        if (!company.mpesa_configured) {
            return res.status(400).json({ message: 'M-Pesa not configured yet' });
        }

        const callbackUrl = `${process.env.PLATFORM_MPESA_CALLBACK_URL?.replace('platform-callback', 'parcel-callback')}`;
        const result = await companySTKPush({
            company,
            phone,
            amount: 1,
            accountRef: 'TestPayment',
            description: 'M-Pesa Test (KES 1)',
            callbackUrl: callbackUrl || 'https://your-domain.com/api/mpesa/parcel-callback',
        });
        res.json({ message: 'Test STK Push sent', data: result });
    } catch (err) {
        logger.error('M-Pesa test failed:', err.message);
        res.status(500).json({ message: `STK Push failed: ${err.message}` });
    }
});

// ── Subscription ───────────────────────────────────────────────────────────
router.get('/subscription/status', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT subscription_status, subscription_plan, trial_end_date,
              subscription_start_date, subscription_end_date
       FROM companies WHERE id=$1`,
            [req.user.company_id]
        );
        const c = rows[0];
        const now = new Date();
        const trialEnd = new Date(c.trial_end_date);
        const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
        res.json({ ...c, trial_days_left: daysLeft });
    } catch (err) { next(err); }
});

router.post('/subscribe', async (req, res, next) => {
    try {
        const { plan, phoneNumber } = req.body;
        if (!['monthly', 'lifetime'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan. Choose monthly or lifetime' });
        }
        if (!phoneNumber) return res.status(400).json({ message: 'phoneNumber is required' });

        const amount = plan === 'monthly' ? 1999 : 29999;
        const callbackUrl = process.env.PLATFORM_MPESA_CALLBACK_URL;

        // Store pending transaction
        const txRes = await pool.query(
            `INSERT INTO platform_subscription_transactions (company_id, amount, plan, status)
       VALUES ($1,$2,$3,'pending') RETURNING id`,
            [req.user.company_id, amount, plan]
        );

        const stkResult = await platformSTKPush({
            phone: phoneNumber,
            amount,
            accountRef: `OPEN-SUB-${req.user.company_id}`,
            description: `OpenDesk ${plan === 'monthly' ? 'Monthly' : 'Lifetime'} Plan`,
            callbackUrl,
        });

        // Update transaction with checkout request ID
        await pool.query(
            'UPDATE platform_subscription_transactions SET checkout_request_id=$1 WHERE id=$2',
            [stkResult.CheckoutRequestID, txRes.rows[0].id]
        );

        res.json({
            message: 'STK Push sent to your phone. Enter your M-Pesa PIN to complete payment.',
            checkoutRequestId: stkResult.CheckoutRequestID,
        });
    } catch (err) {
        logger.error('Subscription STK Push failed:', err.message);
        res.status(500).json({ message: `Payment initiation failed: ${err.message}` });
    }
});
// ── Logs ───────────────────────────────────────────────────────────────────
router.get('/logs', async (req, res, next) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const { rows } = await pool.query(
            `SELECT l.*, u.full_name AS user_name, u.email AS user_email, u.role AS user_role, o.name AS office_name
             FROM user_logs l
             LEFT JOIN users u ON u.id = l.user_id
             LEFT JOIN offices o ON o.id = u.office_id
             WHERE l.company_id = $1
             ORDER BY l.created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.user.company_id, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]
        );
        res.json(rows);
    } catch (err) { next(err); }
});

module.exports = router;

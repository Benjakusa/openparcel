const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { logRead } = require('../utils/audit');

const adminAuth = auth('super_admin');

// ───────── Companies List ─────────
router.get('/companies', adminAuth, async (req, res) => {
    try {
        const { search, status, sort = 'registered_at', order = 'DESC' } = req.query;
        let sql = `
            SELECT c.id, c.name, c.approved, c.subscription_status, c.subscription_plan,
                   c.mpesa_configured, c.trial_end_date, c.registered_at,
                   COUNT(DISTINCT o.id)::int AS office_count,
                   COUNT(DISTINCT u.id)::int AS staff_count,
                   COUNT(DISTINCT p.id)::int AS parcel_count
            FROM companies c
            LEFT JOIN offices o ON o.company_id = c.id
            LEFT JOIN users u ON u.company_id = c.id AND u.role != 'super_admin'
            LEFT JOIN parcels p ON p.company_id = c.id
        `;
        const params = [];
        const wheres = [];
        if (search) { params.push(`%${search}%`); wheres.push(`(c.name ILIKE $${params.length} OR c.subscription_status ILIKE $${params.length})`); }
        if (status) { params.push(status); wheres.push(`c.subscription_status = $${params.length}`); }
        if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
        sql += ' GROUP BY c.id';
        const allowedSort = { name: 'c.name', status: 'c.subscription_status', parcels: 'parcel_count', registered_at: 'c.registered_at', trial_end: 'c.trial_end_date' };
        const sortCol = allowedSort[sort] || 'c.registered_at';
        sql += ` ORDER BY ${sortCol} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Company Detail ─────────
router.get('/companies/:id', adminAuth, async (req, res) => {
    try {
        const [compRes, statsRes, officesRes, usersRes, recentParcels, recentActivity, transRes] = await Promise.all([
            db.query('SELECT id, name, approved, subscription_status, subscription_plan, mpesa_configured, trial_end_date, registered_at, phone, mpesa_environment FROM companies WHERE id=$1', [req.params.id]),
            db.query(`SELECT COUNT(*)::int AS total_parcels,
                        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS parcels_30d,
                        COUNT(*) FILTER (WHERE status='pending_payment')::int AS pending_payments,
                        COUNT(*) FILTER (WHERE status='payment_failed')::int AS failed_payments
                     FROM parcels WHERE company_id=$1`, [req.params.id]),
            db.query(`SELECT o.*, COUNT(p.id)::int AS parcel_count
                     FROM offices o LEFT JOIN parcels p ON p.sending_office_id = o.id OR p.receiving_office_id = o.id
                     WHERE o.company_id=$1 GROUP BY o.id ORDER BY o.name`, [req.params.id]),
            db.query(`SELECT id, email, full_name, phone, role, office_id, created_at FROM users WHERE company_id=$1 ORDER BY created_at DESC`, [req.params.id]),
            db.query(`SELECT id, parcel_id, tracking_id, status, fee_paid, payment_method, created_at FROM parcels WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]),
            db.query(`SELECT ul.*, u.full_name AS user_name FROM user_logs ul
                     LEFT JOIN users u ON u.id = ul.user_id
                     WHERE ul.company_id=$1 ORDER BY ul.created_at DESC LIMIT 20`, [req.params.id]),
            db.query(`SELECT COALESCE(SUM(amount),0)::numeric AS total_subscription_revenue
                     FROM platform_subscription_transactions WHERE company_id=$1 AND status='success'`, [req.params.id]),
        ]);
        if (!compRes.rows.length) return res.status(404).json({ message: 'Not found' });
        const company = compRes.rows[0];
        logRead(req.user.id, req.user.company_id, 'ADMIN_VIEW_COMPANY', { company_id: req.params.id });
        res.json({
            ...company,
            ...statsRes.rows[0],
            total_subscription_revenue: parseFloat(transRes.rows[0].total_subscription_revenue),
            offices: officesRes.rows,
            users: usersRes.rows,
            recent_parcels: recentParcels.rows,
            recent_activity: recentActivity.rows,
        });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Company Users ─────────
router.get('/companies/:id/users', adminAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.created_at,
                    o.name AS office_name
             FROM users u LEFT JOIN offices o ON o.id = u.office_id
             WHERE u.company_id=$1 AND u.role != 'super_admin'
             ORDER BY u.created_at DESC`, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Company Parcels ─────────
router.get('/companies/:id/parcels', adminAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let sql = `SELECT p.*, so.name AS sending_office_name, ro.name AS receiving_office_name
                   FROM parcels p
                   LEFT JOIN offices so ON so.id = p.sending_office_id
                   LEFT JOIN offices ro ON ro.id = p.receiving_office_id
                   WHERE p.company_id=$1`;
        const params = [req.params.id];
        if (status) { params.push(status); sql += ` AND p.status=$${params.length}`; }
        sql += ' ORDER BY p.created_at DESC';
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Company Transactions ─────────
router.get('/companies/:id/transactions', adminAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
            (SELECT 'subscription' AS tx_type, id, company_id, checkout_request_id, mpesa_receipt_number, amount, plan AS ref, status, created_at
             FROM platform_subscription_transactions WHERE company_id=$1)
            UNION ALL
            (SELECT 'parcel' AS tx_type, id, company_id, checkout_request_id, mpesa_receipt_number, amount, parcel_id::text AS ref, status, created_at
             FROM parcel_fee_transactions WHERE company_id=$1)
            ORDER BY created_at DESC LIMIT 50`, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Company Activity ─────────
router.get('/companies/:id/activity', adminAuth, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const { rows } = await db.query(
            `SELECT ul.*, u.full_name AS user_name FROM user_logs ul
             LEFT JOIN users u ON u.id = ul.user_id
             WHERE ul.company_id=$1 ORDER BY ul.created_at DESC LIMIT $2`,
            [req.params.id, parseInt(limit)]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Approve Company ─────────
router.put('/companies/:id/approve', adminAuth, async (req, res) => {
    try {
        await db.query('UPDATE companies SET approved=TRUE WHERE id=$1', [req.params.id]);
        console.log(`[Admin] Company ${req.params.id} approved`);
        res.json({ message: 'Company approved' });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Suspend Company ─────────
router.put('/companies/:id/suspend', adminAuth, async (req, res) => {
    try {
        await db.query(`UPDATE companies SET subscription_status='suspended', approved=FALSE WHERE id=$1`, [req.params.id]);
        res.json({ message: 'Company suspended' });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Extend Trial ─────────
router.put('/companies/:id/extend-trial', adminAuth, async (req, res) => {
    try {
        const { days = 14 } = req.body;
        await db.query(
            `UPDATE companies SET trial_end_date = GREATEST(trial_end_date, NOW()) + $1::interval WHERE id=$2`,
            [`${days} days`, req.params.id]);
        res.json({ message: `Trial extended by ${days} days` });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Change Plan ─────────
router.put('/companies/:id/change-plan', adminAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        if (!['monthly', 'yearly', 'trialing'].includes(plan)) return res.status(400).json({ message: 'Invalid plan' });
        await db.query('UPDATE companies SET subscription_plan=$1 WHERE id=$2', [plan, req.params.id]);
        res.json({ message: `Plan changed to ${plan}` });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Reset User Password (Super Admin) ─────────
router.put('/companies/:id/users/:userId/reset-password', adminAuth, async (req, res) => {
    const { password, wipeData } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required' });
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const hash = await bcrypt.hash(password, 12);
        const updateRes = await client.query('UPDATE users SET password_hash=$1 WHERE id=$2 AND company_id=$3 RETURNING id', [hash, req.params.userId, req.params.id]);
        if (!updateRes.rows.length) throw new Error('User not found');

        if (wipeData) {
            await client.query('DELETE FROM user_logs WHERE user_id=$1', [req.params.userId]);
        }
        await client.query('COMMIT');
        res.json({ message: 'Password reset successfully' + (wipeData ? ' AND associated logs wiped' : '') });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

// ───────── Deactivate User ─────────
router.put('/companies/:id/users/:userId/deactivate', adminAuth, async (req, res) => {
    try {
        await db.query('UPDATE users SET active=FALSE WHERE id=$1 AND company_id=$2', [req.params.userId, req.params.id]);
        res.json({ message: 'User deactivated' });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Platform Stats ─────────
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [comp, parcels, revenue, subs] = await Promise.all([
            db.query(`SELECT
                COUNT(*)::int AS total_companies,
                COUNT(*) FILTER (WHERE approved=FALSE)::int AS pending_approvals,
                COUNT(*) FILTER (WHERE subscription_status='active')::int AS active_subscriptions,
                COUNT(*) FILTER (WHERE subscription_status='trialing')::int AS trialing,
                COUNT(*) FILTER (WHERE approved=TRUE AND subscription_status NOT IN ('expired','suspended'))::int AS active_clients
            FROM companies`),
            db.query(`SELECT COUNT(*)::int AS total_parcels FROM parcels`),
            db.query(`SELECT COALESCE(SUM(amount),0)::numeric AS total_platform_revenue
                      FROM platform_subscription_transactions WHERE status='success'`),
            db.query(`SELECT COUNT(*)::int AS subs_active FROM platform_subscription_transactions WHERE status='success'`),
        ]);
        res.json({ ...comp.rows[0], ...parcels.rows[0], ...revenue.rows[0], ...subs.rows[0] });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Revenue Chart Data ─────────
router.get('/stats/revenue', adminAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const { rows } = await db.query(`
            SELECT DATE(created_at) AS day,
                   COALESCE(SUM(amount),0)::numeric AS platform_revenue
            FROM platform_subscription_transactions
            WHERE created_at >= NOW() - $1::interval AND status='success'
            GROUP BY day ORDER BY day`, [`${days} days`]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Parcel Volume Chart Data ─────────
router.get('/stats/parcels', adminAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const { rows } = await db.query(`
            SELECT DATE(created_at) AS day, COUNT(*)::int AS count
            FROM parcels WHERE created_at >= NOW() - $1::interval
            GROUP BY day ORDER BY day`, [`${days} days`]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── New Clients Chart Data ─────────
router.get('/stats/clients', adminAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const { rows } = await db.query(`
            SELECT DATE(registered_at) AS day, COUNT(*)::int AS count
            FROM companies WHERE registered_at >= NOW() - $1::interval
            GROUP BY day ORDER BY day`, [`${days} days`]);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Top Clients ─────────
router.get('/stats/top-clients', adminAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT c.id, c.name, COUNT(DISTINCT p.id)::int AS parcel_count
            FROM companies c
            LEFT JOIN parcels p ON p.company_id = c.id
            GROUP BY c.id ORDER BY parcel_count DESC LIMIT 10`);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Platform Activity ─────────
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 50, company_id, action } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let sql = `SELECT ul.*, u.full_name AS user_name, c.name AS company_name
                   FROM user_logs ul
                   LEFT JOIN users u ON u.id = ul.user_id
                   LEFT JOIN companies c ON c.id = ul.company_id
                   WHERE 1=1`;
        const params = [];
        if (company_id) { params.push(company_id); sql += ` AND ul.company_id=$${params.length}`; }
        if (action) { params.push(action); sql += ` AND ul.action=$${params.length}`; }
        sql += ' ORDER BY ul.created_at DESC';
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Platform Transactions ─────────
router.get('/transactions', adminAuth, async (req, res) => {
    try {
        const { status, type, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let sql = `
            (SELECT 'subscription' AS tx_type, pst.id, pst.company_id, c.name AS company_name,
                    pst.checkout_request_id, pst.mpesa_receipt_number, pst.amount, pst.plan AS ref, pst.status, pst.created_at
             FROM platform_subscription_transactions pst
             JOIN companies c ON c.id = pst.company_id)
            UNION ALL
            (SELECT 'parcel' AS tx_type, pft.id, pft.company_id, c.name AS company_name,
                    pft.checkout_request_id, pft.mpesa_receipt_number, pft.amount, pft.parcel_id::text AS ref, pft.status, pft.created_at
             FROM parcel_fee_transactions pft
             JOIN companies c ON c.id = pft.company_id)
        `;
        const params = [];
        const filters = [];
        if (type) { filters.push(`tx_type=$${params.length + 1}`); params.push(type); }
        if (status) { filters.push(`status=$${params.length + 1}`); params.push(status); }
        if (filters.length) sql = `SELECT * FROM (${sql}) t WHERE ` + filters.join(' AND ');
        else sql = `SELECT * FROM (${sql}) t`;
        sql += ' ORDER BY created_at DESC';
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── Subscriptions List ─────────
router.get('/subscriptions', adminAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let sql = `SELECT c.id, c.name, c.subscription_status, c.subscription_plan,
                          c.trial_end_date, c.subscription_start_date, c.subscription_end_date,
                          COALESCE(SUM(pst.amount) FILTER (WHERE pst.status='success'),0)::numeric AS total_paid,
                          MAX(pst.created_at) FILTER (WHERE pst.status='success') AS last_payment_date
                   FROM companies c
                   LEFT JOIN platform_subscription_transactions pst ON pst.company_id = c.id`;
        const params = [];
        if (status) { params.push(status); sql += ` WHERE c.subscription_status=$${params.length}`; }
        sql += ' GROUP BY c.id ORDER BY c.trial_end_date ASC';
        sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), offset);
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ───────── System Health ─────────
router.get('/health', adminAuth, async (req, res) => {
    try {
        const [dbHealth, failedPayments, recentErrors, cronCheck] = await Promise.all([
            db.query('SELECT NOW() AS db_time, version() AS db_version'),
            db.query(`SELECT COUNT(*)::int AS count_24h FROM parcel_fee_transactions
                     WHERE status='failed' AND created_at >= NOW() - INTERVAL '24 hours'`),
            db.query(`SELECT COUNT(*)::int AS pending_reqs FROM parcels WHERE status='pending_payment' AND created_at < NOW() - INTERVAL '1 hour'`),
            db.query(`SELECT COUNT(*)::int AS active_companies FROM companies WHERE approved=TRUE AND subscription_status NOT IN ('expired','suspended')`),
        ]);
        res.json({
            db_status: 'connected',
            db_time: dbHealth.rows[0].db_time,
            db_version: dbHealth.rows[0].db_version,
            failed_payments_24h: failedPayments.rows[0].count_24h,
            stale_pending_payments: recentErrors.rows[0].pending_reqs,
            active_companies: cronCheck.rows[0].active_companies,
            uptime: process.uptime(),
        });
    } catch (err) {
        console.error('Health check error', err);
        res.json({ db_status: 'error', message: 'Server error' });
    }
});

// ───────── Delete Company ─────────
router.delete('/companies/:id', adminAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const id = req.params.id;
        await client.query('DELETE FROM user_logs WHERE company_id=$1', [id]);
        await client.query('DELETE FROM parcel_fee_transactions WHERE company_id=$1', [id]);
        await client.query('DELETE FROM platform_subscription_transactions WHERE company_id=$1', [id]);
        await client.query('DELETE FROM parcels WHERE company_id=$1', [id]);
        await client.query('UPDATE users SET office_id=NULL WHERE company_id=$1', [id]);
        await client.query('DELETE FROM offices WHERE company_id=$1', [id]);
        await client.query('DELETE FROM users WHERE company_id=$1', [id]);
        await client.query('DELETE FROM companies WHERE id=$1', [id]);
        await client.query('COMMIT');
        res.json({ message: 'Company successfully deleted' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;

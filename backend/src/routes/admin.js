const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// All admin routes require auth + super_admin role
router.use(requireAuth);
router.use(requireRole('super_admin'));

// GET /api/admin/companies
router.get('/companies', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT
        c.id, c.name, c.approved, c.subscription_status, c.subscription_plan,
        c.trial_end_date, c.registered_at, c.mpesa_configured,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'office_staff') AS staff_count,
        COUNT(DISTINCT o.id) AS office_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      LEFT JOIN offices o ON o.company_id = c.id
      GROUP BY c.id
      ORDER BY c.registered_at DESC
    `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/companies/:id
router.get('/companies/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
        if (!companyRes.rows.length) return res.status(404).json({ message: 'Company not found' });

        const company = companyRes.rows[0];
        // Mask sensitive fields
        delete company.mpesa_consumer_key;
        delete company.mpesa_consumer_secret;
        delete company.mpesa_passkey;

        const officesRes = await pool.query(
            'SELECT id, name, address, phone FROM offices WHERE company_id = $1',
            [id]
        );

        const parcelStats = await pool.query(`
      SELECT COUNT(*) AS total_parcels, COALESCE(SUM(fee_paid), 0) AS total_revenue
      FROM parcels WHERE company_id = $1
    `, [id]);

        res.json({
            ...company,
            offices: officesRes.rows,
            total_parcels: parseInt(parcelStats.rows[0].total_parcels),
            total_revenue: parseFloat(parcelStats.rows[0].total_revenue),
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/companies/:id/approve
router.put('/companies/:id/approve', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE companies SET approved = TRUE WHERE id = $1 RETURNING id, name`,
            [id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Company not found' });
        logger.info(`Company approved: ${result.rows[0].name} (id=${id})`);
        res.json({ message: 'Company approved successfully', company: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/companies/:id/suspend
router.put('/companies/:id/suspend', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE companies SET subscription_status = 'suspended', approved = FALSE WHERE id = $1 RETURNING id, name`,
            [id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Company not found' });
        logger.info(`Company suspended: ${result.rows[0].name} (id=${id})`);
        res.json({ message: 'Company suspended', company: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
    try {
        const [companies, pendingApprovals, activeSubscriptions, totalParcels] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM companies'),
            pool.query('SELECT COUNT(*) FROM companies WHERE approved = FALSE'),
            pool.query("SELECT COUNT(*) FROM companies WHERE subscription_status = 'active'"),
            pool.query('SELECT COUNT(*) FROM parcels'),
        ]);
        const trialingRes = await pool.query("SELECT COUNT(*) FROM companies WHERE subscription_status = 'trialing'");
        const revenueRes = await pool.query("SELECT COALESCE(SUM(fee_paid),0) AS total FROM parcels WHERE status != 'pending_payment'");

        res.json({
            total_companies: parseInt(companies.rows[0].count),
            pending_approvals: parseInt(pendingApprovals.rows[0].count),
            active_subscriptions: parseInt(activeSubscriptions.rows[0].count),
            trialing: parseInt(trialingRes.rows[0].count),
            total_parcels: parseInt(totalParcels.rows[0].count),
            total_platform_revenue: parseFloat(revenueRes.rows[0].total),
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

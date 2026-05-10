const pool = require('../db');

/**
 * Tenant middleware for company/office routes.
 * Checks approval, subscription status, and trial expiry.
 */
async function tenantCheck(req, res, next) {
    try {
        const companyId = req.user?.company_id;
        if (!companyId) {
            return res.status(403).json({ message: 'No company associated with this account' });
        }

        const { rows } = await pool.query(
            'SELECT * FROM companies WHERE id = $1',
            [companyId]
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const company = rows[0];
        req.company = company;

        // Must be approved
        if (!company.approved) {
            return res.status(403).json({ message: 'Account pending approval by platform admin.' });
        }

        // Suspended
        if (company.subscription_status === 'suspended') {
            return res.status(403).json({ message: 'Account has been suspended. Contact support.' });
        }

        // Expired trialing
        if (
            company.subscription_status === 'trialing' &&
            new Date(company.trial_end_date) < new Date()
        ) {
            return res.status(402).json({
                message: 'Your free trial has expired. Please buy a package to continue.',
                plans: [
                    { id: 'monthly', label: 'Monthly', price: 1999, currency: 'KES' },
                    { id: 'lifetime', label: 'Lifetime (One-Time)', price: 29999, currency: 'KES' },
                ],
            });
        }

        // Subscription expired
        if (company.subscription_status === 'expired') {
            return res.status(402).json({
                message: 'Your subscription has expired. Please renew to continue.',
                plans: [
                    { id: 'monthly', label: 'Monthly', price: 1999, currency: 'KES' },
                    { id: 'lifetime', label: 'Lifetime (One-Time)', price: 29999, currency: 'KES' },
                ],
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { tenantCheck };

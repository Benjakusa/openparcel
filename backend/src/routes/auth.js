const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const logger = require('../utils/logger');

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { companyName, adminEmail, adminPassword } = req.body;
        if (!companyName || !adminEmail || !adminPassword) {
            return res.status(400).json({ message: 'companyName, adminEmail, and adminPassword are required' });
        }

        // Check if email already taken
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (existing.rows.length) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(adminPassword, 12);

        // Create company and admin user in a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const companyRes = await client.query(
                `INSERT INTO companies (name, approved, subscription_status)
         VALUES ($1, FALSE, 'trialing') RETURNING id`,
                [companyName]
            );
            const companyId = companyRes.rows[0].id;

            await client.query(
                `INSERT INTO users (company_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'company_admin')`,
                [companyId, adminEmail, passwordHash]
            );
            await client.query('COMMIT');

            logger.info(`New company registered: ${companyName} (admin: ${adminEmail})`);
            res.status(201).json({
                message: 'Registration complete. Your account is awaiting approval. You will be notified once approved.',
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const { rows } = await pool.query(
            `SELECT u.*, c.approved, c.subscription_status, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.email = $1`,
            [email]
        );
        if (!rows.length) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Super admin bypasses company checks
        if (user.role !== 'super_admin') {
            if (!user.approved) {
                return res.status(403).json({ message: 'Account pending approval. Please wait for platform approval.' });
            }
        }

        const payload = {
            id: user.id,
            role: user.role,
            company_id: user.company_id,
            office_id: user.office_id,
            email: user.email,
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                company_id: user.company_id,
                company_name: user.company_name,
                office_id: user.office_id,
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');

const registerSchema = z.object({
    companyName: z.string().min(2),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters')
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { companyName, adminEmail, adminPassword } = registerSchema.parse(req.body);

        // Check email uniqueness
        const exists = await db.query('SELECT id FROM users WHERE email=$1', [adminEmail]);
        if (exists.rows.length) return res.status(400).json({ message: 'Email already registered' });

        const hash = await bcrypt.hash(adminPassword, 12);

        await db.query('BEGIN');
        const compRes = await db.query(
            `INSERT INTO companies (name, approved) VALUES ($1, TRUE) RETURNING id`,
            [companyName]
        );
        const companyId = compRes.rows[0].id;
        await db.query(
            `INSERT INTO users (company_id, email, password_hash, role) VALUES ($1,$2,$3,'company_admin')`,
            [companyId, adminEmail, hash]
        );
        await db.query('COMMIT');

        res.status(201).json({ message: 'Registration successful. You can now log in.' });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input data', errors: err.errors });
        }
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const userRes = await db.query(
            `SELECT u.*, c.name as company_name, c.approved, c.subscription_status, c.trial_end_date, o.name as office_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN offices o ON o.id = u.office_id
       WHERE u.email=$1`,
            [email]
        );
        if (!userRes.rows.length) return res.status(401).json({ message: 'Invalid credentials' });
        const user = userRes.rows[0];

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });

        // Super admin bypasses approval
        if (user.role !== 'super_admin') {
            if (!user.approved) return res.status(403).json({ message: 'Account pending approval.' });
        }

        const payload = {
            id: user.id,
            role: user.role,
            company_id: user.company_id,
            office_id: user.office_id,
            email: user.email,
            company_name: user.company_name,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: payload });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input data', errors: err.errors });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

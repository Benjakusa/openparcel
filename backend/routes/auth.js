const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db');

const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const registerSchema = z.object({
    companyName: z.string().min(2).max(100),
    adminEmail: z.string().email(),
    adminPassword: passwordSchema,
    companyPhone: z.string().min(5).max(20).optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function generateJwtId() {
    return crypto.randomBytes(16).toString('hex');
}

function signAccessToken(payload) {
    const jti = generateJwtId();
    return jwt.sign({ ...payload, jti }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function signRefreshToken(userId) {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return db.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING token',
        [userId, token, expiresAt]
    ).then(() => token);
}

async function checkAccountLocked(email) {
    const { rows } = await db.query(
        `SELECT account_locked_until FROM users WHERE email=$1`,
        [email]
    );
    if (!rows.length) return null;
    const user = rows[0];
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
        const remaining = Math.ceil((new Date(user.account_locked_until) - new Date()) / 1000 / 60);
        return remaining;
    }
    return null;
}

async function recordFailedAttempt(email) {
    await db.query(`
        UPDATE users SET
            failed_login_count = failed_login_count + 1,
            last_failed_at = NOW(),
            account_locked_until = CASE
                WHEN failed_login_count >= 4 THEN NOW() + INTERVAL '30 minutes'
                ELSE account_locked_until
            END
        WHERE email = $1
    `, [email]);
}

async function resetFailedAttempts(email) {
    await db.query(`
        UPDATE users SET
            failed_login_count = 0,
            last_failed_at = NULL,
            account_locked_until = NULL
        WHERE email = $1
    `, [email]);
}

router.post('/register', async (req, res) => {
    try {
        const { companyName, adminEmail, adminPassword, companyPhone } = registerSchema.parse(req.body);
        const exists = await db.query('SELECT id FROM users WHERE email=$1', [adminEmail]);
        if (exists.rows.length) return res.status(400).json({ message: 'Email already registered' });

        const hash = await bcrypt.hash(adminPassword, 12);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        await db.query('BEGIN');
        const compRes = await db.query(
            `INSERT INTO companies (name, approved, phone) VALUES ($1, FALSE, $2) RETURNING id`,
            [companyName, companyPhone || null]
        );
        const companyId = compRes.rows[0].id;
        await db.query(
            `INSERT INTO users (company_id, email, password_hash, role, email_verification_token, email_verification_sent_at)
             VALUES ($1, $2, $3, 'company_admin', $4, NOW())`,
            [companyId, adminEmail, hash, verificationToken]
        );
        await db.query('COMMIT');

        // In production, send verification email here
        // sendVerificationEmail(adminEmail, verificationToken);

        res.status(201).json({
            message: 'Registration successful. Please check your email to verify your account before logging in.',
            verification_token: process.env.NODE_ENV !== 'production' ? verificationToken : undefined,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
        }
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/verify-email/:token', async (req, res) => {
    try {
        const { rows } = await db.query(
            `UPDATE users SET email_verified = TRUE, email_verification_token = NULL
             WHERE email_verification_token = $1 AND email_verified = FALSE
             RETURNING id, email`,
            [req.params.token]
        );
        if (!rows.length) return res.status(404).json({ message: 'Invalid or expired verification token' });
        res.json({ message: 'Email verified. You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const lockedRemaining = await checkAccountLocked(email);
        if (lockedRemaining !== null) {
            return res.status(429).json({
                message: `Account is locked. Try again in ${lockedRemaining} minute(s).`,
                locked_until_minutes: lockedRemaining,
            });
        }

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
        if (!match) {
            await recordFailedAttempt(email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        await resetFailedAttempts(email);

        if (user.role !== 'super_admin') {
            if (!user.email_verified) return res.status(403).json({ message: 'Please verify your email before logging in.' });
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

        const accessToken = signAccessToken(payload);
        const refreshToken = await signRefreshToken(user.id);

        res.json({
            token: accessToken,
            refresh_token: refreshToken,
            user: payload,
            expires_in: 3600,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ message: 'Refresh token required' });

        const { rows } = await db.query(
            `SELECT rt.*, u.email, u.role, u.company_id, u.office_id, c.name as company_name
             FROM refresh_tokens rt
             JOIN users u ON u.id = rt.user_id
             LEFT JOIN companies c ON c.id = u.company_id
             WHERE rt.token = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()`,
            [refresh_token]
        );
        if (!rows.length) return res.status(401).json({ message: 'Invalid or expired refresh token' });

        const rt = rows[0];

        await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [rt.id]);

        const payload = {
            id: rt.user_id,
            role: rt.role,
            company_id: rt.company_id,
            office_id: rt.office_id,
            email: rt.email,
            company_name: rt.company_name,
        };

        const accessToken = signAccessToken(payload);
        const newRefreshToken = await signRefreshToken(rt.user_id);

        res.json({ token: accessToken, refresh_token: newRefreshToken, expires_in: 3600 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (refresh_token) {
            await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refresh_token]);
        }
        res.json({ message: 'Logged out' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

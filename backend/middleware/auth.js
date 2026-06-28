const jwt = require('jsonwebtoken');
const db = require('../db');

async function isTokenRevoked(jti) {
    if (!jti) return false;
    try {
        const { rows } = await db.query('SELECT id FROM revoked_tokens WHERE jti=$1', [jti]);
        return rows.length > 0;
    } catch {
        return false;
    }
}

function auth(...roles) {
    return async (req, res, next) => {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });

        let payload;
        try {
            payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(401).json({ message: 'Invalid token' });
        }

        if (await isTokenRevoked(payload.jti)) {
            return res.status(401).json({ message: 'Token revoked' });
        }

        req.user = {
            id: payload.id,
            role: payload.role,
            company_id: payload.company_id || null,
            office_id: payload.office_id || null,
            email: payload.email,
            company_name: payload.company_name || null,
        };

        if (roles.length && !roles.includes(payload.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        try {
            if (req.user.company_id) {
                await db.query('SELECT set_config($1, $2, true)', ['app.current_company_id', String(req.user.company_id)]);
            }
            await db.query('SELECT set_config($1, $2, true)', ['app.current_user_role', req.user.role]);
        } catch {}

        next();
    };
}

module.exports = { auth };

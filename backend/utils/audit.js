const db = require('../db');

async function logRead(userId, companyId, action, details) {
    try {
        await db.query(
            'INSERT INTO user_logs (company_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
            [companyId || null, userId, action, JSON.stringify(details)]
        );
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

module.exports = { logRead };

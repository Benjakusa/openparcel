const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
});

pool.on('error', (err) => {
    console.error('Unexpected pool error', err);
});

async function query(text, params) {
    return pool.query(text, params);
}

async function queryWithContext(text, params, context = {}) {
    const client = await pool.connect();
    try {
        if (context.companyId) {
            await client.query('SELECT set_config($1, $2, true)', ['app.current_company_id', String(context.companyId)]);
        }
        if (context.userId) {
            await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', String(context.userId)]);
        }
        if (context.role) {
            await client.query('SELECT set_config($1, $2, true)', ['app.current_user_role', context.role]);
        }
        return client.query(text, params);
    } finally {
        client.release();
    }
}

module.exports = {
    query,
    queryWithContext,
    pool,
};

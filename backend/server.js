require('dotenv').config();
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('./utils/cron');
const db = require('./db');
const { initIdGenerator } = require('./utils/idgen');

const app = express();

// Run migrations on startup
async function runMigrations() {
    try {
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).sort();
        for (const file of files) {
            if (file.endsWith('.sql')) {
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                await db.query(sql);
                console.log(`Migration applied: ${file}`);
            }
        }
    } catch (err) {
        console.error('Migration error (tables may already exist):', err.message);
    }
}

// CORS – allow Vercel frontend, dev, and desktop client
app.use(cors({
    origin: [
        'https://opendesk-seven.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
        'file://',
    ],
    credentials: true,
}));

// Security
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many requests' } }));
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 200 }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/company', require('./routes/company'));
app.use('/api/office', require('./routes/office'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/mpesa', require('./routes/mpesaCallback'));
app.use('/api/track', require('./routes/track'));

// Static frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));
}

// Run migrations, seed default data, then start
(async () => {
    await runMigrations();
    await seedDefaults();
    await initIdGenerator(db).catch(err => console.error('ID generator init failed:', err.message));
    cron.startJobs();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`OpenDesk Parcel backend running on :${PORT}`));
})();

async function seedDefaults() {
    try {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('admin123', 12);
        await db.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('admin@opendesk.com', $1, 'super_admin')
      ON CONFLICT (email) DO UPDATE SET password_hash=$1
    `, [hash]);
        console.log('Default super_admin: admin@opendesk.com / admin123');

        const compRes = await db.query(`
      INSERT INTO companies (name, approved, subscription_status)
      VALUES ('Demo Company', TRUE, 'trialing')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
        if (compRes.rows.length) {
            const cid = compRes.rows[0].id;
            const officeRes = await db.query(`
        INSERT INTO offices (company_id, name, address)
        VALUES ($1, 'Nairobi HQ', 'Tom Mboya Street, Nairobi')
        RETURNING id
      `, [cid]);
            const oid = officeRes.rows[0].id;
            const staffHash = await bcrypt.hash('staff123', 12);
            await db.query(`
        INSERT INTO users (company_id, office_id, email, password_hash, role, full_name)
        VALUES ($1, $2, 'staff@demo.com', $3, 'office_staff', 'Jane Staff')
        ON CONFLICT (email) DO NOTHING
      `, [cid, oid, staffHash]);
            const adminHash = await bcrypt.hash('demo123', 12);
            await db.query(`
        INSERT INTO users (company_id, email, password_hash, role, full_name)
        VALUES ($1, 'admin@demo.com', $2, 'company_admin', 'Demo Admin')
        ON CONFLICT (email) DO NOTHING
      `, [cid, adminHash]);
            console.log('Demo company seeded: admin@demo.com / demo123, staff@demo.com / staff123');
        }
    } catch (err) {
        console.error('Seed error (data may already exist):', err.message);
    }
}

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
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(format.timestamp(), format.json()),
    transports: [
        new transports.Console({ format: format.simple() }),
        ...(process.env.LOG_FILE ? [new transports.File({ filename: process.env.LOG_FILE })] : []),
    ],
});

const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://openparcel-5f7k.onrender.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            frameSrc: ["'self'"],
        },
    },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}));

// CORS – strict allowlist only
const allowedOrigins = [
    'https://opendesk-seven.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') return cb(null, true);
        cb(null, false);
    },
    credentials: true,
}));

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many requests' }, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { message: 'Too many requests' }, standardHeaders: true, legacyHeaders: false });
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { message: 'Too many tracking requests' }, standardHeaders: true, legacyHeaders: false });
const mpesaLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { message: 'Too many requests' }, standardHeaders: true, legacyHeaders: false });

app.use('/api/auth', authLimiter);
app.use('/api/track', trackLimiter);
app.use('/api/mpesa', mpesaLimiter);
app.use('/api/', apiLimiter);

// Request validation helper
const { z } = require('zod');
function validate(schema) {
    return (req, res, next) => {
        try {
            req.validated = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ message: 'Validation error', errors: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
            }
            next(err);
        }
    };
}

// Pagination helper middleware
function paginate(req, res, next) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);
    req.pagination = { page, limit, offset: (page - 1) * limit };
    next();
}

// Health check
app.get('/health', async (req, res) => {
    try {
        const dbResult = await db.query('SELECT NOW() as ts');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbResult.rows[0]?.ts ? 'connected' : 'disconnected',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        });
    } catch (err) {
        logger.error('Health check error', { error: err.message });
        res.status(503).json({ status: 'error', database: 'disconnected', message: 'Service unavailable' });
    }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/company', require('./routes/company'));
app.use('/api/office', require('./routes/office'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/track', require('./routes/track'));

app.use('/api/mpesa', require('./routes/mpesaCallback'));

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path, method: req.method });
    res.status(err.status || 500).json({ message: 'Internal server error' });
});

// Static frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist'), { maxAge: '1y', immutable: true }));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));
}

// Make logger, validate, paginate available to routes
app.set('logger', logger);
app.set('validate', validate);
app.set('paginate', paginate);

// Validate required env vars at startup
function validateEnv() {
    const required = [
        'JWT_SECRET',
        'DATABASE_URL',
        'MPESA_CREDENTIALS_ENCRYPTION_KEY',
    ];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters');
    }
    if (process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY && process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY.length !== 64) {
        throw new Error('MPESA_CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string');
    }
}

// Start
(async () => {
    try {
        validateEnv();
    } catch (err) {
        logger.error('Startup validation failed', { error: err.message });
        process.exit(1);
    }
    await runMigrations();
    if (process.env.NODE_ENV !== 'production' || process.env.SEED_ON_STARTUP === 'true') {
        await seedDefaults();
    }
    await initIdGenerator(db).catch(err => logger.error('ID generator init failed', { error: err.message }));
    cron.startJobs();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => logger.info(`OpenDesk Parcel backend running on :${PORT}`));
})();

async function runMigrations() {
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).sort();
        for (const file of files) {
            if (!file.endsWith('.sql')) continue;
            const existing = await db.query('SELECT id FROM migrations WHERE filename=$1', [file]);
            if (existing.rows.length) continue;
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await db.query('BEGIN');
            try {
                await db.query(sql);
                await db.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
                await db.query('COMMIT');
                logger.info(`Migration applied: ${file}`);
            } catch (err) {
                await db.query('ROLLBACK');
                logger.error(`Migration failed: ${file}`, { error: err.message });
                throw err;
            }
        }
    } catch (err) {
        logger.error('Migration system error', { error: err.message });
    }
}

async function seedDefaults() {
    try {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || 'admin123', 12);
        await db.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('admin@opendesk.com', $1, 'super_admin')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);
        logger.info('Super admin seeded');

        const compRes = await db.query(`
      INSERT INTO companies (name, approved, subscription_status)
      VALUES ('Demo Company', TRUE, 'trialing')
      ON CONFLICT DO NOTHING RETURNING id
    `);
        if (compRes.rows.length) {
            const cid = compRes.rows[0].id;
            const officeRes = await db.query(`
        INSERT INTO offices (company_id, name, address)
        VALUES ($1, 'Nairobi HQ', 'Tom Mboya Street, Nairobi') RETURNING id
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
            logger.info('Demo company seeded');
        }
    } catch (err) {
        logger.error('Seed error', { error: err.message });
    }
}

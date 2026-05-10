require('dotenv').config();
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

// CORS – allow Vercel frontend and dev origin
app.use(cors({
    origin: [
        'https://opendesk-seven.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
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

// Static frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));
}

// Initialize ID generator (creates sequence + column if missing)
initIdGenerator(db).catch(err => console.error('ID generator init failed:', err.message));

// Start cron
cron.startJobs();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`OpenDesk Parcel backend running on :${PORT}`));

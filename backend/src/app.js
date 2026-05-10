require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { initCron } = require('./utils/cron');
const pool = require('./db');
const { initIdGenerator } = require('../utils/idgen');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/company');
const officeRoutes = require('./routes/office');
const mpesaRoutes = require('./routes/mpesa');

const app = express();

// Trust proxy (for rate limiting behind nginx/docker)
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Logging
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/office', officeRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/scan', require('./routes/scan'));

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

// Initialize ID generator (creates sequence + column if missing)
initIdGenerator(pool).catch(err => logger.error('ID generator init failed:', err.message));

app.listen(PORT, () => {
  logger.info(`OpenDesk Parcel backend running on port ${PORT}`);
  initCron();
});

module.exports = app;

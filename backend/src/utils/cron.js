const cron = require('node-cron');
const pool = require('../db');
const { sendWhatsApp, templates } = require('./whatsapp');
const logger = require('./logger');

function initCron() {
    // Run daily at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running daily cron: checking trial expirations...');
        await expireTrials();
        await sendTrialReminders();
    });

    logger.info('Cron jobs initialized');
}

async function expireTrials() {
    try {
        const result = await pool.query(`
      UPDATE companies
      SET subscription_status = 'expired'
      WHERE subscription_status = 'trialing'
        AND trial_end_date < NOW()
      RETURNING id, name
    `);
        if (result.rows.length > 0) {
            logger.info(`Expired trials for ${result.rows.length} companies: ${result.rows.map(r => r.name).join(', ')}`);
        }
    } catch (err) {
        logger.error('Error expiring trials:', err);
    }
}

async function sendTrialReminders() {
    try {
        // Find companies whose trial ends in ~3 days
        const result = await pool.query(`
      SELECT c.id, c.name, c.trial_end_date, u.phone, u.email
      FROM companies c
      JOIN users u ON u.company_id = c.id AND u.role = 'company_admin'
      WHERE c.subscription_status = 'trialing'
        AND c.trial_end_date BETWEEN NOW() + INTERVAL '2 days 23 hours' AND NOW() + INTERVAL '3 days 1 hour'
    `);

        for (const company of result.rows) {
            const daysLeft = 3;
            logger.info(`Sending trial reminder to ${company.name} (admin: ${company.email})`);
            if (company.phone) {
                await sendWhatsApp(company.phone, templates.trial_expiry_warning(company.name, daysLeft));
            }
        }
    } catch (err) {
        logger.error('Error sending trial reminders:', err);
    }
}

module.exports = { initCron };

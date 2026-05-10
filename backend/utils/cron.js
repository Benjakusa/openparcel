const cron = require('node-cron');
const db = require('../db');
const { sendWhatsApp } = require('./whatsapp');

function startJobs() {
    // Daily at midnight: expire trials and send 3-day reminders
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Running daily subscription maintenance...');
        try {
            // Expire trials
            const expired = await db.query(`
        UPDATE companies SET subscription_status = 'expired'
        WHERE subscription_status = 'trialing'
          AND trial_end_date < NOW()
        RETURNING id, name
      `);
            if (expired.rowCount > 0) {
                console.log(`[CRON] Expired ${expired.rowCount} trials`);
            }

            // Send 3-day warning WhatsApp
            const soon = await db.query(`
        SELECT c.id, c.name, u.phone, u.email
        FROM companies c
        JOIN users u ON u.company_id = c.id AND u.role = 'company_admin'
        WHERE c.subscription_status = 'trialing'
          AND c.trial_end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
          AND c.approved = TRUE
      `);
            for (const row of soon.rows) {
                if (row.phone) {
                    await sendWhatsApp(row.phone,
                        `OpenDesk Parcel: Your free trial for "${row.name}" ends in 3 days. Buy a plan to continue using the platform.`
                    );
                }
                console.log(`[CRON] Sent trial reminder to ${row.email}`);
            }
        } catch (err) {
            console.error('[CRON] Error:', err.message);
        }
    });

    console.log('[CRON] Daily subscription job scheduled');
}

module.exports = { startJobs };

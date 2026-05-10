const twilio = require('twilio');
const logger = require('./logger');

let client = null;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
} catch (e) {
    logger.warn('Twilio client init failed:', e.message);
}

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

/**
 * Send a WhatsApp message via Twilio (non-blocking)
 */
async function sendWhatsApp(to, message) {
    if (!client) {
        logger.warn(`[WhatsApp SKIPPED – no Twilio client] To: ${to} | Msg: ${message}`);
        return;
    }
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${formatPhone(to)}`;
    try {
        const result = await client.messages.create({
            from: FROM,
            to: formattedTo,
            body: message,
        });
        logger.info(`WhatsApp sent to ${to}: SID=${result.sid}`);
        return result;
    } catch (err) {
        logger.error(`WhatsApp send failed to ${to}: ${err.message}`);
        // Non-blocking: don't rethrow
    }
}

function formatPhone(phone) {
    const clean = String(phone).replace(/\D/g, '');
    if (clean.startsWith('0')) return `+254${clean.slice(1)}`;
    if (clean.startsWith('254')) return `+${clean}`;
    return `+${clean}`;
}

const templates = {
    dispatched_sender: (trackingId, receivingOfficeName) =>
        `OpenDesk Parcel: Your parcel ${trackingId} has been dispatched and is on its way to ${receivingOfficeName}.`,

    dispatched_receiver: (trackingId, sendingOfficeName, receivingOfficeName) =>
        `OpenDesk Parcel: Your parcel ${trackingId} has been dispatched from ${sendingOfficeName}. It will arrive at ${receivingOfficeName} soon.`,

    arrived_sender: (trackingId, receivingOfficeName) =>
        `OpenDesk Parcel: Your parcel ${trackingId} has arrived at ${receivingOfficeName}.`,

    arrived_receiver: (trackingId, receivingOfficeName) =>
        `OpenDesk Parcel: Your parcel ${trackingId} is ready for pickup at ${receivingOfficeName}. Bring your ID and the QR code.`,

    picked_up_sender: (trackingId) =>
        `OpenDesk Parcel: Your parcel ${trackingId} was picked up by the receiver.`,

    trial_expiry_warning: (companyName, daysLeft) =>
        `OpenDesk Parcel: Hi ${companyName}! Your free trial ends in ${daysLeft} day(s). Buy a plan to continue using the service.`,
};

module.exports = { sendWhatsApp, templates };

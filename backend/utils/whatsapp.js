const twilio = require('twilio');

let client;
function getClient() {
    if (!client) client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return client;
}

function sanitize(str) {
    if (!str) return '';
    return String(str).replace(/[<>&"']/g, '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, 100);
}

function formatPhone(phone) {
    let p = phone.toString().replace(/\D/g, '');
    if (p.startsWith('0')) p = '254' + p.slice(1);
    if (!p.startsWith('254')) p = '254' + p;
    return p;
}

async function sendWhatsApp(to, message) {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'your_sid') {
            console.log(`[WhatsApp MOCK] To: ${to} | Message: ${message}`);
            return;
        }
        const phone = formatPhone(to);
        await getClient().messages.create({
            from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
            to: `whatsapp:+${phone}`,
            body: message,
        });
    } catch (err) {
        console.error('[WhatsApp] Failed to send:', err.message);
    }
}

async function sendWhatsAppWithPDF(to, message, pdfBuffer, filename) {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'your_sid') {
            console.log(`[WhatsApp MOCK] To: ${to} | Message: ${message} | PDF: ${filename}`);
            return;
        }
        const phone = formatPhone(to);
        try {
            await getClient().messages.create({
                from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
                to: `whatsapp:+${phone}`,
                body: message,
            });
        } catch (err) {
            console.error('[WhatsApp] Failed to send with PDF:', err.message);
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const phone = formatPhone(to);
                    await getClient().messages.create({
                        from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
                        to: `whatsapp:+${phone}`,
                        body: message,
                    });
                    return;
                } catch (retryErr) {
                    console.error(`[WhatsApp] Retry ${attempt} failed:`, retryErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[WhatsApp] All retries exhausted for', to);
    }
}

const templates = {
    toSender: (companyName, trackingId, fee, receivingOfficeName) =>
        `Parcel Sent via ${sanitize(companyName)}\n\nTracking: ${sanitize(trackingId)}\nAmount paid: KES ${fee}\nPickup office: ${sanitize(receivingOfficeName)}\n\nReceipt attached. Keep for reference.\n\nPowered by OpenDesk`,

    toReceiver: (companyName, trackingId, senderName, receivingOfficeName) =>
        `Parcel Incoming via ${sanitize(companyName)}\n\nTracking: ${sanitize(trackingId)}\nSender: ${sanitize(senderName)}\nPickup at: ${sanitize(receivingOfficeName)}\n\nReceipt attached. Show QR code at pickup.\n\nPowered by OpenDesk`,

    arrived: (trackingId, receivingOfficeName) =>
        `Parcel Arrived - ${sanitize(trackingId)}\n\nYour parcel is ready for pickup at ${sanitize(receivingOfficeName)}.\nBring your ID and the QR code.\n\nPowered by OpenDesk`,

    dispatched: (trackingId, sendingOfficeName) =>
        `Parcel Dispatched - ${sanitize(trackingId)}\n\nYour parcel has departed from ${sanitize(sendingOfficeName)} and is en route.\n\nPowered by OpenDesk`,

    pickedUp: (trackingId) =>
        `Parcel Picked Up - ${sanitize(trackingId)}\n\nThe receiver has collected the parcel.\n\nPowered by OpenDesk`,
};

module.exports = { sendWhatsApp, sendWhatsAppWithPDF, templates };

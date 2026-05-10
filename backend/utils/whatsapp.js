const twilio = require('twilio');

let client;
function getClient() {
  if (!client) client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client;
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
    console.log(`[WhatsApp] Sent to ${phone}`);
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
    const mediaUrl = await uploadPDFToTwilio(pdfBuffer, filename);
    await getClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to: `whatsapp:+${phone}`,
      body: message,
      mediaUrl: mediaUrl ? [mediaUrl] : undefined,
    });
    console.log(`[WhatsApp] Sent to ${phone} with PDF ${filename}`);
  } catch (err) {
    console.error('[WhatsApp] Failed to send with PDF:', err.message);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[WhatsApp] Retry attempt ${attempt} for ${to}`);
        const phone = formatPhone(to);
        await getClient().messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
          to: `whatsapp:+${phone}`,
          body: message,
        });
        console.log(`[WhatsApp] Sent text-only fallback to ${phone}`);
        return;
      } catch (retryErr) {
        console.error(`[WhatsApp] Retry ${attempt} failed:`, retryErr.message);
      }
    }
    console.error(`[WhatsApp] All retries exhausted for ${to}, sending text only`);
  }
}

async function uploadPDFToTwilio(pdfBuffer, filename) {
  try {
    const phone = formatPhone('254700000000');
    const msg = await getClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to: `whatsapp:+${phone}`,
      body: ' ',
      mediaUrl: [],
    });
    return null;
  } catch (err) {
    console.error('[WhatsApp] Media upload not supported, sending text only');
    return null;
  }
}

const templates = {
  toSender: (companyName, trackingId, fee, receivingOfficeName) =>
    `📦 Parcel Sent via ${companyName}\n\nTracking: ${trackingId}\nAmount paid: KES ${fee}\nPickup office: ${receivingOfficeName}\n\nReceipt attached. Keep for reference.\n\nPowered by OpenDesk`,

  toReceiver: (companyName, trackingId, senderName, receivingOfficeName) =>
    `📬 Parcel Incoming via ${companyName}\n\nTracking: ${trackingId}\nSender: ${senderName}\nPickup at: ${receivingOfficeName}\n\nReceipt attached. Show QR code at pickup.\n\nPowered by OpenDesk`,

  arrived: (trackingId, receivingOfficeName) =>
    `✅ Parcel Arrived – ${trackingId}\n\nYour parcel is ready for pickup at ${receivingOfficeName}.\nBring your ID and the QR code.\n\nPowered by OpenDesk`,

  dispatched: (trackingId, sendingOfficeName) =>
    `🚚 Parcel Dispatched – ${trackingId}\n\nYour parcel has departed from ${sendingOfficeName} and is en route.\n\nPowered by OpenDesk`,

  pickedUp: (trackingId) =>
    `✅ Parcel Picked Up – ${trackingId}\n\nThe receiver has collected the parcel.\n\nPowered by OpenDesk`,
};

module.exports = { sendWhatsApp, sendWhatsAppWithPDF, templates };
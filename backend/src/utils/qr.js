const QRCode = require('qrcode');
const logger = require('./logger');
const { generateParcelId, generateTrackingId } = require('../../utils/idgen');

async function generateQRDataURL(payload) {
    try {
        const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const dataUrl = await QRCode.toDataURL(input, {
            width: 300,
            margin: 2,
            color: {
                dark: '#011f4b',
                light: '#ffffff',
            },
        });
        return dataUrl;
    } catch (err) {
        logger.error('QR code generation failed:', err);
        throw err;
    }
}

module.exports = { generateQRDataURL, generateParcelId, generateTrackingId };

const QRCode = require('qrcode');

async function generateQR(text) {
    return QRCode.toDataURL(text, { width: 300, margin: 2, errorCorrectionLevel: 'H' });
}

async function generateQRSVG(text) {
    return QRCode.toString(text, { type: 'svg', width: 300 });
}

async function generateQRBuffer(text) {
    return QRCode.toBuffer(text, { width: 300, margin: 2 });
}

module.exports = { generateQR, generateQRSVG, generateQRBuffer };

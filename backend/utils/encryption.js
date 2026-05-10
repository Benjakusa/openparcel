const crypto = require('crypto');

const KEY = Buffer.from(process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY || 'a'.repeat(64), 'hex');
const IV = Buffer.from(process.env.MPESA_CREDENTIALS_ENCRYPTION_IV || 'b'.repeat(32), 'hex');

function encrypt(text) {
    if (!text) return null;
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, IV);
    let enc = cipher.update(text, 'utf8', 'hex');
    enc += cipher.final('hex');
    return enc;
}

function decrypt(hex) {
    if (!hex) return null;
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
        let dec = decipher.update(hex, 'hex', 'utf8');
        dec += decipher.final('utf8');
        return dec;
    } catch {
        return null;
    }
}

module.exports = { encrypt, decrypt };

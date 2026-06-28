const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

function getKey() {
    const raw = process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY;
    if (!raw || raw.length !== 64) {
        throw new Error('MPESA_CREDENTIALS_ENCRYPTION_KEY must be set to a 64-character hex string');
    }
    return Buffer.from(raw, 'hex');
}

function encrypt(text) {
    if (!text) return null;
    const key = getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let enc = cipher.update(text, 'utf8', 'hex');
    enc += cipher.final('hex');
    return `${iv.toString('hex')}:${enc}`;
}

function decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
        const key = getKey();
        const [ivHex, ciphertext] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let dec = decipher.update(ciphertext, 'hex', 'utf8');
        dec += decipher.final('utf8');
        return dec;
    } catch {
        return null;
    }
}

function maskString(str, visibleChars = 4) {
    if (!str || str.length <= visibleChars) return str;
    return `${'*'.repeat(str.length - visibleChars)}${str.slice(-visibleChars)}`;
}

module.exports = { encrypt, decrypt, maskString };

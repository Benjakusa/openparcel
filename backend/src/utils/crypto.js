const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
const IV = Buffer.from(process.env.MPESA_CREDENTIALS_ENCRYPTION_IV || '0'.repeat(32), 'hex');

/**
 * Encrypt a plaintext string
 * @param {string} text - plaintext to encrypt
 * @returns {string} - hex-encoded iv:ciphertext
 */
function encrypt(text) {
    if (!text) return null;
    // Use a fresh random IV per encryption for extra security
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted by encrypt()
 * @param {string} encryptedText - hex-encoded iv:ciphertext
 * @returns {string} - plaintext
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
        const [ivHex, ciphertext] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        return null;
    }
}

/**
 * Mask a string showing only last 4 chars
 * e.g. 12345678 → ***5678
 */
function maskString(str, visibleChars = 4) {
    if (!str || str.length <= visibleChars) return str;
    return `${'*'.repeat(str.length - visibleChars)}${str.slice(-visibleChars)}`;
}

module.exports = { encrypt, decrypt, maskString };

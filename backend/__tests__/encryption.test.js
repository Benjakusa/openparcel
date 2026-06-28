process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
const { encrypt, decrypt } = require('../utils/encryption');

describe('Encryption', () => {
    it('encrypts and decrypts correctly', () => {
        const original = 'mySecretData123';
        const encrypted = encrypt(original);
        expect(encrypted).toBeTruthy();
        expect(encrypted).toContain(':');
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('returns null for empty input', () => {
        expect(encrypt(null)).toBeNull();
        expect(encrypt('')).toBeNull();
        expect(decrypt(null)).toBeNull();
    });

    it('produces different ciphertexts for same input (random IV)', () => {
        const input = 'sameData';
        const r1 = encrypt(input);
        const r2 = encrypt(input);
        expect(r1).not.toBe(r2);
    });

    it('returns null for tampered ciphertext', () => {
        const encrypted = encrypt('test');
        const tampered = encrypted.replace(/^.{10}/, '0000000000');
        expect(decrypt(tampered)).toBeNull();
    });
});

const ID_LENGTH = 5;
const BASE = 36;
const MAX_ID_VALUE = Math.pow(BASE, ID_LENGTH) - 1;
const MAX_RETRIES = 100;

function encodeBase36(num) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num === 0) return '0'.repeat(ID_LENGTH);
    let result = '';
    let n = num;
    while (n > 0) {
        result = chars[n % BASE] + result;
        n = Math.floor(n / BASE);
    }
    return result.padStart(ID_LENGTH, '0');
}

function containsRestricted(str) {
    return /open/i.test(str);
}

function isMixed(str) {
    return /[A-Z]/i.test(str) && /[0-9]/.test(str);
}

async function generateIdentifier(poolOrDb) {
    for (let i = 0; i < MAX_RETRIES; i++) {
        const { rows } = await poolOrDb.query("SELECT nextval('parcel_identifier_seq') AS val", []);
        const num = parseInt(rows[0].val, 10);

        if (num > MAX_ID_VALUE) {
            throw new Error('parcel_identifier_seq exhausted: no more unique 5-char IDs available');
        }

        const encoded = encodeBase36(num);

        // Must be a mix of letters AND digits, and must not contain restricted words
        if (isMixed(encoded) && !containsRestricted(encoded)) {
            return encoded;
        }
    }
    throw new Error(`Failed to generate valid ID after ${MAX_RETRIES} retries`);
}

async function generateParcelId(poolOrDb) {
    return generateIdentifier(poolOrDb);
}

async function generateTrackingId(poolOrDb) {
    return generateIdentifier(poolOrDb);
}

async function initIdGenerator(poolOrDb) {
    await poolOrDb.query(`CREATE SEQUENCE IF NOT EXISTS parcel_identifier_seq START WITH 1 INCREMENT BY 1`, []);
    try {
        await poolOrDb.query(`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(5) UNIQUE`, []);
    } catch (_) {
    }
}

module.exports = { generateParcelId, generateTrackingId, encodeBase36, containsRestricted, initIdGenerator };

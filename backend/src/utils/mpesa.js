const axios = require('axios');
const logger = require('./logger');
const { decrypt } = require('./crypto');

const SANDBOX_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_URL = 'https://api.safaricom.co.ke';

/**
 * Get Daraja API access token
 */
async function getAccessToken(consumerKey, consumerSecret, environment = 'sandbox') {
    const baseUrl = environment === 'production' ? PRODUCTION_URL : SANDBOX_URL;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const res = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
    });
    return res.data.access_token;
}

/**
 * Generate Daraja timestamp (YYYYMMDDHHmmss)
 */
function getDarajaTimestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Generate Daraja password (base64(shortcode + passkey + timestamp))
 */
function getDarajaPassword(shortcode, passkey, timestamp) {
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * Format phone number to 254XXXXXXXXX
 */
function formatPhone(phone) {
    const clean = String(phone).replace(/\D/g, '');
    if (clean.startsWith('0')) return `254${clean.slice(1)}`;
    if (clean.startsWith('+')) return clean.slice(1);
    return clean;
}

/**
 * STK Push for PLATFORM subscription payments
 */
async function platformSTKPush({ phone, amount, accountRef, description, callbackUrl }) {
    const consumerKey = process.env.PLATFORM_MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.PLATFORM_MPESA_CONSUMER_SECRET;
    const shortcode = process.env.PLATFORM_MPESA_SHORTCODE;
    const passkey = process.env.PLATFORM_MPESA_PASSKEY;
    const env = process.env.PLATFORM_MPESA_ENVIRONMENT || 'sandbox';
    const cb = callbackUrl || process.env.PLATFORM_MPESA_CALLBACK_URL;
    const baseUrl = env === 'production' ? PRODUCTION_URL : SANDBOX_URL;

    const token = await getAccessToken(consumerKey, consumerSecret, env);
    const timestamp = getDarajaTimestamp();
    const password = getDarajaPassword(shortcode, passkey, timestamp);

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: formatPhone(phone),
        PartyB: shortcode,
        PhoneNumber: formatPhone(phone),
        CallBackURL: cb,
        AccountReference: accountRef || 'OpenDeskParcel',
        TransactionDesc: description || 'Subscription Payment',
    };

    const res = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });

    logger.info(`Platform STK Push sent: ${JSON.stringify(res.data)}`);
    return res.data;
}

/**
 * STK Push using COMPANY credentials (for parcel fees)
 * @param {Object} company - company row with encrypted credentials
 * @param {string} phone - sender phone
 * @param {number} amount - fee amount
 * @param {string} accountRef - parcel tracking or reference
 * @param {string} callbackUrl - callback URL for parcel-callback
 */
async function companySTKPush({ company, phone, amount, accountRef, description, callbackUrl }) {
    const consumerKey = decrypt(company.mpesa_consumer_key);
    const consumerSecret = decrypt(company.mpesa_consumer_secret);
    const passkey = decrypt(company.mpesa_passkey);
    const shortcode = company.mpesa_shortcode;
    const env = company.mpesa_environment || 'sandbox';
    const baseUrl = env === 'production' ? PRODUCTION_URL : SANDBOX_URL;

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
        throw new Error('Company M-Pesa credentials not configured');
    }

    const token = await getAccessToken(consumerKey, consumerSecret, env);
    const timestamp = getDarajaTimestamp();
    const password = getDarajaPassword(shortcode, passkey, timestamp);

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: formatPhone(phone),
        PartyB: shortcode,
        PhoneNumber: formatPhone(phone),
        CallBackURL: callbackUrl,
        AccountReference: accountRef || 'ParcelFee',
        TransactionDesc: description || 'Parcel Fee Payment',
    };

    const res = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });

    logger.info(`Company STK Push sent for company ${company.id}: ${JSON.stringify(res.data)}`);
    return res.data;
}

/**
 * Calculate parcel fee: KES 100 base + KES 20 per kg (rounded up)
 */
function calculateParcelFee(weightKg) {
    const roundedKg = Math.ceil(parseFloat(weightKg));
    return 100 + roundedKg * 20;
}

module.exports = {
    platformSTKPush,
    companySTKPush,
    calculateParcelFee,
    formatPhone,
};

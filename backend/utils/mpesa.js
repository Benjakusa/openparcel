const axios = require('axios');

async function getAccessToken({ consumerKey, consumerSecret, environment }) {
    const base = environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    const creds = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const { data } = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${creds}` },
    });
    return { token: data.access_token, base };
}

async function stkPush({ consumerKey, consumerSecret, shortcode, passkey, environment, phone, amount, callbackUrl, description }) {
    const { token, base } = await getAccessToken({ consumerKey, consumerSecret, environment });
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // Normalize phone
    let ph = phone.toString().replace(/\D/g, '');
    if (ph.startsWith('0')) ph = '254' + ph.slice(1);
    if (!ph.startsWith('254')) ph = '254' + ph;

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: ph,
        PartyB: shortcode,
        PhoneNumber: ph,
        CallBackURL: callbackUrl,
        AccountReference: 'OpenDeskParcel',
        TransactionDesc: description || 'Parcel Fee',
    };

    const { data } = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

module.exports = { stkPush };

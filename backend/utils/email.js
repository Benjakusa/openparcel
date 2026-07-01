const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    return transporter;
}

async function sendVerificationEmail(email, token) {
    const t = getTransporter();
    if (!t) {
        console.warn(`[EMAIL] Skipping verification email to ${email} — EMAIL_HOST/USER/PASS not configured`);
        return;
    }
    const baseUrl = process.env.BASE_URL || 'https://openparcel-5f7k.onrender.com';
    const link = `${baseUrl}/api/auth/verify-email/${token}`;
    await t.sendMail({
        from: `"OpenDesk Parcel" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your OpenDesk Parcel account',
        html: `<p>Click <a href="${link}">here</a> to verify your email address.</p><p>Or paste this link: ${link}</p>`,
    });
}

module.exports = { sendVerificationEmail };

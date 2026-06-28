const router = require('express').Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// OAuth2/OIDC SSO support – configurable via env
// Set any of: GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID, GITHUB_CLIENT_ID
//
// Flow:
//   GET  /api/sso/:provider/login  -> redirect to provider
//   GET  /api/sso/:provider/callback <- provider redirects here with code
//   POST /api/sso/link             -> link provider account to existing user

const PROVIDERS = {};

if (process.env.GOOGLE_CLIENT_ID) {
    PROVIDERS.google = {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: 'openid email profile',
    };
}

if (process.env.MICROSOFT_CLIENT_ID) {
    PROVIDERS.microsoft = {
        authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        scope: 'openid email profile',
    };
}

if (process.env.GITHUB_CLIENT_ID) {
    PROVIDERS.github = {
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scope: 'read:user user:email',
    };
}

const stateStore = new Map();

router.get('/:provider/login', (req, res) => {
    const provider = PROVIDERS[req.params.provider];
    if (!provider) return res.status(404).json({ message: 'Unsupported provider' });

    const state = crypto.randomBytes(16).toString('hex');
    stateStore.set(state, { provider: req.params.provider, redirect: req.query.redirect || '/' });
    setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);

    const params = new URLSearchParams({
        client_id: provider.clientId,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/sso/${req.params.provider}/callback`,
        response_type: 'code',
        scope: provider.scope,
        state,
    });

    res.redirect(`${provider.authorizeUrl}?${params.toString()}`);
});

router.get('/:provider/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).json({ message: 'Missing code or state' });

    const stored = stateStore.get(state);
    if (!stored) return res.status(400).json({ message: 'Invalid or expired state' });
    stateStore.delete(state);

    const provider = PROVIDERS[req.params.provider];
    if (!provider) return res.status(404).json({ message: 'Unsupported provider' });

    try {
        const tokenRes = await fetch(provider.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                client_id: provider.clientId,
                client_secret: provider.clientSecret,
                code,
                redirect_uri: `${req.protocol}://${req.get('host')}/api/sso/${req.params.provider}/callback`,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenRes.json();

        const userRes = await fetch(provider.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await userRes.json();

        const email = profile.email || (profile.login ? `${profile.login}@github.com` : null);
        if (!email) return res.status(400).json({ message: 'Could not retrieve email from provider' });

        const { rows } = await db.query(
            'SELECT id, email, role, company_id, office_id FROM users WHERE email=$1',
            [email]
        );

        if (!rows.length) {
            return res.status(404).json({
                message: 'No account found. Ask your admin to add this email to your account.',
                sso_email: email,
                sso_provider: req.params.provider,
            });
        }

        const user = rows[0];
        const payload = {
            id: user.id,
            role: user.role,
            company_id: user.company_id,
            office_id: user.office_id,
            email: user.email,
        };

        const jti = crypto.randomBytes(16).toString('hex');
        const token = jwt.sign({ ...payload, jti }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        res.json({
            token,
            refresh_token: refreshToken,
            user: payload,
            expires_in: 3600,
        });
    } catch (err) {
        console.error('SSO callback error:', err);
        res.status(500).json({ message: 'SSO authentication failed' });
    }
});

module.exports = router;

const jwt = require('jsonwebtoken');

/**
 * Require a valid JWT. Attaches req.user = { id, role, company_id, office_id }
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No authentication token provided' });
    }
    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };

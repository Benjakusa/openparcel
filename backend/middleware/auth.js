const jwt = require('jsonwebtoken');

function auth(...roles) {
    return (req, res, next) => {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
        try {
            const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
            req.user = payload;
            if (roles.length && !roles.includes(payload.role)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            next();
        } catch {
            res.status(401).json({ message: 'Invalid token' });
        }
    };
}

module.exports = { auth };

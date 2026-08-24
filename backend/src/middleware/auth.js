const jwt = require('jsonwebtoken');

/**
 * Express middleware that verifies the JWT from the Authorization header.
 * Attaches the decoded payload as `req.user` on success.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'attendance_smart_super_secret_jwt_key_2026';
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;

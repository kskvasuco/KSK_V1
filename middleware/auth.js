const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'ksk-jwt-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '14d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

/** Hydrate express-session from JWT so existing routes work unchanged */
function hydrateSessionFromToken(req) {
  const token = getBearerToken(req);
  if (!token || !req.session) return false;
  try {
    const payload = verifyToken(token);
    if (payload.role === 'user' && payload.sub) {
      req.session.userId = payload.sub;
      return true;
    }
    if (payload.role === 'admin') {
      req.session.isAdmin = true;
      return true;
    }
    if (payload.role === 'staff' && payload.sub) {
      req.session.staffId = payload.sub;
      req.session.isStaff = true;
      return true;
    }
  } catch {
    // invalid token — ignore
  }
  return false;
}

function tokenMiddleware(req, res, next) {
  hydrateSessionFromToken(req);
  next();
}

function requireAdminOrStaff(req, res, next) {
  hydrateSessionFromToken(req);
  if (req.session && (req.session.isAdmin || req.session.isStaff)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  hydrateSessionFromToken(req);
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
}

function requireUserAuth(req, res, next) {
  hydrateSessionFromToken(req);
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  const User = require('../models/User');
  User.findById(req.session.userId).select('isBlocked').lean()
    .then(user => {
      if (user && user.isBlocked) {
        req.session.destroy();
        return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
      }
      next();
    })
    .catch(err => {
      console.error('Auth middleware error:', err);
      res.status(500).json({ error: 'Authentication error' });
    });
}

module.exports = {
  signToken,
  verifyToken,
  getBearerToken,
  hydrateSessionFromToken,
  tokenMiddleware,
  requireAdminOrStaff,
  requireAdmin,
  requireUserAuth,
  JWT_SECRET,
};

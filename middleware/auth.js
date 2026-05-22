const jwt = require('jsonwebtoken');
const AppController = require('../models/AppController');

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
      req.session.adminAuthVersion = Number.isInteger(payload.av) ? payload.av : 0;
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

let adminAuthVersionCache = { value: 1, ts: 0 };
const ADMIN_VERSION_CACHE_TTL_MS = 5000;

async function getAdminAuthVersion() {
  const now = Date.now();
  if (now - adminAuthVersionCache.ts < ADMIN_VERSION_CACHE_TTL_MS) {
    return adminAuthVersionCache.value;
  }
  const settings = await AppController.findOne().select('adminAuthVersion').lean();
  const version = Number.isInteger(settings?.adminAuthVersion) ? settings.adminAuthVersion : 1;
  adminAuthVersionCache = { value: version, ts: now };
  return version;
}

async function isAdminSessionFresh(req) {
  if (!req.session?.isAdmin) return false;
  const sessionVersion = Number.isInteger(req.session.adminAuthVersion) ? req.session.adminAuthVersion : 0;
  const currentVersion = await getAdminAuthVersion();
  return sessionVersion === currentVersion;
}

async function requireAdminOrStaff(req, res, next) {
  hydrateSessionFromToken(req);
  if (req.session?.isStaff) {
    return next();
  }
  if (req.session?.isAdmin) {
    try {
      const fresh = await isAdminSessionFresh(req);
      if (fresh) return next();
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Admin session expired. Please login again.' });
    } catch (err) {
      console.error('Admin auth version check failed:', err);
      return res.status(500).json({ error: 'Authentication error' });
    }
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

async function requireAdmin(req, res, next) {
  hydrateSessionFromToken(req);
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }
  try {
    const fresh = await isAdminSessionFresh(req);
    if (fresh) return next();
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Admin session expired. Please login again.' });
  } catch (err) {
    console.error('Admin auth version check failed:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
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

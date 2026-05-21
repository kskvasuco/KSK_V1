const express = require('express');
const User = require('../models/User');
const Staff = require('../models/Staff');
const AppController = require('../models/AppController');
const { signToken, getBearerToken, verifyToken, hydrateSessionFromToken } = require('../middleware/auth');

const router = express.Router();

function isMobileNumber(s) {
  return /^\d{10}$/.test(String(s || '').trim());
}

async function loginUser(mobile, password, req) {
  if (!mobile || !password) {
    throw { status: 400, message: 'Mobile number is required in both fields.' };
  }
  if (password !== mobile) {
    throw { status: 400, message: 'Entries must match.' };
  }
  let user = await User.findOne({ mobile }).select('_id mobile name isBlocked').lean();
  if (!user) {
    const newUser = new User({ mobile });
    await newUser.save();
    user = { _id: newUser._id, mobile: newUser.mobile, name: newUser.name, isBlocked: false };
  }
  if (user.isBlocked) {
    throw { status: 403, message: 'Your account has been blocked. Please contact support.' };
  }
  req.session.userId = user._id;
  const token = signToken({ role: 'user', sub: user._id.toString() });
  return {
    token,
    role: 'user',
    profile: { id: user._id, name: user.name, mobile: user.mobile },
  };
}

async function loginAdmin(username, password, req) {
  let ADMIN_USER = process.env.ADMIN_USER || 'admin';
  let ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';
  const settings = await AppController.findOne();
  if (settings) {
    if (settings.adminLoginPassword) ADMIN_PASS = settings.adminLoginPassword;
    if (settings.adminUsername) ADMIN_USER = settings.adminUsername;
  }
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    throw { status: 401, message: 'Invalid admin credentials' };
  }
  req.session.isAdmin = true;
  const token = signToken({ role: 'admin', sub: 'admin' });
  return { token, role: 'admin', profile: { username: ADMIN_USER } };
}

async function loginStaff(username, password, req) {
  const staff = await Staff.findOne({ username }).select('_id username password name').lean();
  if (!staff || password !== staff.password) {
    throw { status: 401, message: 'Invalid credentials' };
  }
  req.session.staffId = staff._id;
  req.session.isStaff = true;
  const token = signToken({ role: 'staff', sub: staff._id.toString() });
  return {
    token,
    role: 'staff',
    profile: { id: staff._id, username: staff.username, name: staff.name },
  };
}

/** POST /api/auth/login — centralized login */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, role: roleHint } = req.body;
    const id = String(identifier || '').trim();
    const pass = password ?? '';

    if (!id || pass === '') {
      return res.status(400).json({ error: 'Identifier and password are required.' });
    }

    let result;

    if (roleHint === 'user' || (!roleHint && isMobileNumber(id))) {
      result = await loginUser(id, pass, req);
    } else if (roleHint === 'admin') {
      result = await loginAdmin(id, pass, req);
    } else if (roleHint === 'staff') {
      result = await loginStaff(id, pass, req);
    } else {
      // auto: try admin, then staff (non-mobile identifiers)
      try {
        result = await loginAdmin(id, pass, req);
      } catch (adminErr) {
        if (adminErr.status === 401) {
          result = await loginStaff(id, pass, req);
        } else {
          throw adminErr;
        }
      }
    }

    res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Login failed' });
  }
});

/** GET /api/auth/me */
router.get('/me', async (req, res) => {
  hydrateSessionFromToken(req);

  if (req.session?.userId) {
    const user = await User.findById(req.session.userId).select('-__v').lean();
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.isBlocked) {
      req.session.destroy();
      return res.status(403).json({ error: 'Account blocked' });
    }
    return res.json({ role: 'user', profile: user });
  }

  if (req.session?.isAdmin) {
    return res.json({ role: 'admin', profile: { username: process.env.ADMIN_USER || 'admin' } });
  }

  if (req.session?.isStaff && req.session.staffId) {
    const staff = await Staff.findById(req.session.staffId).select('username name').lean();
    if (!staff) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ role: 'staff', profile: staff });
  }

  const token = getBearerToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.role === 'user') {
        const user = await User.findById(payload.sub).select('-__v').lean();
        if (user) return res.json({ role: 'user', profile: user });
      }
      if (payload.role === 'admin') {
        return res.json({ role: 'admin', profile: { username: process.env.ADMIN_USER || 'admin' } });
      }
      if (payload.role === 'staff') {
        const staff = await Staff.findById(payload.sub).select('username name').lean();
        if (staff) return res.json({ role: 'staff', profile: staff });
      }
    } catch {
      // fall through
    }
  }

  return res.status(401).json({ error: 'Not authenticated' });
});

/** GET /api/auth/bridge-page?token=&redirect= — HTML page for WebView session bridge */
router.get('/bridge-page', (req, res) => {
  const token = String(req.query.token || '').replace(/['"<>]/g, '');
  const redirect = String(req.query.redirect || '/admin').replace(/['"<>]/g, '');
  if (!token) {
    return res.status(400).send('Missing token query parameter');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
    <p style="font-family:sans-serif;padding:24px">Loading admin panel…</p>
    <script>
      fetch('/api/auth/bridge-session', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ${token}' },
        credentials: 'include'
      }).then(function(r) {
        if (!r.ok) throw new Error('bridge failed');
        window.location.replace('${redirect}');
      }).catch(function() {
        document.body.innerHTML = '<p style="padding:24px">Could not sign in. Log out and log in again in the app.</p>';
      });
    </script>
  </body></html>`);
});

/** POST /api/auth/bridge-session — sync JWT to cookie session (for WebView admin panel) */
router.post('/bridge-session', (req, res) => {
  const ok = hydrateSessionFromToken(req);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }
  if (req.session.isAdmin) {
    return res.json({ ok: true, role: 'admin', redirect: '/admin' });
  }
  if (req.session.isStaff) {
    return res.json({ ok: true, role: 'staff', redirect: '/staff' });
  }
  if (req.session.userId) {
    return res.json({ ok: true, role: 'user', redirect: '/' });
  }
  return res.status(401).json({ error: 'No session created' });
});

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Could not log out.' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

module.exports = router;

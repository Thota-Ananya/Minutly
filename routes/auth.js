const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const wrap = require('../utils/wrap');
const { signToken, setAuthCookie, clearAuthCookie, getUserFromRequest, publicUser } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/signup',
  wrap(async (req, res) => {
    const { name, email, password, phone } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();

    if (cleanName.length < 2 || cleanName.length > 60) throw new HttpError(400, 'Please enter your name (2 to 60 letters).');
    if (!EMAIL_RE.test(cleanEmail)) throw new HttpError(400, 'Please enter a valid email address.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 72)
      throw new HttpError(400, 'Password must be 8 to 72 characters long.');
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) throw new HttpError(400, 'Phone must be a 10 digit Indian mobile number.');

    if (await User.findOne({ email: cleanEmail })) throw new HttpError(409, 'An account with this email already exists. Please log in.');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: cleanName, email: cleanEmail, phone: cleanPhone, passwordHash, role: 'customer' });
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    const ok = user && typeof password === 'string' && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'Wrong email or password.');
    setAuthCookie(res, signToken(user));
    res.json({ user: publicUser(user) });
  })
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Always answers 200. "user" is null when nobody is logged in.
router.get(
  '/me',
  wrap(async (req, res) => {
    const user = await getUserFromRequest(req);
    res.json({ user: user ? publicUser(user) : null });
  })
);

module.exports = router;

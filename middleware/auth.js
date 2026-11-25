const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

const COOKIE = 'minutly_token';
const isProd = () => process.env.NODE_ENV === 'production';

function signToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: isProd() };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE, cookieOptions());
}

async function getUserFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(payload.id);
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return next(new HttpError(401, 'Please log in first.'));
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireStaff(req, res, next) {
  if (!req.user || req.user.role !== 'staff') return next(new HttpError(403, 'Staff access only.'));
  next();
}

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

module.exports = { signToken, setAuthCookie, clearAuthCookie, getUserFromRequest, requireAuth, requireStaff, publicUser };

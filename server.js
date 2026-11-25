require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { seedIfNeeded } = require('./seed');

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI. Add it to your .env file (or Render environment variables).');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  if (isProd) {
    console.error('Missing JWT_SECRET. Add it to your Render environment variables.');
    process.exit(1);
  }
  process.env.JWT_SECRET = 'dev-only-secret-change-me';
  console.warn('JWT_SECRET not set. Using an unsafe development secret.');
}

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

// Security headers. "upgrade-insecure-requests" is switched off locally so http://localhost works.
const csp = helmet.contentSecurityPolicy.getDefaultDirectives();
if (!isProd) delete csp['upgrade-insecure-requests'];
app.use(helmet({ contentSecurityPolicy: { directives: csp } }));

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.get('/healthz', (req, res) => res.json({ ok: true }));

// CSRF protection: every state-changing API call must carry our custom header
// (browsers cannot add it on cross-site forms).
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') return res.status(400).json({ error: 'Bad request.' });
  next();
});

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1500, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/auth/signup'], authLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).send('Page not found'));

// Central error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  if (err.name === 'CastError' || err.name === 'ValidationError') return res.status(400).json({ error: 'Invalid data.' });
  if (err.code === 11000) return res.status(409).json({ error: 'This already exists.' });
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error. Please try again.' : err.message });
});

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    console.log('MongoDB connected');
    await seedIfNeeded();
    app.listen(PORT, () => console.log(`Minutly running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });

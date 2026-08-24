require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any .vercel.app deployment or configured allowedOrigins
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    // In production without FRONTEND_URL set, allow the request to prevent false blocks
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',              require('./src/routes/auth'));
app.use('/subjects',          require('./src/routes/subjects'));
app.use('/settings',          require('./src/routes/settings'));
app.use('/timetable',         require('./src/routes/timetable'));
app.use('/timetable',         require('./src/routes/ocr'));       // POST /timetable/upload-screenshot
app.use('/',                  require('./src/routes/lectures'));  // GET /today, POST /lectures/:id/mark
app.use('/summary',           require('./src/routes/summary'));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Smart Attendance Tracker API running on http://localhost:${PORT}`);
});

module.exports = app;

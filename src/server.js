const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const db = require('./db/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if HTTPS in production
}));

app.use(authRoutes);
app.use(eventRoutes);

app.get('/health', async (req, res) => {
  try {
    await db.query('select 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/events');
  } else {
    res.redirect('/login');
  }
});

// After all routes: Unknown path handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || (err instanceof SyntaxError ? 400 : 500);
  const userStatus = status < 500 ? status : 500;
  res.status(userStatus).json({
    error: userStatus < 500 ? 'That request is not valid' : 'Something went wrong on our side'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

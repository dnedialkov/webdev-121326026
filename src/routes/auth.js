const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const fs = require('fs');
const path = require('path');

const loginHtmlPath = path.join(__dirname, '../views/login.html');
const registerHtmlPath = path.join(__dirname, '../views/register.html');

router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/events');
  }
  let html = fs.readFileSync(loginHtmlPath, 'utf8');
  const error = req.query.error;
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : '';
  html = html.replace('{{error_html}}', errorHtml);
  res.send(html);
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.authenticateUser(email, password);
    if (!result.success) {
      return res.redirect('/login?error=' + encodeURIComponent(result.error));
    }
    req.session.user = result.user;
    res.redirect('/events');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/register', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/events');
  }
  let html = fs.readFileSync(registerHtmlPath, 'utf8');
  const error = req.query.error;
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : '';
  html = html.replace('{{error_html}}', errorHtml);
  res.send(html);
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const result = await authService.registerUser(email, password, role || 'member');
    if (!result.success) {
      return res.redirect('/register?error=' + encodeURIComponent(result.error));
    }
    req.session.user = result.user;
    res.redirect('/events');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

module.exports = router;

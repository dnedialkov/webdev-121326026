const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const googleOAuthService = require('../services/googleOAuthService');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const loginHtmlPath = path.join(__dirname, '../views/login.html');
const registerHtmlPath = path.join(__dirname, '../views/register.html');

router.get('/api/auth/google', (req, res) => {
  if (req.session?.user) {
    return res.redirect('/events');
  }

  const state = randomBytes(32).toString('hex');
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = new URL('/api/auth/google/callback', baseUrl).toString();

  try {
    const authorizationUrl = googleOAuthService.getAuthorizationUrl(state, { redirectUri });
    req.session.googleOAuthState = state;
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error(error);
    res.status(503).send('Google sign-in is not available');
  }
});

router.get('/api/auth/google/callback', async (req, res) => {
  const expectedState = req.session?.googleOAuthState;
  delete req.session?.googleOAuthState;
  if (!expectedState || typeof req.query.state !== 'string' || req.query.state !== expectedState) {
    return res.status(400).send('Google sign-in could not be verified');
  }

  if (req.query.error) {
    return res.redirect('/login?error=' + encodeURIComponent('Google sign-in was cancelled'));
  }
  if (typeof req.query.code !== 'string' || !req.query.code) {
    return res.redirect('/login?error=' + encodeURIComponent('Google sign-in failed'));
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = new URL('/api/auth/google/callback', baseUrl).toString();

  try {
    const profile = await googleOAuthService.getGoogleProfile(req.query.code, redirectUri);
    const user = await authService.authenticateGoogleUser(profile.email);
    req.session.regenerate((error) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Google sign-in could not be completed');
      }
      req.session.user = user;
      res.redirect('/events');
    });
  } catch (error) {
    console.error(error);
    res.redirect('/login?error=' + encodeURIComponent('Google sign-in failed'));
  }
});

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

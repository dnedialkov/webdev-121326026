const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const authService = require('../services/authService');
const googleOAuthService = require('../services/googleOAuthService');

async function startServer(t) {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://localhost:${server.address().port}`;
}

async function postForm(baseUrl, path, fields, cookie) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: new URLSearchParams(fields),
    redirect: 'manual'
  });
}

function configureGoogleOAuth(t, baseUrl) {
  const previous = {
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    clientId: process.env.GOOGLE_CLIENT_ID
  };
  process.env.PUBLIC_BASE_URL = baseUrl;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  t.after(() => {
    if (previous.publicBaseUrl === undefined) {
      delete process.env.PUBLIC_BASE_URL;
    } else {
      process.env.PUBLIC_BASE_URL = previous.publicBaseUrl;
    }
    if (previous.clientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = previous.clientId;
    }
  });
}

test('login and registration pages escape messages and redirect signed-in users', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({
    success: true,
    user: { id: 7, email: 'member@example.com', role: 'member' }
  }));

  const loginPage = await fetch(`${baseUrl}/login?error=${encodeURIComponent('<bad & "input">')}`);
  const loginHtml = await loginPage.text();
  assert.match(loginHtml, /&lt;bad &amp; &quot;input&quot;&gt;/);
  assert.match(loginHtml, /href="\/api\/auth\/google">Continue with Google/);
  const registerPage = await fetch(`${baseUrl}/register?error=${encodeURIComponent("can't <register>")}`);
  assert.match(await registerPage.text(), /can&#39;t &lt;register&gt;/);

  const login = await postForm(baseUrl, '/login', { email: 'member@example.com', password: 'pw' });
  assert.equal(login.headers.get('location'), '/events');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${baseUrl}/login`, { headers: { Cookie: cookie }, redirect: 'manual' })).headers.get('location'), '/events');
  assert.equal((await fetch(`${baseUrl}/register`, { headers: { Cookie: cookie }, redirect: 'manual' })).headers.get('location'), '/events');

  const logout = await fetch(`${baseUrl}/logout`, { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(logout.headers.get('location'), '/login');
  assert.equal(authenticate.mock.callCount(), 1);
});

test('login and registration handle failed, successful, and exceptional service responses', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({
    success: false,
    error: 'Invalid email or password'
  }));
  const register = t.mock.method(authService, 'registerUser', async () => ({
    success: false,
    error: 'Email already registered'
  }));
  t.mock.method(console, 'error', () => {});

  assert.match(
    (await postForm(baseUrl, '/login', { email: 'x@example.com', password: 'pw' })).headers.get('location'),
    /error=Invalid%20email%20or%20password/
  );
  authenticate.mock.mockImplementation(async () => ({
    success: true,
    user: { id: 2, email: 'x@example.com', role: 'member' }
  }));
  assert.equal((await postForm(baseUrl, '/login', { email: 'x@example.com', password: 'pw' })).headers.get('location'), '/events');
  authenticate.mock.mockImplementation(async () => { throw new Error('login failure'); });
  assert.equal((await postForm(baseUrl, '/login', { email: 'x@example.com', password: 'pw' })).status, 500);

  assert.match(
    (await postForm(baseUrl, '/register', { email: 'x@example.com', password: 'pw' })).headers.get('location'),
    /error=Email%20already%20registered/
  );
  register.mock.mockImplementation(async () => ({
    success: true,
    user: { id: 3, email: 'new@example.com', role: 'member' }
  }));
  assert.equal((await postForm(baseUrl, '/register', { email: 'new@example.com', password: 'pw', role: '' })).headers.get('location'), '/events');
  assert.deepEqual(register.mock.calls.at(-1).arguments, ['new@example.com', 'pw', 'member']);
  register.mock.mockImplementation(async () => { throw new Error('register failure'); });
  assert.equal((await postForm(baseUrl, '/register', { email: 'x@example.com', password: 'pw' })).status, 500);
});

test('AC-15 Google sign-in redirects to Google and creates an authenticated session after callback', async (t) => {
  const baseUrl = await startServer(t);
  configureGoogleOAuth(t, baseUrl);

  const profile = t.mock.method(googleOAuthService, 'getGoogleProfile', async (code, redirectUri) => {
    assert.equal(code, 'google-auth-code');
    assert.equal(redirectUri, `${baseUrl}/api/auth/google/callback`);
    return { subject: 'google-subject', email: 'member@example.com' };
  });
  const authenticate = t.mock.method(authService, 'authenticateGoogleUser', async () => ({
    id: 7,
    email: 'member@example.com',
    role: 'member'
  }));

  const start = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const authorizationUrl = new URL(start.headers.get('location'));
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), `${baseUrl}/api/auth/google/callback`);
  assert.ok(authorizationUrl.searchParams.get('state'));
  const state = authorizationUrl.searchParams.get('state');
  const cookie = start.headers.get('set-cookie').split(';')[0];

  const callback = await fetch(
    `${baseUrl}/api/auth/google/callback?${new URLSearchParams({ code: 'google-auth-code', state })}`,
    { headers: { Cookie: cookie }, redirect: 'manual' }
  );
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/events');
  assert.equal(profile.mock.callCount(), 1);
  assert.deepEqual(authenticate.mock.calls[0].arguments, ['member@example.com']);

  const signedInCookie = callback.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await fetch(`${baseUrl}/login`, {
      headers: { Cookie: signedInCookie },
      redirect: 'manual'
    })).headers.get('location'),
    '/events'
  );
});

test('Google callback rejects invalid state and handles provider cancellation', async (t) => {
  const baseUrl = await startServer(t);
  configureGoogleOAuth(t, baseUrl);
  const profile = t.mock.method(googleOAuthService, 'getGoogleProfile', async () => ({
    email: 'member@example.com'
  }));

  const start = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = start.headers.get('set-cookie').split(';')[0];

  const invalidState = await fetch(
    `${baseUrl}/api/auth/google/callback?${new URLSearchParams({ code: 'code', state: 'wrong-state' })}`,
    { headers: { Cookie: cookie }, redirect: 'manual' }
  );
  assert.equal(invalidState.status, 400);
  assert.equal(profile.mock.callCount(), 0);

  const secondStart = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
  const secondState = new URL(secondStart.headers.get('location')).searchParams.get('state');
  const secondCookie = secondStart.headers.get('set-cookie')?.split(';')[0] || cookie;
  const cancelled = await fetch(
    `${baseUrl}/api/auth/google/callback?${new URLSearchParams({ error: 'access_denied', state: secondState })}`,
    { headers: { Cookie: secondCookie }, redirect: 'manual' }
  );
  assert.equal(cancelled.headers.get('location'), '/login?error=Google%20sign-in%20was%20cancelled');
});

test('Google OAuth reports missing configuration and rejects callbacks without a code', async (t) => {
  const baseUrl = await startServer(t);
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  t.after(() => {
    if (previousClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = previousClientId;
    }
  });
  t.mock.method(console, 'error', () => {});

  const unavailable = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
  assert.equal(unavailable.status, 503);

  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const start = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const missingCode = await fetch(
    `${baseUrl}/api/auth/google/callback?state=${encodeURIComponent(state)}`,
    { headers: { Cookie: cookie }, redirect: 'manual' }
  );
  assert.equal(missingCode.headers.get('location'), '/login?error=Google%20sign-in%20failed');
});

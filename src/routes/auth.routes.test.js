const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const authService = require('../services/authService');

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

test('login and registration pages escape messages and redirect signed-in users', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({
    success: true,
    user: { id: 7, email: 'member@example.com', role: 'member' }
  }));

  const loginPage = await fetch(`${baseUrl}/login?error=${encodeURIComponent('<bad & "input">')}`);
  assert.match(await loginPage.text(), /&lt;bad &amp; &quot;input&quot;&gt;/);
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

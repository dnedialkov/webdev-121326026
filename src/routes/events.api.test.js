const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const authService = require('../services/authService');
const eventService = require('../services/eventService');

async function startServer(t) {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://localhost:${server.address().port}`;
}

async function login(baseUrl, authenticate, user) {
  authenticate.mock.mockImplementation(async () => ({ success: true, user }));
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: user.email, password: 'password123' }),
    redirect: 'manual'
  });
  assert.equal(response.status, 302);
  return response.headers.get('set-cookie').split(';')[0];
}

test('AC-12 API updating event capacity lower than registrations returns 400', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({ success: false }));
  const update = t.mock.method(eventService, 'updateExistingEvent', async () => ({
    success: false,
    status: 400,
    error: 'Capacity cannot be less than current registrations'
  }));
  const cookie = await login(baseUrl, authenticate, {
    id: 10,
    email: 'organizer@club.com',
    role: 'organizer'
  });

  const response = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '1' }),
    redirect: 'manual'
  });

  assert.equal(response.status, 400);
  assert.deepEqual(update.mock.calls[0].arguments.slice(0, 2), [10, '1']);
});

test('AC-14 API updating a non-owned event returns 403', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({ success: false }));
  const update = t.mock.method(eventService, 'updateExistingEvent', async () => ({
    success: false,
    status: 403,
    error: 'Forbidden'
  }));
  const cookie = await login(baseUrl, authenticate, {
    id: 10,
    email: 'organizer@club.com',
    role: 'organizer'
  });

  const response = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '10' }),
    redirect: 'manual'
  });

  assert.equal(response.status, 403);
  assert.equal(update.mock.callCount(), 1);
});

test('API updating an event without a session returns 401', async (t) => {
  const baseUrl = await startServer(t);

  const response = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ title: 'Updated', capacity: '10' }),
    redirect: 'manual'
  });

  assert.equal(response.status, 401);
});

test('AC-14 API updating an event as a non-owner returns 403', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({ success: false }));
  const update = t.mock.method(eventService, 'updateExistingEvent', async () => ({
    success: false,
    status: 403,
    error: 'Forbidden'
  }));
  const cookie = await login(baseUrl, authenticate, {
    id: 11,
    email: 'member@club.com',
    role: 'member'
  });

  const response = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '10' }),
    redirect: 'manual'
  });

  assert.equal(response.status, 403);
  assert.equal(update.mock.callCount(), 1);
});

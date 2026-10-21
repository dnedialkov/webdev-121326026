const test = require('node:test');
const assert = require('node:assert');
const app = require('../server');
const eventService = require('../services/eventService');

test('AC-12 API updating event capacity lower than registrations returns 400', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const loginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'organizer@club.com', password: 'password123' }),
    redirect: 'manual'
  });
  const cookie = loginRes.headers.get('set-cookie');

  const originalUpdate = eventService.updateExistingEvent;
  eventService.updateExistingEvent = async () => ({
    success: false,
    status: 400,
    error: 'Capacity cannot be less than current registrations'
  });

  const updateRes = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookie
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '1' })
  });

  server.close();
  eventService.updateExistingEvent = originalUpdate;

  assert.strictEqual(updateRes.status, 400);
});

test('AC-14 API updating non-owned event returns 403', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const loginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'organizer@club.com', password: 'password123' }),
    redirect: 'manual'
  });
  const cookie = loginRes.headers.get('set-cookie');

  const originalUpdate = eventService.updateExistingEvent;
  eventService.updateExistingEvent = async () => ({
    success: false,
    status: 403,
    error: 'Forbidden'
  });

  const updateRes = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookie
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '10' })
  });

  server.close();
  eventService.updateExistingEvent = originalUpdate;

  assert.strictEqual(updateRes.status, 403);
});

test('API updating event without session returns 401', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const updateRes = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '10' })
  });

  server.close();
  assert.strictEqual(updateRes.status, 401);
});

test('AC-14 API updating event as non-owner returns 403', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const loginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'member@club.com', password: 'password123' }),
    redirect: 'manual'
  });
  const cookie = loginRes.headers.get('set-cookie');

  const originalUpdate = eventService.updateExistingEvent;
  eventService.updateExistingEvent = async () => ({
    success: false,
    status: 403,
    error: 'Forbidden'
  });

  const updateRes = await fetch(`${baseUrl}/events/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookie
    },
    body: new URLSearchParams({ title: 'Updated', capacity: '10' })
  });

  server.close();
  eventService.updateExistingEvent = originalUpdate;

  assert.strictEqual(updateRes.status, 403);
});

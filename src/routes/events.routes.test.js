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

async function signIn(baseUrl, authenticate, user) {
  authenticate.mock.mockImplementation(async () => ({ success: true, user }));
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: user.email, password: 'password' }),
    redirect: 'manual'
  });
  assert.equal(response.status, 302);
  return response.headers.get('set-cookie').split(';')[0];
}

async function sendForm(baseUrl, path, cookie, fields) {
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

test('event pages enforce access and render member, organizer, and empty event lists', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({ success: false }));
  const listEvents = t.mock.method(eventService, 'listUpcomingEvents', async () => []);
  t.mock.method(eventService, 'getUserRegistrations', async () => new Set());

  assert.equal((await fetch(`${baseUrl}/events`, { redirect: 'manual' })).headers.get('location'), '/login');
  assert.equal((await fetch(`${baseUrl}/events/new`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/events/1/edit`)).status, 403);

  const member = { id: 7, email: 'member<&>@example.com', role: 'member' };
  const memberCookie = await signIn(baseUrl, authenticate, member);
  assert.equal((await fetch(`${baseUrl}/events/new`, { headers: { Cookie: memberCookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/events/1/edit`, { headers: { Cookie: memberCookie } })).status, 403);

  const events = [
    { id: 1, title: '<registered>', description: 'A & B', date: '2030-01-01', capacity: 2, free_places: 1, organizer_id: 9 },
    { id: 2, title: 'Full', description: '', date: '2030-01-02', capacity: 1, free_places: 0, organizer_id: 8 },
    { id: 3, title: 'Open', description: 'Open event', date: '2030-01-03', capacity: 3, free_places: '2', organizer_id: 8 }
  ];
  listEvents.mock.mockImplementation(async () => events);
  const getRegistrations = eventService.getUserRegistrations;
  getRegistrations.mock.mockImplementation(async () => new Set([1]));
  const memberPage = await fetch(
    `${baseUrl}/events?error=${encodeURIComponent('<bad>')}&success=${encodeURIComponent('Saved & done')}`,
    { headers: { Cookie: memberCookie } }
  );
  const memberHtml = await memberPage.text();
  assert.match(memberHtml, /&lt;registered&gt;/);
  assert.match(memberHtml, /A &amp; B/);
  assert.match(memberHtml, /Cancel registration/);
  assert.match(memberHtml, /Event Full/);
  assert.match(memberHtml, /Sign Up/);
  assert.match(memberHtml, /&lt;bad&gt;/);
  assert.match(memberHtml, /Saved &amp; done/);
  assert.match(memberHtml, /member&lt;&amp;&gt;@example\.com/);

  const organizer = { id: 9, email: 'organizer@example.com', role: 'organizer' };
  const organizerCookie = await signIn(baseUrl, authenticate, organizer);
  const organizerPage = await fetch(`${baseUrl}/events`, { headers: { Cookie: organizerCookie } });
  const organizerHtml = await organizerPage.text();
  assert.match(organizerHtml, /Create New Event/);
  assert.match(organizerHtml, /Edit Event/);
  assert.doesNotMatch(organizerHtml, /Sign Up/);
  assert.equal((await fetch(`${baseUrl}/events/new?error=Bad`, { headers: { Cookie: organizerCookie } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/events/1/edit`, { headers: { Cookie: organizerCookie } })).status, 200);

  listEvents.mock.mockImplementation(async () => []);
  assert.match(await (await fetch(`${baseUrl}/events`, { headers: { Cookie: memberCookie } })).text(), /No upcoming events available/);

  listEvents.mock.mockImplementation(async () => { throw new Error('list failed'); });
  t.mock.method(console, 'error', () => {});
  assert.equal((await fetch(`${baseUrl}/events`, { headers: { Cookie: memberCookie } })).status, 500);
});

test('event API reads and creation handle authorization and service results', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({ success: false }));
  const getEvent = t.mock.method(eventService, 'getEventById', async () => null);
  const createEvent = t.mock.method(eventService, 'createNewEvent', async () => ({
    success: false,
    error: 'Invalid event'
  }));
  const memberCookie = await signIn(baseUrl, authenticate, {
    id: 7, email: 'member@example.com', role: 'member'
  });
  const organizerCookie = await signIn(baseUrl, authenticate, {
    id: 9, email: 'organizer@example.com', role: 'organizer'
  });

  assert.equal((await fetch(`${baseUrl}/api/events/1`)).status, 401);
  const missingEvent = await fetch(`${baseUrl}/api/events/1`, { headers: { Cookie: memberCookie } });
  assert.equal(missingEvent.status, 404);
  getEvent.mock.mockImplementation(async () => ({ id: 1 }));
  assert.deepEqual(await (await fetch(`${baseUrl}/api/events/1`, { headers: { Cookie: memberCookie } })).json(), { id: 1 });
  getEvent.mock.mockImplementation(async () => { throw new Error('read failed'); });
  t.mock.method(console, 'error', () => {});
  assert.equal((await fetch(`${baseUrl}/api/events/1`, { headers: { Cookie: memberCookie } })).status, 500);

  assert.equal((await sendForm(baseUrl, '/events', memberCookie, { title: 'T' })).status, 403);
  const fields = { title: 'New event', description: 'Description', date: '2030-01-01', capacity: '5' };
  const invalidCreate = await sendForm(baseUrl, '/events', organizerCookie, fields);
  assert.equal(invalidCreate.status, 302);
  assert.match(invalidCreate.headers.get('location'), /error=Invalid%20event/);
  createEvent.mock.mockImplementation(async () => ({ success: true, event: { id: 2 } }));
  const created = await sendForm(baseUrl, '/events', organizerCookie, fields);
  assert.match(created.headers.get('location'), /success=Event%20created%20successfully/);
  assert.equal(createEvent.mock.calls.at(-1).arguments[0], 9);
  createEvent.mock.mockImplementation(async () => { throw new Error('create failed'); });
  assert.equal((await sendForm(baseUrl, '/events', organizerCookie, fields)).status, 500);
});

test('event update, signup, cancellation, and deletion handle result branches', async (t) => {
  const baseUrl = await startServer(t);
  const authenticate = t.mock.method(authService, 'authenticateUser', async () => ({ success: false }));
  const updateEvent = t.mock.method(eventService, 'updateExistingEvent', async () => ({
    success: false,
    status: 403,
    error: 'Forbidden'
  }));
  const signup = t.mock.method(eventService, 'signupForEvent', async () => ({ success: false, error: 'Full' }));
  const cancel = t.mock.method(eventService, 'cancelRegistration', async () => ({ success: false, error: 'Not registered' }));
  const remove = t.mock.method(eventService, 'removeEvent', async () => ({ success: false, status: 403, error: 'Forbidden' }));
  const cookie = await signIn(baseUrl, authenticate, {
    id: 7, email: 'organizer@example.com', role: 'organizer'
  });
  t.mock.method(console, 'error', () => {});
  const fields = { title: 'Updated', description: 'Details', date: '2030-01-01', capacity: '4' };

  assert.equal((await sendForm(baseUrl, '/events/1', null, fields)).status, 401);
  assert.equal((await sendForm(baseUrl, '/events/1', cookie, fields)).status, 403);
  updateEvent.mock.mockImplementation(async () => ({ success: false, error: 'Invalid' }));
  assert.equal((await sendForm(baseUrl, '/events/1', cookie, fields)).status, 400);
  updateEvent.mock.mockImplementation(async () => ({ success: true }));
  assert.match((await sendForm(baseUrl, '/events/1', cookie, fields)).headers.get('location'), /Event%20updated%20successfully/);
  updateEvent.mock.mockImplementation(async () => { throw new Error('update failed'); });
  assert.equal((await sendForm(baseUrl, '/events/1', cookie, fields)).status, 500);

  assert.equal((await sendForm(baseUrl, '/events/1/signup', null, {})).headers.get('location'), '/login');
  assert.match((await sendForm(baseUrl, '/events/1/signup', cookie, {})).headers.get('location'), /error=Full/);
  signup.mock.mockImplementation(async () => ({ success: true }));
  assert.match((await sendForm(baseUrl, '/events/1/signup', cookie, {})).headers.get('location'), /Successfully%20signed%20up/);
  signup.mock.mockImplementation(async () => { throw new Error('signup failed'); });
  assert.equal((await sendForm(baseUrl, '/events/1/signup', cookie, {})).status, 500);

  assert.equal((await sendForm(baseUrl, '/events/1/cancel', null, {})).headers.get('location'), '/login');
  assert.match((await sendForm(baseUrl, '/events/1/cancel', cookie, {})).headers.get('location'), /error=Not%20registered/);
  cancel.mock.mockImplementation(async () => ({ success: true }));
  assert.match((await sendForm(baseUrl, '/events/1/cancel', cookie, {})).headers.get('location'), /Registration%20cancelled/);
  cancel.mock.mockImplementation(async () => { throw new Error('cancel failed'); });
  assert.equal((await sendForm(baseUrl, '/events/1/cancel', cookie, {})).status, 500);

  assert.equal((await sendForm(baseUrl, '/events/1/delete', null, {})).headers.get('location'), '/login');
  assert.equal((await sendForm(baseUrl, '/events/1/delete', cookie, {})).status, 403);
  remove.mock.mockImplementation(async () => ({ success: false, error: 'Failed' }));
  assert.equal((await sendForm(baseUrl, '/events/1/delete', cookie, {})).status, 500);
  remove.mock.mockImplementation(async () => ({ success: true }));
  assert.match((await sendForm(baseUrl, '/events/1/delete', cookie, {})).headers.get('location'), /Event%20deleted%20successfully/);
  remove.mock.mockImplementation(async () => { throw new Error('delete failed'); });
  assert.equal((await sendForm(baseUrl, '/events/1/delete', cookie, {})).status, 500);
});

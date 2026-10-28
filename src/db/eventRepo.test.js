const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('./db');
const eventRepo = require('./eventRepo');

test('event repository queries return rows, nulls, and registration sets', async (t) => {
  const events = [{ id: 1 }, { id: 2 }];
  const registration = { event_id: 1 };
  const query = t.mock.method(db, 'query', async () => ({ rows: events }));

  assert.equal(await eventRepo.getAllEvents(), events);
  assert.equal(await eventRepo.getEventById(1), events[0]);
  query.mock.mockImplementation(async () => ({ rows: [] }));
  assert.equal(await eventRepo.getEventById(99), null);
  query.mock.mockImplementation(async () => ({ rows: [registration] }));
  assert.equal(await eventRepo.getUserRegistration(7, 1), registration);
  query.mock.mockImplementation(async () => ({ rows: [] }));
  assert.equal(await eventRepo.getUserRegistration(7, 99), null);
  query.mock.mockImplementation(async () => ({ rows: [{ event_id: 1 }, { event_id: 2 }] }));
  assert.deepEqual(await eventRepo.getUserRegistrations(7), new Set([1, 2]));
  query.mock.mockImplementation(async () => ({ rows: [registration] }));
  assert.equal(await eventRepo.createRegistration(7, 1), registration);
  assert.equal(await eventRepo.deleteRegistration(7, 1), registration);
  query.mock.mockImplementation(async () => ({ rows: [] }));
  assert.equal(await eventRepo.deleteRegistration(7, 1), null);
  assert.equal(query.mock.callCount(), 9);
});

test('event repository creates, updates, and deletes events with empty-result handling', async (t) => {
  const event = { id: 2, title: 'Workshop' };
  const query = t.mock.method(db, 'query', async () => ({ rows: [event] }));

  assert.equal(await eventRepo.createEvent('Workshop', 'Description', '2030-01-01', 5, 9), event);
  assert.equal(await eventRepo.updateEvent(2, 'Updated', 'Description', '2030-01-02', 6), event);
  assert.equal(await eventRepo.deleteEvent(2), event);
  query.mock.mockImplementation(async () => ({ rows: [] }));
  assert.equal(await eventRepo.updateEvent(99, 'Missing', '', '2030-01-02', 1), null);
  assert.equal(await eventRepo.deleteEvent(99), null);
});

test('signup transaction handles missing, duplicate, full, successful, and failed transactions', async (t) => {
  let scenario;
  const clients = [];
  t.mock.method(db.pool, 'connect', async () => {
    const calls = [];
    const client = {
      query: async (sql) => {
        const normalizedSql = sql.trim();
        calls.push(normalizedSql.split(/\s+/).slice(0, 3).join(' '));
        if (normalizedSql === 'BEGIN') return { rows: [] };
        if (normalizedSql.startsWith('SELECT id, capacity FROM events')) {
          if (scenario.fail) throw new Error('query failed');
          return { rows: scenario.event ? [scenario.event] : [] };
        }
        if (normalizedSql.startsWith('SELECT COUNT(*) AS reg_count FROM registrations')) {
          return { rows: [{ reg_count: scenario.event?.reg_count ?? 0 }] };
        }
        if (normalizedSql.startsWith('SELECT * FROM registrations')) {
          return { rows: scenario.registration ? [scenario.registration] : [] };
        }
        if (normalizedSql.startsWith('INSERT INTO registrations')) {
          return { rows: [{ user_id: 7, event_id: 1 }] };
        }
        return { rows: [] };
      },
      release: () => { client.released = true; }
    };
    clients.push({ client, calls });
    return client;
  });

  scenario = { event: null };
  assert.deepEqual(await eventRepo.signupTransaction(7, 1), {
    success: false,
    error: 'Event not found'
  });
  assert.ok(clients.at(-1).calls.includes('ROLLBACK'));
  assert.equal(clients.at(-1).client.released, true);

  scenario = { event: { capacity: 5, reg_count: 2 }, registration: { id: 4 } };
  assert.deepEqual(await eventRepo.signupTransaction(7, 1), {
    success: false,
    error: 'Already registered for this event'
  });
  assert.ok(clients.at(-1).calls.includes('ROLLBACK'));

  scenario = { event: { capacity: 1, reg_count: 1 } };
  assert.deepEqual(await eventRepo.signupTransaction(7, 1), {
    success: false,
    error: 'This event is full'
  });
  assert.ok(clients.at(-1).calls.includes('ROLLBACK'));

  scenario = { event: { capacity: 3, reg_count: 1 } };
  assert.deepEqual(await eventRepo.signupTransaction(7, 1), {
    success: true,
    registration: { user_id: 7, event_id: 1 }
  });
  assert.ok(clients.at(-1).calls.includes('COMMIT'));
  const successfulClient = clients.at(-1);
  assert.deepEqual(successfulClient.calls.slice(0, 3), [
    'BEGIN',
    'SELECT id, capacity',
    'SELECT COUNT(*) AS'
  ]);
  assert.ok(!successfulClient.calls.some((query) => query.includes('GROUP BY')));

  scenario = { fail: true };
  await assert.rejects(eventRepo.signupTransaction(7, 1), /query failed/);
  assert.ok(clients.at(-1).calls.includes('ROLLBACK'));
  assert.equal(clients.at(-1).client.released, true);
});

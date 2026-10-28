const test = require('node:test');
const assert = require('node:assert/strict');
const eventService = require('./eventService');
const eventRepo = require('../db/eventRepo');

test('event query services return repository results', async (t) => {
  const events = [{ id: 1, title: 'Workshop' }];
  const event = events[0];
  const registrations = new Set([1]);
  const signupResult = { success: true };

  t.mock.method(eventRepo, 'getAllEvents', async () => events);
  t.mock.method(eventRepo, 'getEventById', async () => event);
  t.mock.method(eventRepo, 'getUserRegistrations', async () => registrations);
  const signup = t.mock.method(eventRepo, 'signupTransaction', async () => signupResult);

  assert.equal(await eventService.listUpcomingEvents(), events);
  assert.equal(await eventService.getEventById(1), event);
  assert.equal(await eventService.getUserRegistrations(7), registrations);
  assert.equal(await eventService.signupForEvent(7, 1), signupResult);
  assert.deepEqual(signup.mock.calls[0].arguments, [7, 1]);
});

test('AC-3 cancelling a registration reports when absent and deletes it when present', async (t) => {
  let registration = null;
  const getRegistration = t.mock.method(eventRepo, 'getUserRegistration', async () => registration);
  const deleteRegistration = t.mock.method(eventRepo, 'deleteRegistration', async () => ({}));

  assert.deepEqual(await eventService.cancelRegistration(7, 1), {
    success: false,
    error: 'Not registered for this event'
  });

  registration = { user_id: 7, event_id: 1 };
  assert.deepEqual(await eventService.cancelRegistration(7, 1), { success: true });
  assert.equal(getRegistration.mock.callCount(), 2);
  assert.deepEqual(deleteRegistration.mock.calls[0].arguments, [7, 1]);
});

test('AC-2 creating an event validates required fields and forwards valid values', async (t) => {
  const createEvent = t.mock.method(eventRepo, 'createEvent', async () => ({ id: 3 }));

  assert.deepEqual(await eventService.createNewEvent(10, '', 'Desc', '2027-01-01', 5), {
    success: false,
    error: 'Title, date and capacity are required'
  });
  assert.deepEqual(await eventService.createNewEvent(10, 'Title', 'Desc', '', 5), {
    success: false,
    error: 'Title, date and capacity are required'
  });
  assert.deepEqual(await eventService.createNewEvent(10, 'Title', 'Desc', '2027-01-01', 0), {
    success: false,
    error: 'Title, date and capacity are required'
  });
  assert.deepEqual(await eventService.createNewEvent(10, 'Title', 'Desc', '2027-01-01', 5), {
    success: true,
    event: { id: 3 }
  });
  assert.deepEqual(createEvent.mock.calls[0].arguments, [
    'Title',
    'Desc',
    '2027-01-01',
    5,
    10
  ]);
});

test('AC-12, AC-13 and AC-14 updating an event rejects invalid cases and saves valid changes', async (t) => {
  let event = null;
  t.mock.method(eventRepo, 'getEventById', async () => event);
  const updateEvent = t.mock.method(eventRepo, 'updateEvent', async () => ({ id: 1, title: 'Updated' }));
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);

  assert.deepEqual(await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', future, 5), {
    success: false,
    status: 404,
    error: 'Event not found'
  });

  event = {
    id: 1,
    date: future,
    capacity: 5,
    organizer_id: 20
  };
  assert.deepEqual(await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', future, 5), {
    success: false,
    status: 403,
    error: 'Forbidden'
  });

  event.organizer_id = 10;
  assert.deepEqual(await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', past, 5), {
    success: false,
    status: 400,
    error: 'Event date cannot be in the past'
  });

  event.free_places = 3;
  assert.deepEqual(await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', future, 1), {
    success: false,
    status: 400,
    error: 'Capacity cannot be less than current registrations'
  });

  assert.deepEqual(await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', future, 2), {
    success: true,
    event: { id: 1, title: 'Updated' }
  });
  assert.deepEqual(updateEvent.mock.calls[0].arguments, [1, 'Updated', 'Desc', future, 2]);
});

test('AC-7 removing an event rejects missing or unowned events and deletes owned events', async (t) => {
  let event = null;
  t.mock.method(eventRepo, 'getEventById', async () => event);
  const deleteEvent = t.mock.method(eventRepo, 'deleteEvent', async () => ({}));

  assert.deepEqual(await eventService.removeEvent(10, 1), {
    success: false,
    status: 404,
    error: 'Event not found'
  });

  event = { organizer_id: 20 };
  assert.deepEqual(await eventService.removeEvent(10, 1), {
    success: false,
    status: 403,
    error: 'Forbidden'
  });

  event.organizer_id = 10;
  assert.deepEqual(await eventService.removeEvent(10, 1), { success: true });
  assert.deepEqual(deleteEvent.mock.calls[0].arguments, [1]);
});

async function withEnvironment(t, values, run) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
  await run();
}

test('event summary uses deterministic fallback when the API key is absent', async (t) => {
  await withEnvironment(t, { GEMINI_API_KEY: undefined }, async () => {
    assert.deepEqual(await eventService.generateEventSummary('Title', 'Description'), {
      summary: 'Description',
      tags: ['fallback', 'default'],
      source: 'fallback'
    });
    assert.deepEqual(await eventService.generateEventSummary('Title', ''), {
      summary: 'Title',
      tags: ['fallback', 'default'],
      source: 'fallback'
    });
  });
});

test('event summary uses fake model output and falls back on API errors', async (t) => {
  await withEnvironment(t, {
    GEMINI_API_KEY: 'test-key',
    MODEL_NAME: undefined
  }, async () => {
    let requestUrl;
    const fakeClient = async (url) => {
      requestUrl = url;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Model summary' }] } }]
        })
      };
    };
    assert.deepEqual(await eventService.generateEventSummary('Title', 'Description', fakeClient), {
      summary: 'Model summary',
      tags: ['ai', 'polished'],
      source: 'ai'
    });
    assert.match(requestUrl, /gemini-2\.5-flash:generateContent\?key=test-key$/);

    process.env.MODEL_NAME = 'test-model';
    await eventService.generateEventSummary('Title', 'Description', fakeClient);
    assert.match(requestUrl, /test-model:generateContent\?key=test-key$/);
    delete process.env.MODEL_NAME;

    const incompleteResponses = [
      {},
      { candidates: [] },
      { candidates: [{}] },
      { candidates: [{ content: {} }] },
      { candidates: [{ content: { parts: [] } }] },
      { candidates: [{ content: { parts: [{}] } }] }
    ];
    for (const response of incompleteResponses) {
      const fakeEmptyClient = async () => ({
        ok: true,
        json: async () => response
      });
      assert.deepEqual(await eventService.generateEventSummary('Title', 'Description', fakeEmptyClient), {
        summary: 'Description',
        tags: ['ai', 'polished'],
        source: 'ai'
      });
    }

    const failedClient = async () => ({ ok: false, status: 503 });
    assert.deepEqual(await eventService.generateEventSummary('Title', 'Description', failedClient), {
      summary: 'Description',
      tags: ['fallback', 'default', 'heuristic'],
      source: 'fallback'
    });
    assert.deepEqual(await eventService.generateEventSummary('Title', '', failedClient), {
      summary: 'Title',
      tags: ['fallback', 'default', 'heuristic'],
      source: 'fallback'
    });
  });
});

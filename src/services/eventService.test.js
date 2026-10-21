const test = require('node:test');
const assert = require('node:assert');
const eventService = require('./eventService');
const eventRepo = require('../db/eventRepo');

test('AC-12 updating event capacity lower than current registrations is refused with 400', async () => {
  const originalGetEventById = eventRepo.getEventById;
  eventRepo.getEventById = async (id) => ({
    id: 1,
    title: 'Test Event',
    date: new Date(Date.now() + 86400000),
    capacity: 5,
    free_places: 3, // 2 registrations (5 - 3)
    organizer_id: 10
  });

  const result = await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', new Date(Date.now() + 86400000), 1);
  eventRepo.getEventById = originalGetEventById;

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 400);
});

test('AC-13 updating event date to a past date is refused with 400', async () => {
  const originalGetEventById = eventRepo.getEventById;
  eventRepo.getEventById = async (id) => ({
    id: 1,
    title: 'Test Event',
    date: new Date(Date.now() + 86400000),
    capacity: 5,
    free_places: 5,
    organizer_id: 10
  });

  const pastDate = new Date(Date.now() - 86400000);
  const result = await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', pastDate, 5);
  eventRepo.getEventById = originalGetEventById;

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 400);
});

test('AC-14 updating an event not owned by the organizer is refused with 403', async () => {
  const originalGetEventById = eventRepo.getEventById;
  eventRepo.getEventById = async (id) => ({
    id: 1,
    title: 'Test Event',
    date: new Date(Date.now() + 86400000),
    capacity: 5,
    free_places: 5,
    organizer_id: 20
  });

  const result = await eventService.updateExistingEvent(10, 1, 'Updated', 'Desc', new Date(Date.now() + 86400000), 5);
  eventRepo.getEventById = originalGetEventById;

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, 403);
});

const eventRepo = require('../db/eventRepo');

async function listUpcomingEvents() {
  const events = await eventRepo.getAllEvents();
  return events;
}

async function getEventById(eventId) {
  return await eventRepo.getEventById(eventId);
}

async function getUserRegistrations(userId) {
  return await eventRepo.getUserRegistrations(userId);
}

async function signupForEvent(userId, eventId) {
  const event = await eventRepo.getEventById(eventId);
  if (!event) {
    return { success: false, error: 'Event not found' };
  }

  const existingRegistration = await eventRepo.getUserRegistration(userId, eventId);
  if (existingRegistration) {
    return { success: false, error: 'Already registered for this event' };
  }

  if (Number(event.free_places) <= 0) {
    return { success: false, error: 'This event is full' };
  }

  const registration = await eventRepo.createRegistration(userId, eventId);
  return { success: true, registration };
}

async function cancelRegistration(userId, eventId) {
  const existing = await eventRepo.getUserRegistration(userId, eventId);
  if (!existing) {
    return { success: false, error: 'Not registered for this event' };
  }

  await eventRepo.deleteRegistration(userId, eventId);
  return { success: true };
}

async function createNewEvent(organizerId, title, description, date, capacity) {
  if (!title || !date || !capacity) {
    return { success: false, error: 'Title, date and capacity are required' };
  }
  const event = await eventRepo.createEvent(title, description, date, capacity, organizerId);
  return { success: true, event };
}

async function updateExistingEvent(userId, eventId, title, description, date, capacity) {
  const event = await eventRepo.getEventById(eventId);
  if (!event) {
    return { success: false, status: 404, error: 'Event not found' };
  }
  if (event.organizer_id !== userId) {
    return { success: false, status: 403, error: 'Forbidden' };
  }
  if (new Date(date) < new Date()) {
    return { success: false, status: 400, error: 'Event date cannot be in the past' };
  }
  const currentRegistrationsCount = Number(event.capacity) - Number(event.free_places);
  if (capacity < currentRegistrationsCount) {
    return { success: false, status: 400, error: 'Capacity cannot be less than current registrations' };
  }
  const updated = await eventRepo.updateEvent(eventId, title, description, date, capacity);
  return { success: true, event: updated };
}

async function removeEvent(userId, eventId) {
  const event = await eventRepo.getEventById(eventId);
  if (!event) {
    return { success: false, status: 404, error: 'Event not found' };
  }
  if (event.organizer_id !== userId) {
    return { success: false, status: 403, error: 'Forbidden' };
  }
  await eventRepo.deleteEvent(eventId);
  return { success: true };
}

module.exports = {
  listUpcomingEvents,
  getEventById,
  getUserRegistrations,
  signupForEvent,
  cancelRegistration,
  createNewEvent,
  updateExistingEvent,
  removeEvent
};

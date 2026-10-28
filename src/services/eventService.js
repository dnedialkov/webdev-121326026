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
  return await eventRepo.signupTransaction(userId, eventId);
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

async function generateEventSummary(title, description, httpClient = fetch) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.MODEL_NAME || 'gemini-2.5-flash';

  if (!apiKey) {
    return { summary: description || title, tags: ['fallback', 'default'], source: 'fallback' };
  }

  try {
    const res = await httpClient(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Summarize and tag this event: ${title} - ${description}` }] }]
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || description;
    return { summary: text, tags: ['ai', 'polished'], source: 'ai' };
  } catch (err) {
    // AI service temporarily unavailable fallback heuristic default
    return { summary: description || title, tags: ['fallback', 'default', 'heuristic'], source: 'fallback' };
  }
}

module.exports = {
  listUpcomingEvents,
  getEventById,
  getUserRegistrations,
  signupForEvent,
  cancelRegistration,
  createNewEvent,
  updateExistingEvent,
  removeEvent,
  generateEventSummary
};

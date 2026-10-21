const db = require('./db');

async function getAllEvents() {
  const query = `
    SELECT e.id, e.title, e.description, e.date, e.capacity, e.organizer_id,
           e.capacity - COUNT(r.id) AS free_places
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    GROUP BY e.id
    ORDER BY e.date ASC
  `;
  const result = await db.query(query);
  return result.rows;
}

async function getEventById(id) {
  const query = `
    SELECT e.id, e.title, e.description, e.date, e.capacity, e.organizer_id,
           e.capacity - COUNT(r.id) AS free_places
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    WHERE e.id = $1
    GROUP BY e.id
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
}

async function getUserRegistration(userId, eventId) {
  const result = await db.query(
    'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
    [userId, eventId]
  );
  return result.rows[0] || null;
}

async function getUserRegistrations(userId) {
  const result = await db.query('SELECT event_id FROM registrations WHERE user_id = $1', [userId]);
  return new Set(result.rows.map(r => r.event_id));
}

async function createRegistration(userId, eventId) {
  const result = await db.query(
    'INSERT INTO registrations (user_id, event_id) VALUES ($1, $2) RETURNING *',
    [userId, eventId]
  );
  return result.rows[0];
}

async function deleteRegistration(userId, eventId) {
  const result = await db.query(
    'DELETE FROM registrations WHERE user_id = $1 AND event_id = $2 RETURNING *',
    [userId, eventId]
  );
  return result.rows[0] || null;
}

async function createEvent(title, description, date, capacity, organizerId) {
  const result = await db.query(
    'INSERT INTO events (title, description, date, capacity, organizer_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, description, date, capacity, organizerId]
  );
  return result.rows[0];
}

async function updateEvent(eventId, title, description, date, capacity) {
  const result = await db.query(
    'UPDATE events SET title = $1, description = $2, date = $3, capacity = $4 WHERE id = $5 RETURNING *',
    [title, description, date, capacity, eventId]
  );
  return result.rows[0] || null;
}

async function deleteEvent(eventId) {
  const result = await db.query('DELETE FROM events WHERE id = $1 RETURNING *', [eventId]);
  return result.rows[0] || null;
}

module.exports = {
  getAllEvents,
  getEventById,
  getUserRegistration,
  getUserRegistrations,
  createRegistration,
  deleteRegistration,
  createEvent,
  updateEvent,
  deleteEvent
};

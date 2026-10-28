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

async function signupTransaction(userId, eventId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const eventResult = await client.query(`
      SELECT e.id, e.capacity, COUNT(r.id) AS reg_count
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.id = $1
      GROUP BY e.id
      FOR UPDATE
    `, [eventId]);

    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult.rows[0];
    const freePlaces = Number(event.capacity) - Number(event.reg_count);

    const regResult = await client.query(
      'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
      [userId, eventId]
    );
    if (regResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Already registered for this event' };
    }

    if (freePlaces <= 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'This event is full' };
    }

    const insertResult = await client.query(
      'INSERT INTO registrations (user_id, event_id) VALUES ($1, $2) RETURNING *',
      [userId, eventId]
    );

    await client.query('COMMIT');
    return { success: true, registration: insertResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
  signupTransaction,
  deleteRegistration,
  createEvent,
  updateEvent,
  deleteEvent
};

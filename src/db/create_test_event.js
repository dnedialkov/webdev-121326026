const db = require('./db');

async function createTestEvent() {
  const result = await db.query(
    `INSERT INTO events (title, description, date, capacity, organizer_id) 
     VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '5 days', $3, $4) RETURNING *`,
    ['Neon Test Workshop - Created by Agent', 'A test event created to verify database persistence in Neon.', 30, 1]
  );
  console.log('Created new event record:', result.rows[0]);
  process.exit(0);
}

createTestEvent().catch(err => {
  console.error(err);
  process.exit(1);
});

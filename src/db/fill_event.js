const db = require('./db');

async function fillEvent() {
  // Set capacity of event ID 3 to 0 or equal to registrations
  await db.query('UPDATE events SET capacity = 0 WHERE id = 3');
  console.log('Event 3 capacity set to 0 (fully booked for testing AC-1 and AC-8).');
  process.exit(0);
}

fillEvent().catch(err => {
  console.error(err);
  process.exit(1);
});

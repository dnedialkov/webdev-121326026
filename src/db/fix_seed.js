const bcrypt = require('bcrypt');
const db = require('./db');

async function fixSeed() {
  const hash = await bcrypt.hash('password123', 10);
  await db.query('UPDATE users SET password_hash = $1 WHERE email IN ($2, $3)', [
    hash,
    'organizer@club.com',
    'member@club.com'
  ]);
  console.log('Seed passwords updated with correct bcrypt hash for password123');
  process.exit(0);
}

fixSeed().catch(err => {
  console.error(err);
  process.exit(1);
});

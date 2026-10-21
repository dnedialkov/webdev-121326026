const db = require('./db');

async function findByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query('SELECT id, email, role FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createUser(email, passwordHash, role = 'member') {
  const result = await db.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
    [email, passwordHash, role]
  );
  return result.rows[0];
}

module.exports = {
  findByEmail,
  findById,
  createUser
};

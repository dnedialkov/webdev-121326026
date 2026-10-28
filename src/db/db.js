const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres:///webdev_db?host=/var/run/postgresql'
});

pool.on('error', (err) => console.error('database:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

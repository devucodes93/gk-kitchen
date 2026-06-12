const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Database connection error:', err.stack);
  }
  console.log('🚀 PostgreSQL Connected...');
  release();
});

module.exports = pool;
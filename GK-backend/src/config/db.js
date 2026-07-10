const { Pool } = require("pg");
require("dotenv").config();

const poolerHost = process.env.DB_POOLER_HOST || process.env.DB_HOST;
const poolerPort = Number(process.env.DB_POOLER_PORT || process.env.DB_PORT || 5432);

const pool = new Pool({
  user: process.env.DB_USER,
  host: poolerHost,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: poolerPort,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 20000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error("❌ Database connection error:", err.stack);
  }
  console.log("🚀 PostgreSQL Connected...");
  release();
});

module.exports = pool;

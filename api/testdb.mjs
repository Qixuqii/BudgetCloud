import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load local .env if present
dotenv.config();

async function main() {
  try {
    const ssl = (() => {
      const p = process.env.DB_SSL_CA_PATH;
      if (!p) return undefined;
      try { return { ca: fs.readFileSync(p, 'utf8') }; } catch { return undefined; }
    })();

    const pool = await mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
      queueLimit: 0,
      ssl
    });

    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM users');
    console.log('DB OK. users rows =', rows[0].n);
    process.exit(0);
  } catch (e) {
    console.error('DB ERROR:', e);
    process.exit(1);
  }
}
main();

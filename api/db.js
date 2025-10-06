import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Load environment from nearest .env if present; avoid hard-coded paths.
// If process.env is already populated (via "import 'dotenv/config'" in index.js),
// this is a no-op.
dotenv.config();

const sslConfig = (() => {
  const p = process.env.DB_SSL_CA_PATH;
  if (!p) return undefined;
  try { return { ca: fs.readFileSync(p, "utf8") }; } catch { return undefined; }
})();

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,
  ssl: sslConfig,
};

console.log("DB config:", { ...dbConfig, password: "***" }); // eslint-disable-line no-console

export const db = await mysql.createPool(dbConfig);



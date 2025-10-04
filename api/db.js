import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/apps/Budget/server/.env" });

export const db = await mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,
  ssl: { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8") }
});



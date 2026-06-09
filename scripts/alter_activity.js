import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  if (!process.env.MYSQL_HOST) {
    console.error("MYSQL_HOST is not set");
    process.exit(1);
  }
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });
  try {
    console.log("Connected. Altering table...");
    await pool.query('ALTER TABLE topic_activity_materials ADD COLUMN activity_url VARCHAR(1024) NULL');
    console.log("Successfully added activity_url column.");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column activity_url already exists.");
    } else {
      console.error("Error altering table:", err.message);
    }
  } finally {
    await pool.end();
  }
}

run();

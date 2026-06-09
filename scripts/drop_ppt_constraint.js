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
    console.log("Connected. Creating standalone index on topic_id...");
    try {
      await pool.query('CREATE INDEX idx_tpm_topic_id ON topic_ppt_materials(topic_id)');
    } catch (idxErr) {
      if (idxErr.code !== 'ER_DUP_KEYNAME') {
        throw idxErr;
      }
    }
    console.log("Dropping index uq_active_topic_ppt...");
    await pool.query('ALTER TABLE topic_ppt_materials DROP INDEX uq_active_topic_ppt');
    console.log("Successfully dropped index.");
  } catch (err) {
    console.error("Error altering table:", err.message);
  } finally {
    await pool.end();
  }
}

run();

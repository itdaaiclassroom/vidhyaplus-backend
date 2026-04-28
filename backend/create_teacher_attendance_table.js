import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS teacher_attendance (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT UNSIGNED NOT NULL,
        school_id INT UNSIGNED NOT NULL,
        date DATE NOT NULL,
        status ENUM('present', 'absent', 'leave') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_attendance (teacher_id, date)
      );
    `;
    await db.query(createTableQuery);
    console.log("Successfully created teacher_attendance table.");
  } catch (e) {
    console.error("Failed to create table:", e);
  } finally {
    process.exit(0);
  }
}
run();

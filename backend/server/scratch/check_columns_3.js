import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  const tables = ['teacher_activity_logs', 'student_usage_logs', 'leave_applications'];
  for (const table of tables) {
    try {
      const [cols] = await db.query(`SHOW COLUMNS FROM ${table}`);
      console.log(`Table: ${table}`);
      console.log(cols.map(c => c.Field).join(', '));
    } catch (e) {
      console.error(`Error checking ${table}:`, e.message);
    }
  }
  process.exit(0);
}
check();

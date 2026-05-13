import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  const tables = ['attendance', 'student_marks', 'student_qr_codes', 'live_quiz_answers', 'teacher_attendance'];
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

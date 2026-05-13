import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [cols] = await db.query(`SHOW COLUMNS FROM teacher_attendance`);
    console.log(`Table: teacher_attendance`);
    console.log(cols.map(c => c.Field).join(', '));
  } catch (e) {
    console.error(`Error checking teacher_attendance:`, e.message);
  }
  process.exit(0);
}
check();

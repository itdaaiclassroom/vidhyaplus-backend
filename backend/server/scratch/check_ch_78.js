import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT id, chapter_name, subject_id, grade_id FROM chapters WHERE id = 78`);
    console.log(`Chapter 78:`);
    console.table(rows);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
check();

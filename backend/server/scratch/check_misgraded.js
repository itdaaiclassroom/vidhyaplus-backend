import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT id, teacher_id, chapter_id, score, percentage, passed FROM teacher_chapter_assessments WHERE percentage >= 20 AND passed = 0`);
    console.log(`Failed attempts that should have passed (percentage >= 20):`);
    console.table(rows);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
check();

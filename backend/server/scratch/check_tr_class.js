import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT id, teacher_id, class_id, chapter_id, percentage, passed FROM teacher_chapter_assessments WHERE teacher_id = 171 AND chapter_id = 78`);
    console.log(`Teacher 171 Assessments for Ch 78:`);
    console.table(rows);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
check();

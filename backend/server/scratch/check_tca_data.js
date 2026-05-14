import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT * FROM teacher_chapter_assessments LIMIT 10`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(`Error checking teacher_chapter_assessments:`, e.message);
  }
  process.exit(0);
}
check();

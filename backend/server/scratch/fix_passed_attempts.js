import "dotenv/config";
import getPool from "../config/db.js";

async function run() {
  const db = getPool();
  try {
    const [res] = await db.query(`UPDATE teacher_chapter_assessments SET passed = 1 WHERE percentage >= 20`);
    console.log(`Updated ${res.affectedRows} attempts to PASSED (percentage >= 20)`);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
run();

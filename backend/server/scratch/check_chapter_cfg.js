import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT * FROM chapter_assessment_config`);
    console.log(`Table: chapter_assessment_config`);
    console.table(rows);
  } catch (e) {
    console.error(`Error checking chapter_assessment_config:`, e.message);
  }
  process.exit(0);
}
check();

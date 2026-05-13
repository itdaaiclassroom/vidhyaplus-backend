import "dotenv/config";
import getPool from "../config/db.js";

async function run() {
  const db = getPool();
  try {
    const [res] = await db.query(`UPDATE chapter_assessment_config SET passing_marks = 20 WHERE passing_marks = 70`);
    console.log(`Updated ${res.affectedRows} rows in chapter_assessment_config`);
    
    const [res2] = await db.query(`UPDATE gating_config SET config_value = '20' WHERE config_key = 'assessment_passing_marks'`);
    console.log(`Updated gating_config assessment_passing_marks to 20`);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
run();

import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [cols] = await db.query(`SHOW COLUMNS FROM topic_recommendations`);
    console.log(`Table: topic_recommendations`);
    console.log(cols.map(c => c.Field).join(', '));
  } catch (e) {
    console.error(`Error checking topic_recommendations:`, e.message);
  }
  process.exit(0);
}
check();

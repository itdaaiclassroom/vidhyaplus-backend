import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT * FROM gating_config`);
    console.log(`Table: gating_config`);
    console.table(rows);
  } catch (e) {
    console.error(`Error checking gating_config:`, e.message);
  }
  process.exit(0);
}
check();

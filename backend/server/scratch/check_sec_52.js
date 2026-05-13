import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT * FROM sections WHERE id = 52`);
    console.log(`Section 52:`);
    console.table(rows);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
check();

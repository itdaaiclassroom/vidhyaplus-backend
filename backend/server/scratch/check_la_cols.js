import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [cols] = await db.query(`SHOW COLUMNS FROM leave_applications`);
    console.log(`Table: leave_applications`);
    console.log(cols.map(c => c.Field).join(', '));
  } catch (e) {
    console.error(`Error checking leave_applications:`, e.message);
  }
  process.exit(0);
}
check();

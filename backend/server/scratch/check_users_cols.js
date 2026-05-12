import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [cols] = await db.query(`SHOW COLUMNS FROM users`);
    console.log(`Table: users`);
    console.log(cols.map(c => c.Field).join(', '));
  } catch (e) {
    console.error(`Error checking users:`, e.message);
  }
  process.exit(0);
}
check();

import "dotenv/config";
import getPool from "../config/db.js";

async function check() {
  const db = getPool();
  try {
    const [rows] = await db.query(`SELECT id, email, assigned_section_ids, assigned_class_ids FROM teachers WHERE id = 171`);
    console.log(`Teacher 171:`);
    console.table(rows);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
  process.exit(0);
}
check();

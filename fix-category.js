import getPool from "./backend/server/config/db.js";

const sql = "ALTER TABLE students ADD COLUMN category VARCHAR(50) NULL AFTER roll_no";

async function fixCategory() {
  const db = getPool();
  try {
    await db.query(sql);
    console.log("Success: Added category column");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column category already exists.");
    } else {
      console.error("Error:", err.message);
    }
  } finally {
    process.exit(0);
  }
}

fixCategory();

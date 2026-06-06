import getPool from "./backend/server/config/db.js";

async function test() {
  const db = getPool();
  try {
    const [rows] = await db.query("DESCRIBE students");
    console.log("Students Schema:");
    console.table(rows);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

test();

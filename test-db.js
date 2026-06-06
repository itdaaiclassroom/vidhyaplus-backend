import getPool from "./backend/server/config/db.js";

async function test() {
  const db = getPool();
  try {
    const [result] = await db.query(
      "INSERT INTO teachers (school_id, full_name, email, password, role) VALUES (?, ?, ?, ?, 'teacher')",
      [1, 'Test Teacher', 'test@example.com', '123']
    );
    console.log("Teacher inserted:", result.insertId);
    
    // Clean up
    await db.query("DELETE FROM teachers WHERE id = ?", [result.insertId]);
    console.log("Cleanup done.");
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

test();

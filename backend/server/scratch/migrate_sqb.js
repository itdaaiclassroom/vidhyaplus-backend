import "dotenv/config";
import getPool from "../config/db.js";

async function migrate() {
  const db = getPool();
  try {
    console.log("Adding assigned_for to subject_quiz_bank...");
    await db.query("ALTER TABLE subject_quiz_bank ADD COLUMN assigned_for VARCHAR(50) DEFAULT 'both' AFTER explanation");
    console.log("Done!");
  } catch (e) {
    if (e.message.includes("Duplicate column name")) {
      console.log("Column assigned_for already exists.");
    } else {
      console.error("Migration failed:", e.message);
    }
  }
  process.exit(0);
}
migrate();

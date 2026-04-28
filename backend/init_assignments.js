import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS teacher_assignments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT UNSIGNED NOT NULL,
        subject_id INT UNSIGNED NOT NULL,
        section_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_assignment (teacher_id, subject_id, section_id)
      );
    `;
    await db.query(createTableQuery);
    console.log("✅ Successfully created teacher_assignments table.");

    // Also check if we have any teachers and subjects
    const [teachers] = await db.query("SELECT id, full_name, email, password FROM teachers LIMIT 5");
    const [subjects] = await db.query("SELECT id, subject_name FROM subjects LIMIT 5");
    const [sections] = await db.query("SELECT id, section_code, grade_id FROM sections LIMIT 5");

    console.log("\n--- Data for Testing ---");
    console.log("Teachers:", teachers);
    console.log("Subjects:", subjects);
    console.log("Sections:", sections);

  } catch (e) {
    console.error("❌ Error:", e);
  } finally {
    process.exit(0);
  }
}
run();

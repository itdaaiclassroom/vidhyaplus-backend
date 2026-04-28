import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    // Teacher: Ravi Kumar (ID: 1)
    // Subject: Biology (ID: 6)
    // Section: A (ID: 1)
    
    console.log("🔗 Assigning Biology to Ravi Kumar for Section A...");
    
    await db.query(
      "INSERT INTO teacher_assignments (teacher_id, subject_id, section_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id=id",
      [1, 6, 1]
    );

    console.log("✅ Assignment successful!");
    console.log("\n--- Login Credentials for Testing ---");
    console.log("Email: ravi.telugu@zphs.edu");
    console.log("Password: teach123");
    console.log("URL: http://localhost:8080/ (or your frontend URL)");

  } catch (e) {
    console.error("❌ Error:", e);
  } finally {
    process.exit(0);
  }
}
run();

import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    const [teacher_subjects] = await db.query("DESCRIBE teacher_subjects");
    console.log("\nteacher_subjects table:");
    console.log(teacher_subjects);

    const [teacher_assignments] = await db.query("DESCRIBE teacher_assignments");
    console.log("\nteacher_assignments table:");
    console.log(teacher_assignments);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();

import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    const [tables] = await db.query("SHOW TABLES");
    console.log("Tables:");
    console.log(tables);

    const [attendance] = await db.query("DESCRIBE attendance");
    console.log("\nattendance table:");
    console.log(attendance);

    try {
      const [teacher_attendance] = await db.query("DESCRIBE teacher_attendance");
      console.log("\nteacher_attendance table:");
      console.log(teacher_attendance);
    } catch (e) {
      console.log("No teacher_attendance table");
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();

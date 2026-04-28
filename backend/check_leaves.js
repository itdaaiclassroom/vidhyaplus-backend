import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    const [teacher_leaves] = await db.query("DESCRIBE teacher_leaves");
    console.log("\nteacher_leaves table:");
    console.log(teacher_leaves);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();

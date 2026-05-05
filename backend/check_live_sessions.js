import "dotenv/config";
import getPool from "./server/config/db.js";

async function run() {
  const db = getPool();
  try {
    const [cols] = await db.query("DESCRIBE live_sessions");
    console.log("live_sessions table:");
    console.log(JSON.stringify(cols, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();

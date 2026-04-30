import getPool from "./config/db.js";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve("../../.env") });

async function run() {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT id, full_name, school_id, role FROM teachers WHERE full_name LIKE '%Rathod Venkatesh%'");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();

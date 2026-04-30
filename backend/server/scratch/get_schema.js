import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve("../../.env") });

import getPool from "../config/db.js";

async function run() {
  const db = getPool();
  try {
    const [rows] = await db.query("SHOW CREATE TABLE grades");
    console.log(rows[0]["Create Table"]);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();

import "dotenv/config";
import mysql from "mysql2/promise";

async function verify() {
  const db = await mysql.createConnection({
    host: "shinkansen.proxy.rlwy.net",
    port: 53040,
    user: "root",
    password: "FxubTzEogjJKnNItWKKJqZMElZSpArbx",
    database: "railway"
  });

  try {
    const [rows] = await db.query("SHOW TABLES LIKE 'class_timetables'");
    if (rows.length > 0) {
      console.log("TABLE_EXISTS: class_timetables exists!");
      const [count] = await db.query("SELECT COUNT(*) as count FROM class_timetables");
      console.log(`ROW_COUNT: ${count[0].count}`);
    } else {
      console.log("TABLE_MISSING: class_timetables still missing.");
    }
  } finally {
    await db.end();
  }
}

verify().catch(console.error);

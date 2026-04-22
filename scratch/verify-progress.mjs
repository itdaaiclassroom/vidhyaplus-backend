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
    const [att] = await db.query("SELECT COUNT(*) as count FROM attendance");
    console.log(`ATTENDANCE_ROWS: ${att[0].count}`);
    const [marks] = await db.query("SELECT COUNT(*) as count FROM student_marks");
    console.log(`MARKS_ROWS: ${marks[0].count}`);
  } finally {
    await db.end();
  }
}

verify().catch(console.error);

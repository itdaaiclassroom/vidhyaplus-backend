import "dotenv/config";
import mysql from "mysql2/promise";

async function run() {
  const db = await mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
  });

  await db.query(
    `UPDATE class_timetables ct
     JOIN sections sec ON sec.id = ct.class_id
     JOIN subjects s ON LOWER(s.subject_name) = LOWER(ct.subject_name)
     LEFT JOIN teachers t ON t.school_id = sec.school_id AND t.subject_id = s.id
     SET ct.subject_id = s.id, ct.teacher_id = t.id
     WHERE sec.grade_id = 10`
  );

  const [rows] = await db.query(
    `SELECT ct.subject_name, ct.subject_id, ct.teacher_id, t.full_name
     FROM class_timetables ct
     LEFT JOIN teachers t ON t.id = ct.teacher_id
     WHERE LOWER(ct.subject_name) = 'games'
     LIMIT 10`
  );

  console.log(rows);
  await db.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

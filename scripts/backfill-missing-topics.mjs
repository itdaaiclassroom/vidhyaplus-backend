import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
  });

  try {
    const [chapters] = await db.query(
      `SELECT c.id, c.chapter_name
       FROM chapters c
       LEFT JOIN topics t ON t.chapter_id = c.id
       WHERE c.grade_id = 10
       GROUP BY c.id, c.chapter_name
       HAVING COUNT(t.id) = 0`
    );

    let inserted = 0;
    for (const ch of chapters) {
      await db.query(
        `INSERT INTO topics (chapter_id, name, order_num, status)
         VALUES (?, ?, 1, 'completed')`,
        [Number(ch.id), `${String(ch.chapter_name || "Chapter").trim()} - Topic 1`]
      );
      inserted += 1;
    }

    const [socialCheck] = await db.query(
      `SELECT c.chapter_no, c.chapter_name, COUNT(t.id) AS topic_count
       FROM chapters c
       LEFT JOIN topics t ON t.chapter_id = c.id
       WHERE c.grade_id = 10 AND c.subject_id = 7
       GROUP BY c.id, c.chapter_no, c.chapter_name
       ORDER BY c.chapter_no`
    );

    console.log(`Inserted topics for ${inserted} grade-10 chapters that had none.`);
    console.log(socialCheck.slice(-6));
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

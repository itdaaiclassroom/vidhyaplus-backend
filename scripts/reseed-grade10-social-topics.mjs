import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "grade10-social-micro.json");

/**
 * Replaces Social Studies (subject_id=7) grade-10 topics + micro-lessons using the same
 * canonical blocks as `scripts/generate_grade10_curriculum_sql.py` → `social_micro()`.
 */
async function main() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const blocks = JSON.parse(raw);
  if (!Array.isArray(blocks) || blocks.length !== 21) {
    throw new Error(`Expected 21 social chapter blocks, got ${blocks?.length}`);
  }

  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
  });

  try {
    await db.beginTransaction();

    const [chapters] = await db.query(
      `SELECT id, chapter_no, chapter_name
       FROM chapters
       WHERE subject_id = 7 AND grade_id = 10
       ORDER BY chapter_no ASC`
    );

    if (chapters.length !== 21) {
      throw new Error(`Expected 21 Social chapters in DB, found ${chapters.length}`);
    }

    let topicRows = 0;
    for (let i = 0; i < 21; i += 1) {
      const ch = chapters[i];
      const periodList = blocks[i];
      const chapterId = Number(ch.id);

      await db.query("DELETE FROM topics WHERE chapter_id = ?", [chapterId]);

      for (let ord = 0; ord < periodList.length; ord += 1) {
        const [concept, plan] = periodList[ord];
        const [ins] = await db.query(
          `INSERT INTO topics (chapter_id, name, order_num, status)
           VALUES (?, ?, ?, 'completed')`,
          [chapterId, String(concept), ord + 1]
        );
        const topicId = ins.insertId;
        await db.query(
          `INSERT INTO topic_micro_lessons (topic_id, period_no, concept_text, plan_text)
           VALUES (?, ?, ?, ?)`,
          [topicId, ord + 1, String(concept), String(plan)]
        );
        topicRows += 1;
      }
    }

    await db.commit();
    console.log(`Reseeded Social Studies: 21 chapters, ${topicRows} topic rows (+ micro lessons).`);
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import mysql from "mysql2/promise";

const englishCurriculum = [
  {
    chapterNo: 1,
    chapterName: "Personality Development",
    topics: [
      "Attitude is Altitude",
      "Every Success Story is also a Story of Great Failures",
      "I Will Do It"
    ]
  },
  {
    chapterNo: 2,
    chapterName: "Wit and Humour",
    topics: [
      "The Dear Departed (Part I)",
      "The Dear Departed (Part II)",
      "The Brave Potter"
    ]
  },
  {
    chapterNo: 3,
    chapterName: "Human Relations",
    topics: [
      "The Journey",
      "Another Woman",
      "The Never-Never Nest"
    ]
  },
  {
    chapterNo: 4,
    chapterName: "Films and Theatre",
    topics: [
      "Rendezvous with Ray",
      "Maya Bazaar",
      "A Tribute"
    ]
  }
];

async function main() {
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
  });

  try {
    console.log("Connected to database. Starting seeding for Grade 10 English...");
    await db.beginTransaction();

    // 1. Find or create 'English' subject
    let [subjects] = await db.query("SELECT id FROM subjects WHERE subject_name LIKE '%English%' LIMIT 1");
    let subjectId;

    if (subjects.length > 0) {
      subjectId = subjects[0].id;
      console.log(`Found English subject with ID: ${subjectId}`);
    } else {
      console.log("English subject not found, creating it...");
      const [insSubject] = await db.query(
        "INSERT INTO subjects (subject_name, subject_code) VALUES ('English', 'ENG')"
      );
      subjectId = insSubject.insertId;
      console.log(`Created English subject with ID: ${subjectId}`);
    }

    const gradeId = 10;

    // 2. Insert Chapters and Topics
    let chapterRows = 0;
    let topicRows = 0;

    // First clear old ones to prevent duplicates if run multiple times
    const [existingChapters] = await db.query("SELECT id FROM chapters WHERE subject_id = ? AND grade_id = ?", [subjectId, gradeId]);
    if (existingChapters.length > 0) {
      const chapterIds = existingChapters.map(c => c.id);
      await db.query(`DELETE FROM topics WHERE chapter_id IN (?)`, [chapterIds]);
      await db.query(`DELETE FROM chapters WHERE subject_id = ? AND grade_id = ?`, [subjectId, gradeId]);
      console.log(`Cleared existing chapters and topics for English 10th Class.`);
    }

    for (const chapter of englishCurriculum) {
      // Insert Chapter
      const [insChapter] = await db.query(
        `INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, planned_periods) 
         VALUES (?, ?, ?, ?, ?)`,
        [subjectId, gradeId, chapter.chapterNo, chapter.chapterName, chapter.topics.length * 2]
      );
      const chapterId = insChapter.insertId;
      chapterRows++;

      // Insert Topics
      for (let i = 0; i < chapter.topics.length; i++) {
        await db.query(
          `INSERT INTO topics (chapter_id, name, order_num, status) 
           VALUES (?, ?, ?, 'not_started')`,
          [chapterId, chapter.topics[i], i + 1]
        );
        topicRows++;
      }
    }

    await db.commit();
    console.log(`Successfully seeded! Inserted ${chapterRows} Chapters and ${topicRows} Topics for 10th Class English.`);
    
  } catch (e) {
    await db.rollback();
    console.error("Error during seeding:", e);
  } finally {
    await db.end();
  }
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

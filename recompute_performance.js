import getPool from "./backend/server/config/db.js";

async function recomputeAll() {
  const db = getPool();
  try {
    console.log("Starting recomputation of student performance...");

    // Get the student threshold percentage from config
    const [configRows] = await db.query(
      "SELECT config_value FROM gating_config WHERE config_key = 'student_threshold_percentage' LIMIT 1"
    );
    const studentThresholdPct = parseFloat(configRows[0]?.config_value || "60");
    console.log(`Using student threshold: ${studentThresholdPct}%`);

    // Find all distinct class + chapter + subject combinations
    const [combinations] = await db.query(
      `SELECT DISTINCT st.section_id as class_id, sm.chapter_id, ch.subject_id
       FROM student_marks sm
       JOIN students st ON st.id = sm.student_id
       JOIN chapters ch ON ch.id = sm.chapter_id
       WHERE sm.total > 0`
    );

    console.log(`Found ${combinations.length} combinations to recompute.`);

    for (const combo of combinations) {
      const { class_id, chapter_id, subject_id } = combo;

      const [rows] = await db.query(
        `SELECT 
           COUNT(*) as total_students,
           AVG(student_avg) as avg_score,
           SUM(CASE WHEN student_avg >= ? THEN 1 ELSE 0 END) as students_passed
         FROM (
           SELECT 
             sm.student_id,
             AVG((sm.score / NULLIF(sm.total, 0)) * 100) as student_avg
           FROM student_marks sm
           JOIN students st ON st.id = sm.student_id
           WHERE sm.chapter_id = ? AND st.section_id = ? AND sm.total > 0
           GROUP BY sm.student_id
         ) AS student_summaries`,
        [studentThresholdPct, chapter_id, class_id]
      );

      const data = rows[0] || {};
      const totalStudents = data.total_students || 0;
      const avgScore = parseFloat(data.avg_score) || 0;
      const studentsPassed = parseInt(data.students_passed) || 0;
      const passPercentage = totalStudents > 0 ? Math.round((studentsPassed / totalStudents) * 100 * 100) / 100 : 0;
      const thresholdMet = avgScore >= studentThresholdPct;

      await db.query(
        `INSERT INTO class_chapter_performance
           (class_id, chapter_id, subject_id, avg_score, pass_percentage, total_students, students_passed, threshold_met)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           avg_score = VALUES(avg_score),
           pass_percentage = VALUES(pass_percentage),
           total_students = VALUES(total_students),
           students_passed = VALUES(students_passed),
           threshold_met = VALUES(threshold_met),
           computed_at = CURRENT_TIMESTAMP`,
        [class_id, chapter_id, subject_id, avgScore, passPercentage, totalStudents, studentsPassed, thresholdMet ? 1 : 0]
      );

      console.log(`Updated Class ${class_id}, Chapter ${chapter_id}: Avg ${avgScore.toFixed(1)}%, Passed ${studentsPassed}/${totalStudents}`);
    }

    console.log("Recomputation complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error during recomputation:", err);
    process.exit(1);
  }
}

recomputeAll();

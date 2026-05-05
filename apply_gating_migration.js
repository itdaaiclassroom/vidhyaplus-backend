import getPool from "./backend/server/config/db.js";

async function applyGatingMigration() {
  const db = getPool();
  try {
    console.log("=== Applying Chapter Gating Migration ===\n");

    // 1. teacher_chapter_assessments
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS teacher_chapter_assessments (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          teacher_id INT UNSIGNED NOT NULL,
          chapter_id INT UNSIGNED NOT NULL,
          subject_id INT UNSIGNED NOT NULL,
          grade_id SMALLINT UNSIGNED NOT NULL,
          class_id INT UNSIGNED NOT NULL,
          score INT UNSIGNED NOT NULL,
          total INT UNSIGNED NOT NULL,
          percentage DECIMAL(5,2) NOT NULL,
          passed TINYINT(1) NOT NULL DEFAULT 0,
          attempt_number INT UNSIGNED NOT NULL DEFAULT 1,
          assessment_source ENUM('quiz_bank','ai_generated','admin_uploaded') NOT NULL DEFAULT 'quiz_bank',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_tca_teacher_chapter (teacher_id, chapter_id),
          INDEX idx_tca_teacher_class_chapter (teacher_id, class_id, chapter_id),
          CONSTRAINT fk_tca_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
          CONSTRAINT fk_tca_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
          CONSTRAINT fk_tca_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
          CONSTRAINT fk_tca_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
          CONSTRAINT fk_tca_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);
      console.log("✅ Created teacher_chapter_assessments table.");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR") console.log("⏩ teacher_chapter_assessments already exists.");
      else console.error("❌ teacher_chapter_assessments:", e.message);
    }

    // 2. class_chapter_performance
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS class_chapter_performance (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          class_id INT UNSIGNED NOT NULL,
          chapter_id INT UNSIGNED NOT NULL,
          subject_id INT UNSIGNED NOT NULL,
          avg_score DECIMAL(5,2) NOT NULL DEFAULT 0,
          pass_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
          total_students INT UNSIGNED NOT NULL DEFAULT 0,
          students_passed INT UNSIGNED NOT NULL DEFAULT 0,
          threshold_met TINYINT(1) NOT NULL DEFAULT 0,
          computed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_ccp_class_chapter (class_id, chapter_id),
          CONSTRAINT fk_ccp_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE,
          CONSTRAINT fk_ccp_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
          CONSTRAINT fk_ccp_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);
      console.log("✅ Created class_chapter_performance table.");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR") console.log("⏩ class_chapter_performance already exists.");
      else console.error("❌ class_chapter_performance:", e.message);
    }

    // 3. gating_config
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS gating_config (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          config_key VARCHAR(100) NOT NULL UNIQUE,
          config_value VARCHAR(255) NOT NULL,
          description TEXT NULL,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);
      console.log("✅ Created gating_config table.");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR") console.log("⏩ gating_config already exists.");
      else console.error("❌ gating_config:", e.message);
    }

    // Default config values
    try {
      await db.query(`
        INSERT IGNORE INTO gating_config (config_key, config_value, description) VALUES
          ('teacher_pass_percentage', '70', 'Minimum percentage teacher must score to pass chapter assessment'),
          ('student_threshold_percentage', '60', 'Minimum class average percentage required to unlock next chapter'),
          ('gating_enabled', 'true', 'Master switch to enable/disable chapter gating system'),
          ('allow_manual_override', 'true', 'Allow admins to manually override chapter locks');
      `);
      console.log("✅ Inserted default gating_config values.");
    } catch (e) {
      console.error("❌ gating_config seed:", e.message);
    }

    // 4. chapter_overrides
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS chapter_overrides (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          teacher_id INT UNSIGNED NOT NULL,
          chapter_id INT UNSIGNED NOT NULL,
          class_id INT UNSIGNED NOT NULL,
          override_type ENUM('unlock','lock') NOT NULL DEFAULT 'unlock',
          reason TEXT NULL,
          overridden_by_admin_id INT UNSIGNED NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_co_teacher_chapter_class (teacher_id, chapter_id, class_id),
          INDEX idx_co_teacher_class (teacher_id, class_id),
          CONSTRAINT fk_co_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
          CONSTRAINT fk_co_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
          CONSTRAINT fk_co_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);
      console.log("✅ Created chapter_overrides table.");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR") console.log("⏩ chapter_overrides already exists.");
      else console.error("❌ chapter_overrides:", e.message);
    }

    // 5. Hybrid migration: auto-unlock chapters with existing completed live sessions
    console.log("\n--- Hybrid migration: auto-unlocking existing chapters ---");
    try {
      const [result] = await db.query(`
        INSERT IGNORE INTO teacher_chapter_assessments
          (teacher_id, chapter_id, subject_id, grade_id, class_id, score, total, percentage, passed, attempt_number, assessment_source)
        SELECT DISTINCT
          ls.teacher_id,
          ls.chapter_id,
          ls.subject_id,
          sec.grade_id,
          ls.class_id,
          100, 100, 100.00, 1, 1, 'quiz_bank'
        FROM live_sessions ls
        JOIN sections sec ON sec.id = ls.class_id
        WHERE ls.status = 'ended'
          AND ls.chapter_id IS NOT NULL
      `);
      console.log(`✅ Auto-unlocked ${result.affectedRows || 0} teacher-chapter assessment records.`);
    } catch (e) {
      console.error("❌ Hybrid migration (assessments):", e.message);
    }

    try {
      const [result] = await db.query(`
        INSERT IGNORE INTO class_chapter_performance
          (class_id, chapter_id, subject_id, avg_score, pass_percentage, total_students, students_passed, threshold_met)
        SELECT
          sec.id AS class_id,
          sm.chapter_id,
          ch.subject_id,
          ROUND(AVG((sm.score / NULLIF(sm.total, 0)) * 100), 2),
          ROUND(
            (SUM(CASE WHEN (sm.score / NULLIF(sm.total, 0)) * 100 >= 60 THEN 1 ELSE 0 END) / COUNT(*)) * 100,
            2
          ),
          COUNT(DISTINCT sm.student_id),
          SUM(CASE WHEN (sm.score / NULLIF(sm.total, 0)) * 100 >= 60 THEN 1 ELSE 0 END),
          CASE WHEN AVG((sm.score / NULLIF(sm.total, 0)) * 100) >= 60 THEN 1 ELSE 0 END
        FROM student_marks sm
        JOIN chapters ch ON ch.id = sm.chapter_id
        JOIN students st ON st.id = sm.student_id
        JOIN sections sec ON sec.id = st.section_id
        WHERE sm.total > 0
        GROUP BY sec.id, sm.chapter_id, ch.subject_id
      `);
      console.log(`✅ Auto-computed ${result.affectedRows || 0} class-chapter performance records.`);
    } catch (e) {
      console.error("❌ Hybrid migration (performance):", e.message);
    }

    console.log("\n=== Chapter Gating Migration Complete ===");
    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

applyGatingMigration();

import getPool from './backend/server/config/db.js';

const ALTERS = [
  // 1. Add columns to schools table
  "ALTER TABLE schools ADD COLUMN district VARCHAR(120) NULL AFTER school_name",
  "ALTER TABLE schools ADD COLUMN mandal VARCHAR(120) NULL AFTER district",
  "ALTER TABLE schools ADD COLUMN village VARCHAR(120) NULL AFTER mandal",
  "ALTER TABLE schools ADD COLUMN sessions_completed INT UNSIGNED NOT NULL DEFAULT 0 AFTER village",
  "ALTER TABLE schools ADD COLUMN active_status TINYINT(1) NOT NULL DEFAULT 1 AFTER sessions_completed",
  
  // 2. Add columns to students table
  "ALTER TABLE students ADD COLUMN village VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN mandal VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN district VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN state VARCHAR(100) NULL DEFAULT 'Andhra Pradesh'",
  "ALTER TABLE students ADD COLUMN pincode VARCHAR(10) NULL",
  "ALTER TABLE students ADD COLUMN address TEXT NULL",
  "ALTER TABLE students ADD COLUMN is_hosteller TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE students ADD COLUMN phone_number VARCHAR(20) NULL",
  "ALTER TABLE students ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER last_name",
  "ALTER TABLE students ADD COLUMN category VARCHAR(50) NULL",
  "ALTER TABLE students ADD COLUMN profile_image_path VARCHAR(255) NULL AFTER joined_at",
  "ALTER TABLE students ADD COLUMN gender VARCHAR(20) NULL",
  "ALTER TABLE students ADD COLUMN dob DATE NULL",
  "ALTER TABLE students ADD COLUMN father_name VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN mother_name VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN aadhaar VARCHAR(20) NULL",
  "ALTER TABLE students ADD COLUMN disabilities VARCHAR(255) NULL",

  // 3. Add columns to chapters and topics
  "ALTER TABLE chapters ADD COLUMN textbook_chunk_pdf_path VARCHAR(1024) NULL AFTER teaching_plan_summary",
  "ALTER TABLE topics ADD COLUMN topic_ppt_path VARCHAR(1024) NULL AFTER status",

  // 4. Add grade_id to subject_materials if missing (based on query failure)
  "ALTER TABLE subject_materials ADD COLUMN grade_id INT NULL AFTER subject_id",

  // 5. Add index helpers
  "ALTER TABLE live_sessions ADD INDEX idx_live_sessions_date_class (session_date, class_id)",
  "ALTER TABLE live_sessions ADD INDEX idx_live_sessions_date_teacher (session_date, teacher_id)",
  "ALTER TABLE student_marks ADD INDEX idx_student_marks_assessed_on (assessed_on)",
  "ALTER TABLE student_marks ADD INDEX idx_student_marks_assessment_type (assessment_type)",
];

const TABLES = [
  // 1. audit_logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id VARCHAR(50) NOT NULL DEFAULT 'system',
    actor_role VARCHAR(50) NOT NULL DEFAULT 'unknown',
    actor_name VARCHAR(255) NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NULL,
    meta JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_msg TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  // 2. announcements
  `CREATE TABLE IF NOT EXISTS announcements (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_admin_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_role ENUM('teacher', 'student', 'all') NOT NULL DEFAULT 'teacher',
    target_school_id INT UNSIGNED NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcements_school FOREIGN KEY (target_school_id) REFERENCES schools(id) ON DELETE SET NULL
  ) ENGINE=InnoDB;`,

  // 3. teacher_leaves
  `CREATE TABLE IF NOT EXISTS teacher_leaves (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    applied_on DATE NOT NULL,
    reviewed_at DATETIME NULL,
    reviewed_by_admin_id INT UNSIGNED NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_teacher_leaves_teacher_date (teacher_id, start_date),
    INDEX idx_teacher_leaves_status (status),
    CONSTRAINT fk_teacher_leaves_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 4. teacher_activity_logs
  `CREATE TABLE IF NOT EXISTS teacher_activity_logs (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT UNSIGNED NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_teacher_logs_teacher (teacher_id),
    INDEX idx_teacher_logs_created (created_at),
    CONSTRAINT fk_teacher_logs_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 5. teacher_chapter_assessments
  `CREATE TABLE IF NOT EXISTS teacher_chapter_assessments (
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
    CONSTRAINT fk_tca_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 6. class_chapter_performance
  `CREATE TABLE IF NOT EXISTS class_chapter_performance (
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
  ) ENGINE=InnoDB;`,

  // 7. gating_config
  `CREATE TABLE IF NOT EXISTS gating_config (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value VARCHAR(255) NOT NULL,
    description TEXT NULL,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  // 8. chapter_overrides
  `CREATE TABLE IF NOT EXISTS chapter_overrides (
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
  ) ENGINE=InnoDB;`,

  // 9. teacher_assignments
  `CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT UNSIGNED NOT NULL,
    subject_id INT UNSIGNED NOT NULL,
    section_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ta_teacher_subject_section (teacher_id, subject_id, section_id),
    CONSTRAINT fk_ta_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 10. subject_quiz_bank
  `CREATE TABLE IF NOT EXISTS subject_quiz_bank (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    subject_id INT UNSIGNED NOT NULL,
    chapter VARCHAR(255) NULL,
    grade SMALLINT UNSIGNED NULL,
    topic_name VARCHAR(255) NULL,
    level ENUM('Easy', 'Medium', 'Hard') NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option ENUM('A', 'B', 'C', 'D') NOT NULL,
    explanation TEXT NULL,
    uploaded_by VARCHAR(255) NULL,
    uploaded_by_id VARCHAR(50) NULL,
    assigned_for ENUM('student', 'teacher', 'both') DEFAULT 'both',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sqb_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 11. report_summary_cache
  `CREATE TABLE IF NOT EXISTS report_summary_cache (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    cache_key       VARCHAR(128)   NOT NULL,
    data_version    VARCHAR(128)   NOT NULL,
    report_data     JSON           NOT NULL,
    report_type     VARCHAR(32)    DEFAULT NULL,
    school_filter   VARCHAR(255)   DEFAULT NULL,
    class_filter    VARCHAR(255)   DEFAULT NULL,
    subject_filter  VARCHAR(255)   DEFAULT NULL,
    date_range_start VARCHAR(32)   DEFAULT NULL,
    date_range_end   VARCHAR(32)   DEFAULT NULL,
    ai_provider     VARCHAR(32)    DEFAULT 'ollama',
    ai_model        VARCHAR(64)    DEFAULT 'mistral',
    generation_ms   INT            DEFAULT 0,
    from_cache      TINYINT(1)     DEFAULT 0,
    created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP      NULL DEFAULT NULL,
    UNIQUE KEY idx_cache_key (cache_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 12. report_analytics_log
  `CREATE TABLE IF NOT EXISTS report_analytics_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    cache_key       VARCHAR(128)   DEFAULT NULL,
    request_type    ENUM('cache_hit','cache_miss','dedup','fallback','error') NOT NULL,
    ai_provider     VARCHAR(32)    DEFAULT NULL,
    ai_model        VARCHAR(64)    DEFAULT NULL,
    generation_ms   INT            DEFAULT 0,
    estimated_tokens INT           DEFAULT 0,
    error_message   TEXT           DEFAULT NULL,
    created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
];

async function migrate() {
  const db = getPool();
  try {
    console.log("Starting reliable database migration...");

    // 1. Create Tables
    for (const sql of TABLES) {
      try {
        await db.query(sql);
      } catch (err) {
        console.error(`Failed to create table statement: ${sql.substring(0, 100)}... -> Error: ${err.message}`);
      }
    }
    console.log("All tables checked/created.");

    // 2. Insert default config values if empty
    try {
      await db.query(`
        INSERT IGNORE INTO gating_config (config_key, config_value, description) VALUES
        ('teacher_pass_percentage', '70', 'Minimum percentage teacher must score to pass chapter assessment'),
        ('student_threshold_percentage', '60', 'Minimum class average percentage required to unlock next chapter'),
        ('gating_enabled', 'true', 'Master switch to enable/disable chapter gating system'),
        ('allow_manual_override', 'true', 'Allow admins to manually override chapter locks'),
        ('assessment_question_count', '10', 'Number of questions for each chapter assessment'),
        ('assessment_total_marks', '100', 'Total marks for the teacher chapter assessment'),
        ('assessment_passing_marks', '70', 'Passing marks required to clear the chapter assessment');
      `);
      console.log("gating_config default rows checked.");
    } catch (err) {
      console.error("Failed to seed gating_config defaults:", err.message);
    }

    // 3. Alter existing tables to add columns & indexes
    for (const sql of ALTERS) {
      try {
        await db.query(sql);
      } catch (err) {
        // Skip duplicate column/key errors
        if (
          err.code === 'ER_DUP_FIELDNAME' || 
          err.code === 'ER_DUP_KEYNAME' || 
          err.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
          err.message.includes('already exists') ||
          err.message.includes('Duplicate column')
        ) {
          // Expected when column is already present
        } else {
          console.warn(`[Warning] Alter failed: ${sql} -> Error: ${err.message}`);
        }
      }
    }
    console.log("All alter queries applied successfully.");
    console.log("Database migration completely finalized!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();

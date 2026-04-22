-- Admin dashboard production upgrades
-- Run once on the target DB before using admin dynamic features.

USE railway;

-- 1) Schools metadata used by admin forms/cards
SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'district'
  ),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN district VARCHAR(120) NULL AFTER school_name'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'mandal'
  ),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN mandal VARCHAR(120) NULL AFTER district'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'sessions_completed'
  ),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN sessions_completed INT UNSIGNED NOT NULL DEFAULT 0 AFTER mandal'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'active_status'
  ),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN active_status TINYINT(1) NOT NULL DEFAULT 1 AFTER sessions_completed'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

-- 2) Leave applications (admin review + status update)
CREATE TABLE IF NOT EXISTS teacher_leaves (
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
  CONSTRAINT fk_teacher_leaves_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_leaves_admin FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3) Materials path columns used by upload APIs
SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chapters' AND COLUMN_NAME = 'textbook_chunk_pdf_path'
  ),
  'SELECT 1',
  'ALTER TABLE chapters ADD COLUMN textbook_chunk_pdf_path VARCHAR(1024) NULL AFTER teaching_plan_summary'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'topics' AND COLUMN_NAME = 'topic_ppt_path'
  ),
  'SELECT 1',
  'ALTER TABLE topics ADD COLUMN topic_ppt_path VARCHAR(1024) NULL AFTER status'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

-- 4) Helpful indexes for Feb-heavy analytics and admin dashboards
SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_sessions' AND INDEX_NAME = 'idx_live_sessions_date_class'
  ),
  'SELECT 1',
  'ALTER TABLE live_sessions ADD INDEX idx_live_sessions_date_class (session_date, class_id)'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_sessions' AND INDEX_NAME = 'idx_live_sessions_date_teacher'
  ),
  'SELECT 1',
  'ALTER TABLE live_sessions ADD INDEX idx_live_sessions_date_teacher (session_date, teacher_id)'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_marks' AND INDEX_NAME = 'idx_student_marks_assessed_on'
  ),
  'SELECT 1',
  'ALTER TABLE student_marks ADD INDEX idx_student_marks_assessed_on (assessed_on)'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_marks' AND INDEX_NAME = 'idx_student_marks_assessment_type'
  ),
  'SELECT 1',
  'ALTER TABLE student_marks ADD INDEX idx_student_marks_assessment_type (assessment_type)'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_quiz_sessions' AND INDEX_NAME = 'idx_lqs_live_session_status'
  ),
  'SELECT 1',
  'ALTER TABLE live_quiz_sessions ADD INDEX idx_lqs_live_session_status (live_session_id, status)'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teacher_performance_snapshots' AND INDEX_NAME = 'idx_tps_snapshot_class'
  ),
  'SELECT 1',
  'ALTER TABLE teacher_performance_snapshots ADD INDEX idx_tps_snapshot_class (snapshot_date, class_id)'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

-- Optional starter leave data (safe insert if table empty)
INSERT INTO teacher_leaves (teacher_id, start_date, reason, status, applied_on)
SELECT t.id, '2026-02-18', 'Medical appointment', 'approved', '2026-02-15'
FROM teachers t
WHERE t.id IN (1, 4)
  AND NOT EXISTS (SELECT 1 FROM teacher_leaves tl WHERE tl.teacher_id = t.id AND tl.start_date = '2026-02-18');


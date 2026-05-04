-- =====================================================
-- Teacher Competency-Gated Teaching System — Migration
-- =====================================================
-- Scope: teacher + subject + grade + class
-- Run this ONCE on the live database.

-- 1. Teacher Chapter Assessments
-- Tracks every assessment attempt by a teacher per chapter.
CREATE TABLE IF NOT EXISTS teacher_chapter_assessments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  chapter_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  grade_id SMALLINT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,           -- sections.id — gating is per class
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

-- 2. Class Chapter Performance
-- Aggregated student performance per chapter per class.
CREATE TABLE IF NOT EXISTS class_chapter_performance (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id INT UNSIGNED NOT NULL,            -- sections.id
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

-- 3. Gating Configuration
-- Admin-controlled thresholds + master switches.
CREATE TABLE IF NOT EXISTS gating_config (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value VARCHAR(255) NOT NULL,
  description TEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default thresholds
INSERT IGNORE INTO gating_config (config_key, config_value, description) VALUES
  ('teacher_pass_percentage', '70', 'Minimum percentage teacher must score to pass chapter assessment'),
  ('student_threshold_percentage', '60', 'Minimum class average percentage required to unlock next chapter'),
  ('gating_enabled', 'true', 'Master switch to enable/disable chapter gating system'),
  ('allow_manual_override', 'true', 'Allow admins to manually override chapter locks');

-- 4. Manual Admin Overrides
-- Audit-trailed overrides with reason.
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

-- =====================================================
-- Hybrid Migration: Auto-unlock chapters with existing data
-- =====================================================
-- For chapters that already have completed live sessions
-- AND student performance data, insert "assumed pass" records.
-- This prevents forcing retroactive assessments on teachers.

-- Auto-create teacher_chapter_assessments for chapters with completed live sessions
INSERT IGNORE INTO teacher_chapter_assessments
  (teacher_id, chapter_id, subject_id, grade_id, class_id, score, total, percentage, passed, attempt_number, assessment_source)
SELECT DISTINCT
  ls.teacher_id,
  ls.chapter_id,
  ls.subject_id,
  sec.grade_id,
  ls.class_id,
  100 AS score,
  100 AS total,
  100.00 AS percentage,
  1 AS passed,
  1 AS attempt_number,
  'quiz_bank' AS assessment_source
FROM live_sessions ls
JOIN sections sec ON sec.id = ls.class_id
WHERE ls.status = 'ended'
  AND ls.chapter_id IS NOT NULL;

-- Auto-compute class_chapter_performance for chapters with student_marks data
INSERT IGNORE INTO class_chapter_performance
  (class_id, chapter_id, subject_id, avg_score, pass_percentage, total_students, students_passed, threshold_met)
SELECT
  sec.id AS class_id,
  sm.chapter_id,
  ch.subject_id,
  ROUND(AVG((sm.score / NULLIF(sm.total, 0)) * 100), 2) AS avg_score,
  ROUND(
    (SUM(CASE WHEN (sm.score / NULLIF(sm.total, 0)) * 100 >= 60 THEN 1 ELSE 0 END) / COUNT(*)) * 100,
    2
  ) AS pass_percentage,
  COUNT(DISTINCT sm.student_id) AS total_students,
  SUM(CASE WHEN (sm.score / NULLIF(sm.total, 0)) * 100 >= 60 THEN 1 ELSE 0 END) AS students_passed,
  CASE WHEN AVG((sm.score / NULLIF(sm.total, 0)) * 100) >= 60 THEN 1 ELSE 0 END AS threshold_met
FROM student_marks sm
JOIN chapters ch ON ch.id = sm.chapter_id
JOIN students st ON st.id = sm.student_id
JOIN sections sec ON sec.id = st.section_id
WHERE sm.total > 0
GROUP BY sec.id, sm.chapter_id, ch.subject_id;

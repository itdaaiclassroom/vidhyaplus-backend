-- =====================================================
-- Per-Chapter Assessment Configuration
-- Allows admin to set different question count, total marks,
-- and passing marks for each chapter individually.
-- Falls back to global gating_config values if not set.
-- =====================================================

CREATE TABLE IF NOT EXISTS chapter_assessment_config (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  chapter_id INT UNSIGNED NOT NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 10,
  total_marks INT UNSIGNED NOT NULL DEFAULT 100,
  passing_marks INT UNSIGNED NOT NULL DEFAULT 70,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cac_chapter (chapter_id),
  CONSTRAINT fk_cac_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- VidhyaPlus LMS — Subject Question Bank Migration
-- Run this once against your MySQL database.
-- ============================================================

CREATE TABLE IF NOT EXISTS subject_quiz_bank (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,

  -- Context / filter columns (no internal topic ID required)
  subject_id      INT UNSIGNED NOT NULL                       COMMENT 'FK to subjects.id',
  chapter         VARCHAR(255) NULL DEFAULT NULL              COMMENT 'Free-text chapter name e.g. "Light and Optics"',
  grade           TINYINT UNSIGNED NULL DEFAULT NULL          COMMENT 'Class grade: 6, 7, 8, 9, or 10',

  -- Question content
  question_text   TEXT NOT NULL,
  option_a        VARCHAR(512) NOT NULL,
  option_b        VARCHAR(512) NOT NULL,
  option_c        VARCHAR(512) NOT NULL,
  option_d        VARCHAR(512) NOT NULL,
  correct_option  CHAR(1) NOT NULL                            COMMENT 'A, B, C, or D',
  explanation     TEXT NULL DEFAULT NULL,

  -- Upload metadata
  uploaded_by     VARCHAR(150) NULL DEFAULT NULL              COMMENT 'Display name of the uploader (from JWT)',
  uploaded_by_id  VARCHAR(50) NULL DEFAULT NULL               COMMENT 'Actor ID from JWT',

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for the three filter dimensions
  INDEX idx_sqb_subject          (subject_id),
  INDEX idx_sqb_grade            (grade),
  INDEX idx_sqb_chapter          (chapter(100)),
  INDEX idx_sqb_subject_grade    (subject_id, grade),

  CONSTRAINT fk_sqb_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Subject-level question bank: questions tagged by chapter and grade. No topic_id required.';

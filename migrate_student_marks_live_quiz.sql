-- One-time migration for databases created before `live_quiz_session_id` on student_marks.
-- Run once; comment out lines that error if already applied.

USE lms;

-- Add column (skip if 'Duplicate column name')
ALTER TABLE student_marks
  ADD COLUMN live_quiz_session_id INT UNSIGNED NULL COMMENT 'set when mark row comes from a ended live quiz' AFTER assessed_on;

ALTER TABLE student_marks
  ADD INDEX idx_sm_live_quiz (live_quiz_session_id);

-- One mark row per student per live quiz session
ALTER TABLE student_marks
  ADD UNIQUE KEY uq_sm_student_live_quiz (student_id, live_quiz_session_id);

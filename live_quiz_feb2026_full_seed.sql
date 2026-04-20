-- February 2026: full live-quiz graph for Class 10-A + marks derived from answers + teacher_performance_snapshots quiz columns.
--
-- Prerequisites (order):
--   1) Core LMS tables from lms.sql: students, chapters, live_sessions, live_quiz_sessions, live_quiz_questions, live_quiz_answers, quiz_session_summary, teacher_performance_snapshots, etc.
--   2) curriculum_grade10_curriculum_load.sql
--   3) february_live_sessions_curriculum_update.sql  ← live_sessions.chapter_id / topic_id must be set
--
-- student_marks: created below if missing (same shape as lms.sql). Unique key enables ON DUPLICATE KEY UPDATE for live quiz rows.
--
-- Idempotent for the Feb 2026 10-A slice: deletes prior seeded quiz rows + live_quiz-linked marks for that slice, then rebuilds.

USE lms;

SET SQL_SAFE_UPDATES = 0;

-- ---- Schema: ensure student_marks exists (1146 if you only ran part of lms.sql) ----
CREATE TABLE IF NOT EXISTS student_marks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  chapter_id INT UNSIGNED NOT NULL,
  assessment_type VARCHAR(64) NULL DEFAULT 'assessment',
  score INT UNSIGNED NOT NULL,
  total INT UNSIGNED NOT NULL,
  assessed_on DATE NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  live_quiz_session_id INT UNSIGNED NULL COMMENT 'set when mark row comes from a ended live quiz',
  INDEX idx_sm_student (student_id),
  INDEX idx_sm_chapter (chapter_id),
  CONSTRAINT fk_sm_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_sm_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Older DBs: add column if table existed without live_quiz_session_id
SET @sm_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_marks' AND COLUMN_NAME = 'live_quiz_session_id'
);
SET @sm_alter_col := IF(
  @sm_col = 0,
  'ALTER TABLE student_marks ADD COLUMN live_quiz_session_id INT UNSIGNED NULL COMMENT ''set when mark row comes from a ended live quiz'' AFTER assessed_on',
  'SELECT 1'
);
PREPARE sm_stmt FROM @sm_alter_col;
EXECUTE sm_stmt;
DEALLOCATE PREPARE sm_stmt;

-- One mark row per student per live quiz session (required for INSERT ... ON DUPLICATE KEY UPDATE)
SET @sm_uq := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_marks' AND INDEX_NAME = 'uq_sm_student_live_quiz'
);
SET @sm_alter_uq := IF(
  @sm_uq = 0,
  'ALTER TABLE student_marks ADD UNIQUE KEY uq_sm_student_live_quiz (student_id, live_quiz_session_id)',
  'SELECT 1'
);
PREPARE sm_uq_stmt FROM @sm_alter_uq;
EXECUTE sm_uq_stmt;
DEALLOCATE PREPARE sm_uq_stmt;

-- ---- 0) Remove prior Feb 2026 10-A live quiz data + marks tied to those sessions ----
DELETE sm FROM student_marks sm
WHERE sm.live_quiz_session_id IN (
  SELECT lqs.id FROM live_quiz_sessions lqs
  INNER JOIN live_sessions ls ON ls.id = lqs.live_session_id
  INNER JOIN sections sec ON sec.id = ls.class_id
  WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
    AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
);

DELETE FROM student_marks
WHERE assessment_type IN ('subject_wise_feb_demo', 'live_quiz')
  AND assessed_on BETWEEN '2026-02-01' AND '2026-02-28';

DELETE lqa FROM live_quiz_answers lqa
INNER JOIN live_quiz_sessions lqs ON lqs.id = lqa.live_quiz_session_id
INNER JOIN live_sessions ls ON ls.id = lqs.live_session_id
INNER JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

DELETE lqq FROM live_quiz_questions lqq
INNER JOIN live_quiz_sessions lqs ON lqs.id = lqq.live_quiz_session_id
INNER JOIN live_sessions ls ON ls.id = lqs.live_session_id
INNER JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

DELETE qss FROM quiz_session_summary qss
INNER JOIN live_quiz_sessions lqs ON lqs.id = qss.live_quiz_session_id
INNER JOIN live_sessions ls ON ls.id = lqs.live_session_id
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

DELETE lqs FROM live_quiz_sessions lqs
INNER JOIN live_sessions ls ON ls.id = lqs.live_session_id
INNER JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

-- ---- 1) One live quiz per live teaching session (168 sessions) ----
INSERT INTO live_quiz_sessions (teacher_id, class_id, chapter_id, topic_id, topic_name, subject_id, quiz_scope, status, live_session_id, created_at)
SELECT
  ls.teacher_id,
  ls.class_id,
  ls.chapter_id,
  ls.topic_id,
  COALESCE(ls.topic_name, 'Lesson quiz'),
  ls.subject_id,
  'TOPIC',
  'active',
  ls.id,
  ls.start_time
FROM live_sessions ls
JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND NOT EXISTS (SELECT 1 FROM live_quiz_sessions x WHERE x.live_session_id = ls.id);

-- ---- 2) Five MCQs per quiz ----
INSERT INTO live_quiz_questions (live_quiz_session_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_num)
SELECT
  lqs.id,
  CONCAT('Q', n.n, ' (', subj.subject_name, '): Choose the best answer.'),
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  ELT(n.n, 'A', 'B', 'C', 'D', 'A'),
  'Refer to the textbook chapter.',
  n.n
FROM live_quiz_sessions lqs
JOIN live_sessions ls ON ls.id = lqs.live_session_id
JOIN subjects subj ON subj.id = lqs.subject_id
CROSS JOIN (
  SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
) n
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

-- ---- 3) Every 10-A student answers every question (deterministic correct/incorrect) ----
INSERT INTO live_quiz_answers (live_quiz_session_id, student_id, question_id, selected_option, is_correct)
SELECT
  lqq.live_quiz_session_id,
  st.id,
  lqq.id,
  ELT(1 + ((st.id + lqq.id) % 4), 'A', 'B', 'C', 'D') AS selected_option,
  IF(
    ELT(1 + ((st.id + lqq.id) % 4), 'A', 'B', 'C', 'D') = TRIM(lqq.correct_option),
    1,
    0
  ) AS is_correct
FROM live_quiz_questions lqq
JOIN live_quiz_sessions lqs ON lqs.id = lqq.live_quiz_session_id
JOIN live_sessions ls ON ls.id = lqs.live_session_id
JOIN sections sec ON sec.id = ls.class_id
JOIN students st ON st.section_id = sec.id
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A';

-- ---- 4) End quizzes → triggers fill quiz_session_summary ----
UPDATE live_quiz_sessions lqs
JOIN live_sessions ls ON ls.id = lqs.live_session_id
SET lqs.status = 'ended'
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND lqs.status = 'active';

UPDATE live_sessions ls
JOIN sections sec ON sec.id = ls.class_id
SET ls.quiz_submitted = 1
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

-- ---- 5) Materialize chapter marks per live quiz (feeds GET /api/all → studentQuizResults) ----
INSERT INTO student_marks (student_id, chapter_id, assessment_type, score, total, assessed_on, live_quiz_session_id)
SELECT
  lqa.student_id,
  lqs.chapter_id,
  'live_quiz',
  SUM(lqa.is_correct),
  COUNT(*),
  ls.session_date,
  lqs.id
FROM live_quiz_answers lqa
JOIN live_quiz_sessions lqs ON lqs.id = lqa.live_quiz_session_id
JOIN live_sessions ls ON ls.id = lqs.live_session_id
WHERE lqs.chapter_id IS NOT NULL
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
GROUP BY lqa.student_id, lqs.id, lqs.chapter_id, ls.session_date
ON DUPLICATE KEY UPDATE
  score = VALUES(score),
  total = VALUES(total),
  assessed_on = VALUES(assessed_on);

-- ---- 6) Align teacher_performance_snapshots (Feb 28) with quiz activity ----
-- 24 topic quizzes per subject teacher; 30 students × 24 sessions = 720 answer sets per teacher.
UPDATE teacher_performance_snapshots tps
JOIN (
  SELECT
    r.teacher_id,
    GROUP_CONCAT(r.line ORDER BY r.rn SEPARATOR ' | ') AS tops
  FROM (
    SELECT
      a.teacher_id,
      CONCAT(TRIM(CONCAT(st.first_name, ' ', st.last_name)), ':', a.tot) AS line,
      ROW_NUMBER() OVER (PARTITION BY a.teacher_id ORDER BY a.tot DESC) AS rn
    FROM (
      SELECT
        lqs.teacher_id,
        lqa.student_id,
        SUM(lqa.is_correct) AS tot
      FROM live_quiz_answers lqa
      JOIN live_quiz_sessions lqs ON lqs.id = lqa.live_quiz_session_id
      JOIN live_sessions ls ON ls.id = lqs.live_session_id
      JOIN sections sec ON sec.id = ls.class_id
      WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
        AND sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
      GROUP BY lqs.teacher_id, lqa.student_id
    ) a
    JOIN students st ON st.id = a.student_id
  ) r
  WHERE r.rn <= 5
  GROUP BY r.teacher_id
) x ON x.teacher_id = tps.teacher_id
SET
  tps.quizzes_conducted = 24,
  tps.subjects_quizzes_conducted = 1,
  tps.quiz_participants = 720,
  tps.quiz_absent = 0,
  tps.topic_quizzes_conducted = 24,
  tps.top_scorers = x.tops
WHERE tps.snapshot_date = '2026-02-28'
  AND tps.class_id = (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A' LIMIT 1);

SET SQL_SAFE_UPDATES = 1;

SELECT 'live_quiz_sessions_feb_10a' AS check_name, COUNT(*) AS value
FROM live_quiz_sessions lqs
JOIN live_sessions ls ON ls.id = lqs.live_session_id
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

SELECT 'live_quiz_questions_feb_10a' AS check_name, COUNT(*) AS value
FROM live_quiz_questions lqq
JOIN live_quiz_sessions lqs ON lqs.id = lqq.live_quiz_session_id
JOIN live_sessions ls ON ls.id = lqs.live_session_id
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

SELECT 'live_quiz_answers_feb_10a' AS check_name, COUNT(*) AS value
FROM live_quiz_answers lqa
JOIN live_quiz_sessions lqs ON lqs.id = lqa.live_quiz_session_id
JOIN live_sessions ls ON ls.id = lqs.live_session_id
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

SELECT 'quiz_session_summary_feb_10a' AS check_name, COUNT(*) AS value
FROM quiz_session_summary qss
JOIN live_quiz_sessions lqs ON lqs.id = qss.live_quiz_session_id
JOIN live_sessions ls ON ls.id = lqs.live_session_id
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

SELECT 'student_marks_live_quiz_feb' AS check_name, COUNT(*) AS value
FROM student_marks
WHERE assessment_type = 'live_quiz' AND assessed_on BETWEEN '2026-02-01' AND '2026-02-28';

-- Paste ALL output (every result grid) back for review.
-- Safe block 1 runs even if some tables are missing.

USE lms;

-- ========== 1) Which core tables exist (1 = exists) ==========
SELECT
  'table_exists' AS grp,
  MAX(CASE WHEN TABLE_NAME = 'student_marks' THEN 1 ELSE 0 END) AS student_marks,
  MAX(CASE WHEN TABLE_NAME = 'live_quiz_sessions' THEN 1 ELSE 0 END) AS live_quiz_sessions,
  MAX(CASE WHEN TABLE_NAME = 'live_quiz_questions' THEN 1 ELSE 0 END) AS live_quiz_questions,
  MAX(CASE WHEN TABLE_NAME = 'live_quiz_answers' THEN 1 ELSE 0 END) AS live_quiz_answers,
  MAX(CASE WHEN TABLE_NAME = 'quiz_session_summary' THEN 1 ELSE 0 END) AS quiz_session_summary,
  MAX(CASE WHEN TABLE_NAME = 'live_sessions' THEN 1 ELSE 0 END) AS live_sessions,
  MAX(CASE WHEN TABLE_NAME = 'chapters' THEN 1 ELSE 0 END) AS chapters,
  MAX(CASE WHEN TABLE_NAME = 'students' THEN 1 ELSE 0 END) AS students,
  MAX(CASE WHEN TABLE_NAME = 'sections' THEN 1 ELSE 0 END) AS sections,
  MAX(CASE WHEN TABLE_NAME = 'teacher_performance_snapshots' THEN 1 ELSE 0 END) AS teacher_performance_snapshots
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'student_marks', 'live_quiz_sessions', 'live_quiz_questions', 'live_quiz_answers',
    'quiz_session_summary', 'live_sessions', 'chapters', 'students', 'sections',
    'teacher_performance_snapshots'
  );

-- ========== 2) Column on student_marks (if table exists) ==========
SELECT
  'student_marks_columns' AS grp,
  GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) AS columns
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_marks';

SELECT
  'has_uq_sm_student_live_quiz' AS grp,
  COUNT(*) AS index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_marks' AND INDEX_NAME = 'uq_sm_student_live_quiz';

-- ========== 3) Row counts (errors here = missing table; tell us which line failed) ==========
SELECT 'count_student_marks' AS metric, COUNT(*) AS value FROM student_marks
UNION ALL SELECT 'count_student_marks_live_quiz_feb', COUNT(*) FROM student_marks WHERE assessment_type = 'live_quiz' AND assessed_on BETWEEN '2026-02-01' AND '2026-02-28'
UNION ALL SELECT 'count_live_quiz_sessions', COUNT(*) FROM live_quiz_sessions
UNION ALL SELECT 'count_live_quiz_questions', COUNT(*) FROM live_quiz_questions
UNION ALL SELECT 'count_live_quiz_answers', COUNT(*) FROM live_quiz_answers
UNION ALL SELECT 'count_quiz_session_summary', COUNT(*) FROM quiz_session_summary
UNION ALL SELECT 'count_live_sessions_feb', COUNT(*) FROM live_sessions WHERE session_date BETWEEN '2026-02-01' AND '2026-02-28'
UNION ALL SELECT 'count_live_sessions_feb_null_chapter', COUNT(*) FROM live_sessions WHERE session_date BETWEEN '2026-02-01' AND '2026-02-28' AND chapter_id IS NULL;

-- ========== 4) Feb 2026 Class 10-A slice (adjust section if not A) ==========
SELECT 'feb10a_live_sessions' AS metric, COUNT(*) AS value
FROM live_sessions ls
JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

SELECT 'feb10a_live_sessions_chapter_null' AS metric, COUNT(*) AS value
FROM live_sessions ls
JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND ls.chapter_id IS NULL;

SELECT 'feb10a_live_quiz_sessions' AS metric, COUNT(*) AS value
FROM live_quiz_sessions lqs
JOIN live_sessions ls ON ls.id = lqs.live_session_id
JOIN sections sec ON sec.id = ls.class_id
WHERE sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A'
  AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

-- ========== 5) Teacher snapshots (Feb 28) — quiz columns ==========
SELECT teacher_id, snapshot_date, class_id, quizzes_conducted, quiz_participants, topic_quizzes_conducted,
       LEFT(COALESCE(top_scorers, ''), 120) AS top_scorers_preview
FROM teacher_performance_snapshots
WHERE snapshot_date = '2026-02-28'
ORDER BY teacher_id;

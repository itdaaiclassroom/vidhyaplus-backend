-- DB Load Checklist Script for LMS
-- Run this in MySQL Workbench after loading your data batches.
-- Full grade 10 reset + curriculum: run `curriculum_grade10_curriculum_load.sql` (replaces chapters/topics/micro for grade 10).
-- Legacy: `topics_and_micro_lessons_fill.sql` / `topics_micro_seed.sql` — regenerate via `scripts/generate_grade10_curriculum_sql.py` if needed.
-- It reports what is loaded, what is missing, and basic consistency checks.

USE lms;

-- =====================================
-- 0) Optional: clear visual separator
-- =====================================
SELECT '===== LMS DB LOAD CHECKLIST START =====' AS info;

-- =====================================
-- 1) Master + Roles + Core entities
-- =====================================
SELECT 'schools' AS table_name, COUNT(*) AS row_count FROM schools
UNION ALL SELECT 'grades', COUNT(*) FROM grades
UNION ALL SELECT 'sections', COUNT(*) FROM sections            
UNION ALL SELECT 'subjects', COUNT(*) FROM subjects
UNION ALL SELECT 'grade_subjects', COUNT(*) FROM grade_subjects
UNION ALL SELECT 'admins', COUNT(*) FROM admins
UNION ALL SELECT 'admin_schools', COUNT(*) FROM admin_schools
UNION ALL SELECT 'teachers', COUNT(*) FROM teachers
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'teacher_qr_codes', COUNT(*) FROM teacher_qr_codes
UNION ALL SELECT 'student_qr_codes', COUNT(*) FROM student_qr_codes;

-- =====================================
-- 2) Curriculum load checks
-- =====================================
SELECT 'chapters_grade10' AS check_name, COUNT(*) AS value
FROM chapters
WHERE grade_id = 10;

SELECT 'topics_total' AS check_name, COUNT(*) AS value
FROM topics;

SELECT 'topic_micro_lessons_total' AS check_name, COUNT(*) AS value
FROM topic_micro_lessons;

-- Chapters in grade 10 missing topics
SELECT
  s.subject_name,
  c.chapter_no,
  c.chapter_name
FROM chapters c
JOIN subjects s ON s.id = c.subject_id
LEFT JOIN topics t ON t.chapter_id = c.id
WHERE c.grade_id = 10
GROUP BY s.subject_name, c.chapter_no, c.chapter_name
HAVING COUNT(t.id) = 0
ORDER BY s.subject_name, c.chapter_no;

-- Topics without micro lessons
SELECT
  s.subject_name,
  c.chapter_no,
  c.chapter_name,
  t.id AS topic_id,
  t.name AS topic_name
FROM topics t
JOIN chapters c ON c.id = t.chapter_id
JOIN subjects s ON s.id = c.subject_id
LEFT JOIN topic_micro_lessons ml ON ml.topic_id = t.id
WHERE c.grade_id = 10
GROUP BY s.subject_name, c.chapter_no, c.chapter_name, t.id, t.name
HAVING COUNT(ml.id) = 0
ORDER BY s.subject_name, c.chapter_no, t.order_num;

-- =====================================
-- 3) Demo operation data checks
-- =====================================
SELECT 'live_sessions' AS table_name, COUNT(*) AS row_count FROM live_sessions
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL SELECT 'class_attendance_summary', COUNT(*) FROM class_attendance_summary
UNION ALL SELECT 'teacher_performance_snapshots', COUNT(*) FROM teacher_performance_snapshots
UNION ALL SELECT 'activities', COUNT(*) FROM activities
UNION ALL SELECT 'activity_assignments', COUNT(*) FROM activity_assignments
UNION ALL SELECT 'activity_participation', COUNT(*) FROM activity_participation;

-- February 2026 live sessions count (expect 168 = 24 working days × 7 subjects/periods)
SELECT
  'live_sessions_feb_2026' AS check_name,
  COUNT(*) AS value
FROM live_sessions
WHERE session_date BETWEEN '2026-02-01' AND '2026-02-28';

-- February 2026 attendance rows (30 students × 24 days = 720)
SELECT
  'attendance_feb_2026' AS check_name,
  COUNT(*) AS value
FROM attendance
WHERE date BETWEEN '2026-02-01' AND '2026-02-28';

-- Chapter-level marks (API: studentQuizResults / GET /api/student-marks)
SELECT 'student_marks_total' AS check_name, COUNT(*) AS value FROM student_marks;
SELECT
  'student_marks_subject_wise_feb_demo' AS check_name,
  COUNT(*) AS value
FROM student_marks
WHERE assessment_type = 'subject_wise_feb_demo';

SELECT
  'student_marks_live_quiz_feb' AS check_name,
  COUNT(*) AS value
FROM student_marks
WHERE assessment_type = 'live_quiz' AND assessed_on BETWEEN '2026-02-01' AND '2026-02-28';

SELECT 'live_quiz_sessions' AS table_name, COUNT(*) AS row_count FROM live_quiz_sessions
UNION ALL SELECT 'live_quiz_questions', COUNT(*) FROM live_quiz_questions
UNION ALL SELECT 'live_quiz_answers', COUNT(*) FROM live_quiz_answers
UNION ALL SELECT 'quiz_session_summary', COUNT(*) FROM quiz_session_summary;

-- =====================================
-- 4) Referential integrity diagnostics
-- =====================================

-- Teachers with invalid subject assignment
SELECT t.id, t.full_name, t.subject_id
FROM teachers t
LEFT JOIN subjects s ON s.id = t.subject_id
WHERE t.subject_id IS NOT NULL AND s.id IS NULL;

-- Students with invalid section/school
SELECT st.id, st.first_name, st.last_name, st.section_id, st.school_id
FROM students st
LEFT JOIN sections sec ON sec.id = st.section_id
LEFT JOIN schools sc ON sc.id = st.school_id
WHERE sec.id IS NULL OR sc.id IS NULL;

-- QR rows with missing student
SELECT sq.id, sq.student_id, sq.qr_type, sq.qr_code_value
FROM student_qr_codes sq
LEFT JOIN students st ON st.id = sq.student_id
WHERE st.id IS NULL;

-- =====================================
-- 5) App readiness summary (single row)
-- =====================================
SELECT
  (SELECT COUNT(*) FROM schools) > 0 AS has_schools,
  (SELECT COUNT(*) FROM sections) > 0 AS has_sections,
  (SELECT COUNT(*) FROM subjects) > 0 AS has_subjects,
  (SELECT COUNT(*) FROM teachers) > 0 AS has_teachers,
  (SELECT COUNT(*) FROM students) > 0 AS has_students,
  (SELECT COUNT(*) FROM chapters WHERE grade_id = 10) > 0 AS has_grade10_chapters,
  (SELECT COUNT(*) FROM topics) > 0 AS has_topics,
  (SELECT COUNT(*) FROM topic_micro_lessons) > 0 AS has_micro_plans,
  (SELECT COUNT(*) FROM live_sessions) > 0 AS has_live_sessions,
  (SELECT COUNT(*) FROM attendance) > 0 AS has_attendance,
  (SELECT COUNT(*) FROM activities) > 0 AS has_activities,
  (SELECT COUNT(*) FROM student_marks) > 0 AS has_student_marks;

SELECT '===== LMS DB LOAD CHECKLIST END =====' AS info;


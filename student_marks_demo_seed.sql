-- Deprecated standalone demo: marks now come from live quiz answers.
-- Use `live_quiz_feb2026_full_seed.sql` after curriculum + February session mapping so that:
--   live_quiz_sessions / questions / answers / quiz_session_summary are populated, and
--   student_marks rows are derived from live_quiz_answers (assessment_type = 'live_quiz').
--
-- If you only need a tiny dataset without 168 sessions, keep this file empty or run a subset from the full seed.

SELECT 'student_marks_demo_seed_deprecated_use_live_quiz_feb2026_full_seed' AS info;

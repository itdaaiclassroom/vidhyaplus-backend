import getPool from "./backend/server/config/db.js";

const queries = [
  {
    name: "schools",
    sql: "SELECT sc.id, sc.school_name AS name, sc.school_code AS code, COALESCE(sc.district, '') AS district, COALESCE(sc.mandal, '') AS mandal, GREATEST(COALESCE(sc.sessions_completed, 0), COALESCE(ls_cnt.sessions_completed, 0)) AS sessions_completed, COALESCE(sc.active_status, 1) AS active_status FROM schools sc LEFT JOIN (SELECT sec.school_id, COUNT(*) AS sessions_completed FROM live_sessions ls JOIN sections sec ON sec.id = ls.class_id WHERE ls.status = 'ended' GROUP BY sec.school_id) ls_cnt ON ls_cnt.school_id = sc.id"
  },
  {
    name: "classes",
    sql: "SELECT sec.id, sec.school_id, CONCAT('Class ', sec.grade_id, '-', sec.section_code) AS name, sec.section_code AS section, sec.grade_id AS grade, COALESCE(st_cnt.student_count, 0) AS student_count FROM sections sec LEFT JOIN (SELECT section_id, COUNT(*) AS student_count FROM students GROUP BY section_id) st_cnt ON st_cnt.section_id = sec.id"
  },
  {
    name: "teachers",
    sql: "SELECT * FROM teachers"
  },
  {
    name: "students",
    sql: "SELECT * FROM students"
  },
  {
    name: "subjects",
    sql: "SELECT id, subject_name AS name, COALESCE(icon, '📚') AS icon, COALESCE(grades, '1,2,3,4,5,6,7,8,9,10') AS grades FROM subjects ORDER BY FIELD(subject_name, 'Telugu', 'Hindi', 'English', 'Mathematics', 'Physics', 'Biology', 'Social Studies'), subject_name"
  },
  {
    name: "chapters",
    sql: "SELECT c.id, c.subject_id, c.chapter_name AS name, c.grade_id AS grade, c.chapter_no AS order_num, c.chapter_no, c.macro_month_label AS month_label, c.planned_periods AS periods, c.teaching_plan_summary, NULL AS concepts, ctm.pdf_url AS textbook_chunk_pdf_path FROM chapters c LEFT JOIN (SELECT chapter_id, MAX(id) AS latest_id FROM chapter_textual_materials GROUP BY chapter_id) latest_ctm ON latest_ctm.chapter_id = c.id LEFT JOIN chapter_textual_materials ctm ON ctm.id = latest_ctm.latest_id ORDER BY c.subject_id, c.chapter_no"
  },
  {
    name: "enrollments",
    sql: "SELECT id AS student_id, section_id AS class_id, '2025-26' AS academic_year FROM students"
  },
  {
    name: "teacherAssignments",
    sql: "SELECT * FROM teacher_assignments"
  },
  {
    name: "topics",
    sql: "SELECT t.id, t.chapter_id, t.name, t.order_num, t.status, COALESCE(tpm.ppt_url, t.topic_ppt_path) AS topic_ppt_path FROM topics t LEFT JOIN (SELECT topic_id, MAX(id) AS latest_id FROM topic_ppt_materials GROUP BY topic_id) latest_tpm ON latest_tpm.topic_id = t.id LEFT JOIN topic_ppt_materials tpm ON tpm.id = latest_tpm.latest_id ORDER BY t.chapter_id, t.order_num"
  },
  {
    name: "topicMaterials",
    sql: "SELECT id, topic_id, 'ppt' AS type, COALESCE(title,'PPT') AS title, ppt_url AS url FROM topic_ppt_materials"
  },
  {
    name: "topicMicroLessons",
    sql: "SELECT id, topic_id, period_no, concept_text, plan_text FROM topic_micro_lessons ORDER BY topic_id, period_no"
  },
  {
    name: "quizzes",
    sql: "SELECT id, id AS chapter_id FROM chapters WHERE 1=0"
  },
  {
    name: "quizResults",
    sql: "SELECT id, student_id, chapter_id, assessment_type, score, total, assessed_on AS taken_on FROM student_marks ORDER BY assessed_on DESC, id DESC"
  },
  {
    name: "attendance",
    sql: "SELECT * FROM attendance"
  },
  {
    name: "teacherLeaves",
    sql: "SELECT * FROM teacher_leaves"
  },
  {
    name: "classRecordings",
    sql: "SELECT * FROM class_recordings"
  },
  {
    name: "homework",
    sql: "SELECT * FROM homework"
  },
  {
    name: "studyMaterials",
    sql: "SELECT CONCAT('ch-', ctm.id) AS id, ctm.chapter_id, 'textbook' AS type, COALESCE(ctm.title, 'Chapter textbook') AS title, ctm.pdf_url AS url FROM chapter_textual_materials ctm UNION ALL SELECT CONCAT('tp-', tpm.id) AS id, t.chapter_id, 'ppt' AS type, COALESCE(tpm.title, 'Topic PPT') AS title, tpm.ppt_url AS url FROM topic_ppt_materials tpm JOIN topics t ON t.id = tpm.topic_id"
  },
  {
    name: "liveSessions",
    sql: "SELECT * FROM live_sessions"
  },
  {
    name: "admins",
    sql: "SELECT id, email, name AS full_name, role FROM admins"
  },
  {
    name: "syllabus",
    sql: "SELECT * FROM chapter_syllabus"
  },
  {
    name: "teacherEffectiveness",
    sql: "SELECT tps.teacher_id, t.school_id, t.full_name AS name, ROUND(CASE WHEN MAX(tps.classes_conducted + tps.classes_cancelled) > 0 THEN (MAX(tps.classes_conducted) / MAX(tps.classes_conducted + tps.classes_cancelled)) * 100 ELSE 0 END) AS lesson_completion_rate, ROUND(CASE WHEN MAX(tps.quizzes_conducted) > 0 THEN ((MAX(tps.quiz_participants) - MAX(tps.quiz_absent)) / MAX(tps.quiz_participants)) * 100 ELSE 0 END) AS student_engagement, ROUND(CASE WHEN COUNT(sm.id) > 0 THEN AVG((sm.score / NULLIF(sm.total, 0)) * 100) ELSE 0 END) AS quiz_avg_score, MAX(tps.classes_conducted) AS classes_completed, MAX(tps.classes_conducted + tps.classes_cancelled) AS total_scheduled, ROUND((ROUND(CASE WHEN MAX(tps.classes_conducted + tps.classes_cancelled) > 0 THEN (MAX(tps.classes_conducted) / MAX(tps.classes_conducted + tps.classes_cancelled)) * 100 ELSE 0 END) + ROUND(CASE WHEN COUNT(sm.id) > 0 THEN AVG((sm.score / NULLIF(sm.total, 0)) * 100) ELSE 0 END) + ROUND(CASE WHEN MAX(tps.quizzes_conducted) > 0 THEN ((MAX(tps.quiz_participants) - MAX(tps.quiz_absent)) / MAX(tps.quiz_participants)) * 100 ELSE 0 END)) / 60, 1) AS rating FROM teacher_performance_snapshots tps JOIN teachers t ON t.id = tps.teacher_id LEFT JOIN live_sessions ls ON ls.teacher_id = t.id AND ls.session_date BETWEEN '2026-02-01' AND '2026-02-28' LEFT JOIN live_quiz_sessions lqs ON lqs.live_session_id = ls.id LEFT JOIN student_marks sm ON sm.live_quiz_session_id = lqs.id WHERE tps.snapshot_date = '2026-02-28' GROUP BY tps.teacher_id, t.school_id, t.full_name"
  },
  {
    name: "topicRecommendations",
    sql: "SELECT id, id AS topic_id, chapter_id, NULL AS subject_id, 10 AS grade, name AS topic_name, NULL AS class_id, NULL AS school_id, created_at FROM topics WHERE 1=0"
  },
  {
    name: "topicRecommendationLinks",
    sql: "SELECT id, 0 AS topic_recommendation_id, 'youtube' AS type, '' AS title, '' AS url, '' AS description, 0 AS order_num FROM topic_youtube_links WHERE 1=0"
  },
  {
    name: "liveQuizSessions",
    sql: "SELECT * FROM live_quiz_sessions ORDER BY created_at DESC"
  },
  {
    name: "liveQuizQuestions",
    sql: "SELECT * FROM live_quiz_questions ORDER BY live_quiz_session_id, order_num"
  },
  {
    name: "liveQuizAnswers",
    sql: "SELECT * FROM live_quiz_answers"
  },
  {
    name: "timetable",
    sql: "SELECT class_id, week_day, period_no, subject_name, subject_id, teacher_id, start_time, end_time FROM class_timetables ORDER BY class_id, week_day, period_no"
  },
  {
    name: "activityAssignments",
    sql: "SELECT aa.id, aa.activity_id, aa.teacher_id, aa.class_id, aa.activity_date, aa.status, a.title, a.description FROM activity_assignments aa JOIN activities a ON a.id = aa.activity_id ORDER BY aa.activity_date DESC, aa.id DESC"
  },
  {
    name: "activityParticipation",
    sql: "SELECT activity_assignment_id, student_id, status FROM activity_participation"
  },
  {
    name: "subjectMaterials",
    sql: "SELECT id, subject_id, grade_id, title, file_path AS url FROM subject_materials"
  }
];

async function main() {
  const db = getPool();
  console.log("Testing individual queries for GET /api/all...");

  for (const q of queries) {
    try {
      await db.query(q.sql);
      console.log(`✅ Query "${q.name}" PASSED`);
    } catch (err) {
      console.error(`❌ Query "${q.name}" FAILED:`, err.message);
    }
  }

  process.exit(0);
}

main();

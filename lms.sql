-- LMS database schema (MySQL)
-- Phase 1: Roles + School/Class/Section + Students roll_no + static QR codes
-- Next phases (syllabus/materials, quizzes, attendance, performance) will extend this file.

DROP DATABASE IF EXISTS railway;

CREATE DATABASE railway
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE railway;

-- =========================
-- Schools / Class structure
-- =========================

CREATE TABLE IF NOT EXISTS schools (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  school_code CHAR(4) NOT NULL UNIQUE, -- used for roll_no suffix (last 2 chars)
  school_name VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grades (
  id SMALLINT UNSIGNED NOT NULL PRIMARY KEY, -- expected: 6..10
  grade_label VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  school_id INT UNSIGNED NOT NULL,
  grade_id SMALLINT UNSIGNED NOT NULL,
  section_code VARCHAR(10) NOT NULL, -- currently A/B/C/D, future-proof as text
  UNIQUE KEY uq_school_grade_section (school_id, grade_id, section_code),
  CONSTRAINT fk_sections_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_sections_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================
-- Subjects (for teacher assignment)
-- =========================

CREATE TABLE IF NOT EXISTS subjects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Optional normalization: which subjects belong to which grade.
-- You will seed this based on grade->subject mapping.
CREATE TABLE IF NOT EXISTS grade_subjects (
  grade_id SMALLINT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (grade_id, subject_id),
  CONSTRAINT fk_grade_subjects_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
  CONSTRAINT fk_grade_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- Roles
-- =========================

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, -- displayed as 4-digit in UI (0001..)
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teachers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, -- displayed as 4-digit in UI (0001..)
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'teacher',
  school_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NULL, -- assigned/updated later by admin (one subject per teacher)
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_teachers_school (school_id),
  CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_teachers_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Admins can own multiple schools
CREATE TABLE IF NOT EXISTS admin_schools (
  admin_id INT UNSIGNED NOT NULL,
  school_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (admin_id, school_id),
  CONSTRAINT fk_admin_schools_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_schools_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Teacher QR: one QR id-card per teacher (token maps back to teacher_id)
CREATE TABLE IF NOT EXISTS teacher_qr_codes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL UNIQUE,
  qr_code_value VARCHAR(80) NOT NULL UNIQUE,
  qr_image_path VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_qr_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  school_id INT UNSIGNED NOT NULL,
  section_id INT UNSIGNED NOT NULL, -- includes grade+section
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  password VARCHAR(255) NULL,

  joined_at DATE NOT NULL DEFAULT (CURDATE()), -- calendar year used for roll_no YY

  -- roll_no format:
  -- YY + scl_last2 + class_2digits + roll_seq_4digits
  -- YY = YEAR(joined_at) last two digits
  -- scl_last2 = RIGHT(schools.school_code, 2)
  -- class_2digits = RIGHT(LPAD(sections.grade_id, 2, '0'), 2) (grade 6..10 => 06..10)
  -- roll_seq_4digits = sequential within (school_id, section_id, YY)
  roll_year TINYINT UNSIGNED NOT NULL,
  roll_seq INT UNSIGNED NOT NULL,
  roll_no VARCHAR(24) NOT NULL UNIQUE,

  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_students_school_section_year (school_id, section_id, roll_year),
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_students_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Student QR tokens (5 static QR codes per student)
-- 1) DATA QR (student identity payload)
-- 2-5) Answer QRs: A/B/C/D tokens mapped to roll_no
CREATE TABLE IF NOT EXISTS student_qr_codes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  qr_type ENUM('DATA','A','B','C','D') NOT NULL,
  qr_code_value VARCHAR(80) NOT NULL UNIQUE,
  qr_image_path VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_qr_type (student_id, qr_type),
  CONSTRAINT fk_student_qr_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- Triggers: students roll_no + QR generation
-- =========================

DELIMITER $$

-- Generate:
-- - roll_year from joined_at
-- - roll_seq (reset per year+school+section)
-- - roll_no string following your required format
CREATE TRIGGER trg_students_before_insert_rollno
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
  DECLARE v_roll_year TINYINT UNSIGNED;
  DECLARE v_school_suffix CHAR(2);
  DECLARE v_grade_id SMALLINT UNSIGNED;
  DECLARE v_next_seq INT UNSIGNED;

  SET v_roll_year = YEAR(COALESCE(NEW.joined_at, CURDATE())) % 100;

  SELECT RIGHT(s.school_code, 2), sec.grade_id
    INTO v_school_suffix, v_grade_id
  FROM schools s
  JOIN sections sec ON sec.id = NEW.section_id
  WHERE s.id = NEW.school_id
  LIMIT 1;

  -- Next sequence within (school_id, section_id, YY)
  SELECT COALESCE(MAX(st.roll_seq), 0) + 1
    INTO v_next_seq
  FROM students st
  WHERE st.school_id = NEW.school_id
    AND st.section_id = NEW.section_id
    AND st.roll_year = v_roll_year;

  SET NEW.roll_year = v_roll_year;
  SET NEW.roll_seq = v_next_seq;
  SET NEW.roll_no = CONCAT(
    LPAD(v_roll_year, 2, '0'),
    v_school_suffix,
    LPAD(v_grade_id, 2, '0'),
    LPAD(v_next_seq, 4, '0')
  );
END$$

-- Create 5 static QR tokens after student insert.
CREATE TRIGGER trg_students_after_insert_qrcodes
AFTER INSERT ON students
FOR EACH ROW
BEGIN
  -- Student DATA QR token
  INSERT INTO student_qr_codes (student_id, qr_type, qr_code_value, qr_image_path)
  VALUES (NEW.id, 'DATA', CONCAT('stu', NEW.roll_no, '_DATA'), NULL);

  -- Answer tokens A/B/C/D
  INSERT INTO student_qr_codes (student_id, qr_type, qr_code_value, qr_image_path) VALUES
    (NEW.id, 'A', CONCAT('stu', NEW.roll_no, '_A'), NULL),
    (NEW.id, 'B', CONCAT('stu', NEW.roll_no, '_B'), NULL),
    (NEW.id, 'C', CONCAT('stu', NEW.roll_no, '_C'), NULL),
    (NEW.id, 'D', CONCAT('stu', NEW.roll_no, '_D'), NULL);
END$$

-- Create teacher QR id-card token after teacher insert.
CREATE TRIGGER trg_teachers_after_insert_qrcodes
AFTER INSERT ON teachers
FOR EACH ROW
BEGIN
  INSERT INTO teacher_qr_codes (teacher_id, qr_code_value, qr_image_path)
  VALUES (NEW.id, CONCAT('tea', LPAD(NEW.id, 4, '0'), '_ID'), NULL);
END$$

DELIMITER ;

-- =========================
-- Helpful indexes
-- =========================

CREATE INDEX idx_student_qr_code_value ON student_qr_codes (qr_code_value);
CREATE INDEX idx_teacher_qr_code_value ON teacher_qr_codes (qr_code_value);

-- =========================
-- Notes / Next phases
-- =========================
-- Phase 2: Syllabus + Materials + Quizzes + Attendance + Co-curricular + Performance
-- =========================

-- -------------------------
-- Curriculum / Syllabus tables
-- -------------------------

-- chapters: your "month-wise lesson plan" (macro plan) per subject+grade
CREATE TABLE IF NOT EXISTS chapters (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject_id INT UNSIGNED NOT NULL,
  grade_id SMALLINT UNSIGNED NOT NULL,
  chapter_no INT UNSIGNED NOT NULL,
  chapter_name VARCHAR(255) NOT NULL,
  macro_month_label VARCHAR(50) NULL,
  macro_week_range VARCHAR(50) NULL,
  planned_periods TINYINT UNSIGNED NULL,
  teaching_plan_summary TEXT NULL,
  UNIQUE KEY uq_subject_grade_chapter_no (subject_id, grade_id, chapter_no),
  CONSTRAINT fk_chapters_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_chapters_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- topics: sub-category of each chapter (what you later update manually)
CREATE TABLE IF NOT EXISTS topics (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  chapter_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  order_num INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('not_started','planned','in_progress','completed') NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_topic_order (chapter_id, order_num),
  CONSTRAINT fk_topics_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- topic_micro_lessons: "PART 2: MICRO LESSON PLAN" (TOC + period division)
CREATE TABLE IF NOT EXISTS topic_micro_lessons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  period_no INT UNSIGNED NOT NULL, -- P1, P2, ...
  concept_text TEXT NULL,
  plan_text TEXT NULL,
  UNIQUE KEY uq_topic_period (topic_id, period_no),
  CONSTRAINT fk_tml_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Per-student marks / scores (chapter-level assessments; drives studentQuizResults in API)
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

-- -------------------------
-- Materials tables (teacher will save after AI generation)
-- -------------------------

CREATE TABLE IF NOT EXISTS chapter_textual_materials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  chapter_id INT UNSIGNED NOT NULL,
  pdf_url VARCHAR(1024) NOT NULL,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  created_by_teacher_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ctm_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  CONSTRAINT fk_ctm_teacher FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Topic PPT: store the PPT path/url (there will usually be one active PPT per topic)
CREATE TABLE IF NOT EXISTS topic_ppt_materials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  ppt_url VARCHAR(1024) NOT NULL,
  title VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_teacher_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tpm_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_tpm_teacher FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE KEY uq_active_topic_ppt (topic_id, is_active)
) ENGINE=InnoDB;

-- Topic external links: 5 YouTube + 5 E-resources
CREATE TABLE IF NOT EXISTS topic_youtube_links (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  url VARCHAR(1024) NOT NULL,
  title VARCHAR(255) NULL,
  order_num TINYINT UNSIGNED NOT NULL,
  created_by_teacher_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tyl_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_tyl_teacher FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE KEY uq_topic_youtube_order (topic_id, order_num)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topic_e_resource_links (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  url VARCHAR(1024) NOT NULL,
  title VARCHAR(255) NULL,
  order_num TINYINT UNSIGNED NOT NULL,
  created_by_teacher_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_terl_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_terl_teacher FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE KEY uq_topic_eresource_order (topic_id, order_num)
) ENGINE=InnoDB;

-- Topic quiz bank: store questions generated by AI for each topic
CREATE TABLE IF NOT EXISTS topic_quiz_bank (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  option_a VARCHAR(512) NOT NULL,
  option_b VARCHAR(512) NOT NULL,
  option_c VARCHAR(512) NOT NULL,
  option_d VARCHAR(512) NOT NULL,
  correct_option CHAR(1) NOT NULL COMMENT 'A,B,C or D',
  explanation TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tqb_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------
-- Live teaching sessions + Attendance
-- -------------------------

CREATE TABLE IF NOT EXISTS live_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL, -- maps to sections.id (grade+section)
  subject_id INT UNSIGNED NOT NULL,
  chapter_id INT UNSIGNED NULL,
  topic_id INT UNSIGNED NULL,
  topic_name VARCHAR(255) NULL,
  start_time DATETIME NOT NULL,
  session_date DATE NOT NULL,
  status ENUM('active','ended','cancelled') NOT NULL DEFAULT 'active',
  attendance_marked TINYINT(1) NOT NULL DEFAULT 0,
  quiz_submitted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_live_sessions_teacher_date (teacher_id, session_date),
  CONSTRAINT fk_ls_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ls_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_ls_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ls_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
  CONSTRAINT fk_ls_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- attendance (per class_id + calendar date)
CREATE TABLE IF NOT EXISTS attendance (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL, -- sections.id
  date DATE NOT NULL,
  status ENUM('present','absent') NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_student_class_date (student_id, class_id, date),
  INDEX idx_attendance_class_date (class_id, date),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- teacher stats require absent roll numbers as string:
-- we keep it per class/date (teacher can be derived from live_sessions)
CREATE TABLE IF NOT EXISTS class_attendance_summary (
  class_id INT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  present_count INT UNSIGNED NOT NULL DEFAULT 0,
  absent_count INT UNSIGNED NOT NULL DEFAULT 0,
  absent_roll_nos TEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, attendance_date),
  CONSTRAINT fk_cas_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Stored procedure: recompute class_attendance_summary for (class_id, date)
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_recompute_class_attendance_summary $$
CREATE PROCEDURE sp_recompute_class_attendance_summary(IN p_class_id INT UNSIGNED, IN p_date DATE)
BEGIN
  DECLARE v_present INT UNSIGNED DEFAULT 0;
  DECLARE v_absent INT UNSIGNED DEFAULT 0;
  DECLARE v_absent_rolls TEXT;

  SELECT
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END),
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END),
    GROUP_CONCAT(st.roll_no ORDER BY st.roll_no SEPARATOR ',')
  INTO
    v_present,
    v_absent,
    v_absent_rolls
  FROM attendance a
  JOIN students st ON st.id = a.student_id
  WHERE a.class_id = p_class_id AND a.date = p_date AND a.status = 'absent';

  -- If there are no absent rows, GROUP_CONCAT returns NULL; keep it as NULL.
  -- Recompute present/absent counts separately to avoid NULL edge-cases above.
  SELECT
    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)
  INTO v_present, v_absent
  FROM attendance
  WHERE class_id = p_class_id AND date = p_date;

  INSERT INTO class_attendance_summary (class_id, attendance_date, present_count, absent_count, absent_roll_nos)
  VALUES (p_class_id, p_date, COALESCE(v_present, 0), COALESCE(v_absent, 0), v_absent_rolls)
  ON DUPLICATE KEY UPDATE
    present_count = VALUES(present_count),
    absent_count = VALUES(absent_count),
    absent_roll_nos = VALUES(absent_roll_nos);
END$$
DELIMITER ;

-- Triggers to keep summary up to date when attendance changes
DELIMITER $$
DROP TRIGGER IF EXISTS trg_attendance_after_insert $$
CREATE TRIGGER trg_attendance_after_insert
AFTER INSERT ON attendance
FOR EACH ROW
BEGIN
  CALL sp_recompute_class_attendance_summary(NEW.class_id, NEW.date);
END$$

DROP TRIGGER IF EXISTS trg_attendance_after_update $$
CREATE TRIGGER trg_attendance_after_update
AFTER UPDATE ON attendance
FOR EACH ROW
BEGIN
  CALL sp_recompute_class_attendance_summary(NEW.class_id, NEW.date);
END$$

DROP TRIGGER IF EXISTS trg_attendance_after_delete $$
CREATE TRIGGER trg_attendance_after_delete
AFTER DELETE ON attendance
FOR EACH ROW
BEGIN
  CALL sp_recompute_class_attendance_summary(OLD.class_id, OLD.date);
END$$
DELIMITER ;

-- -------------------------
-- Quiz tables (class/lesson/topic) with answer tracking + summaries
-- -------------------------

CREATE TABLE IF NOT EXISTS live_quiz_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL, -- sections.id
  chapter_id INT UNSIGNED NULL,
  topic_id INT UNSIGNED NULL,
  topic_name VARCHAR(255) NOT NULL,
  subject_id INT UNSIGNED NOT NULL,

  quiz_scope ENUM('LESSON','TOPIC','CLASS') NOT NULL DEFAULT 'TOPIC',
  lesson_mode ENUM('easy','modern','hard') NULL, -- only meaningful for LESSON quizzes

  status ENUM('active','ended') NOT NULL DEFAULT 'active',
  live_session_id INT UNSIGNED NULL, -- one quiz per live teaching session
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_livequiz_live_session (live_session_id),

  INDEX idx_livequiz_teacher_date (teacher_id, created_at),

  CONSTRAINT fk_lqs_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_lqs_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_lqs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_lqs_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
  CONSTRAINT fk_lqs_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
  CONSTRAINT fk_lqs_live_session FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Enforce one mark row per student per live quiz (manual rows keep live_quiz_session_id NULL)
ALTER TABLE student_marks
  ADD UNIQUE KEY uq_sm_student_live_quiz (student_id, live_quiz_session_id);

CREATE TABLE IF NOT EXISTS live_quiz_questions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  live_quiz_session_id INT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  option_a VARCHAR(512) NOT NULL,
  option_b VARCHAR(512) NOT NULL,
  option_c VARCHAR(512) NOT NULL,
  option_d VARCHAR(512) NOT NULL,
  correct_option CHAR(1) NOT NULL COMMENT 'A,B,C or D',
  explanation TEXT NULL,
  order_num INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lqq_session_order (live_quiz_session_id, order_num),
  CONSTRAINT fk_lqq_session FOREIGN KEY (live_quiz_session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS live_quiz_answers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  live_quiz_session_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  selected_option CHAR(1) NOT NULL COMMENT 'A,B,C or D',
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_livequiz_answer (live_quiz_session_id, student_id, question_id),
  INDEX idx_lqa_session_student (live_quiz_session_id, student_id),
  CONSTRAINT fk_lqa_session FOREIGN KEY (live_quiz_session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lqa_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_lqa_question FOREIGN KEY (question_id) REFERENCES live_quiz_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Quiz summary: counts + top 5 string (for teacher metrics)
CREATE TABLE IF NOT EXISTS quiz_session_summary (
  live_quiz_session_id INT UNSIGNED NOT NULL PRIMARY KEY,
  total_enrolled INT UNSIGNED NOT NULL DEFAULT 0,
  participants INT UNSIGNED NOT NULL DEFAULT 0,
  absent INT UNSIGNED NOT NULL DEFAULT 0,
  top_scorers TEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_qss_livequiz FOREIGN KEY (live_quiz_session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DELIMITER $$
DROP PROCEDURE IF EXISTS sp_recompute_quiz_session_summary $$
CREATE PROCEDURE sp_recompute_quiz_session_summary(IN p_live_quiz_session_id INT UNSIGNED)
BEGIN
  DECLARE v_class_id INT UNSIGNED;
  DECLARE v_total INT UNSIGNED DEFAULT 0;
  DECLARE v_participants INT UNSIGNED DEFAULT 0;
  DECLARE v_absent INT UNSIGNED DEFAULT 0;
  DECLARE v_top_scorers TEXT;

  SELECT class_id INTO v_class_id
  FROM live_quiz_sessions
  WHERE id = p_live_quiz_session_id;

  SELECT COUNT(*) INTO v_total
  FROM students
  WHERE section_id = v_class_id;

  SELECT COUNT(DISTINCT student_id) INTO v_participants
  FROM live_quiz_answers
  WHERE live_quiz_session_id = p_live_quiz_session_id;

  SET v_absent = COALESCE(v_total, 0) - COALESCE(v_participants, 0);

  SELECT
    GROUP_CONCAT(
      CONCAT_WS(':',
        CONCAT(st.first_name, ' ', st.last_name),
        CAST(score AS CHAR)
      )
      ORDER BY score DESC SEPARATOR ' | '
    )
  INTO v_top_scorers
  FROM (
    SELECT student_id, SUM(is_correct) AS score
    FROM live_quiz_answers
    WHERE live_quiz_session_id = p_live_quiz_session_id
    GROUP BY student_id
    ORDER BY score DESC
    LIMIT 5
  ) t
  JOIN students st ON st.id = t.student_id;

  INSERT INTO quiz_session_summary (live_quiz_session_id, total_enrolled, participants, absent, top_scorers)
  VALUES (p_live_quiz_session_id, v_total, v_participants, v_absent, v_top_scorers)
  ON DUPLICATE KEY UPDATE
    total_enrolled = VALUES(total_enrolled),
    participants = VALUES(participants),
    absent = VALUES(absent),
    top_scorers = VALUES(top_scorers);
END$$
DELIMITER ;

DELIMITER $$
DROP TRIGGER IF EXISTS trg_live_quiz_sessions_after_end $$
CREATE TRIGGER trg_live_quiz_sessions_after_end
AFTER UPDATE ON live_quiz_sessions
FOR EACH ROW
BEGIN
  IF NEW.status = 'ended' AND OLD.status <> 'ended' THEN
    CALL sp_recompute_quiz_session_summary(NEW.id);
  END IF;
END$$
DELIMITER ;

-- -------------------------
-- Co-curricular activities
-- -------------------------

CREATE TABLE IF NOT EXISTS activities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_activities_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_id INT UNSIGNED NOT NULL,
  teacher_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NULL, -- optional: assign for a specific class/section
  assigned_by_admin_id INT UNSIGNED NOT NULL,
  activity_date DATE NULL,
  status ENUM('assigned','in_progress','completed') NOT NULL DEFAULT 'assigned',
  assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_aa_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_aa_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_aa_admin FOREIGN KEY (assigned_by_admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  CONSTRAINT fk_aa_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Optional: track students who participated (so later you can compute stats)
CREATE TABLE IF NOT EXISTS activity_participation (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_assignment_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  status ENUM('participated','absent') NOT NULL DEFAULT 'participated',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_activity_participant (activity_assignment_id, student_id),
  CONSTRAINT fk_ap_assignment FOREIGN KEY (activity_assignment_id) REFERENCES activity_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------
-- Teacher performance scaffolding (to be populated by app logic or future triggers)
-- -------------------------

-- This is a snapshot table; app can refresh it periodically / after session end.
CREATE TABLE IF NOT EXISTS teacher_performance_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  snapshot_date DATE NOT NULL,
  class_id INT UNSIGNED NULL,

  total_students_present INT UNSIGNED NOT NULL DEFAULT 0,
  total_students_absent INT UNSIGNED NOT NULL DEFAULT 0,
  absent_roll_nos TEXT NULL,

  classes_conducted INT UNSIGNED NOT NULL DEFAULT 0,
  classes_cancelled INT UNSIGNED NOT NULL DEFAULT 0,

  quizzes_conducted INT UNSIGNED NOT NULL DEFAULT 0,
  subjects_quizzes_conducted INT UNSIGNED NOT NULL DEFAULT 0,
  quiz_participants INT UNSIGNED NOT NULL DEFAULT 0,
  quiz_absent INT UNSIGNED NOT NULL DEFAULT 0,
  top_scorers TEXT NULL,

  topic_quizzes_conducted INT UNSIGNED NOT NULL DEFAULT 0,
  topics_covered INT UNSIGNED NOT NULL DEFAULT 0,
  completed_topics INT UNSIGNED NOT NULL DEFAULT 0,

  extra_curricular_conducted INT UNSIGNED NOT NULL DEFAULT 0,

  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tps_teacher_date (teacher_id, snapshot_date),
  CONSTRAINT fk_tps_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_tps_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================
-- End of Phase 2
-- =========================

-- =========================
-- Demo Seed Data (Feb 2026)
-- =========================

-- One school for now (schema supports many schools).
INSERT INTO schools (school_code, school_name)
VALUES ('0001', 'ZPHS Adilabad');

-- Grades 6-10
INSERT INTO grades (id, grade_label) VALUES
  (6, 'Class 6'),
  (7, 'Class 7'),
  (8, 'Class 8'),
  (9, 'Class 9'),
  (10, 'Class 10');

-- Sections A-D for scalability (currently demo uses only 10-A)
INSERT INTO sections (school_id, grade_id, section_code) VALUES
  (1, 6, 'A'), (1, 6, 'B'), (1, 6, 'C'), (1, 6, 'D'),
  (1, 7, 'A'), (1, 7, 'B'), (1, 7, 'C'), (1, 7, 'D'),
  (1, 8, 'A'), (1, 8, 'B'), (1, 8, 'C'), (1, 8, 'D'),
  (1, 9, 'A'), (1, 9, 'B'), (1, 9, 'C'), (1, 9, 'D'),
  (1, 10, 'A'), (1, 10, 'B'), (1, 10, 'C'), (1, 10, 'D');

-- Subjects for Class 10
INSERT INTO subjects (subject_name) VALUES
  ('Telugu'),
  ('Hindi'),
  ('English'),
  ('Mathematics'),
  ('Physics'),
  ('Biology'),
  ('Social Studies');

INSERT INTO grade_subjects (grade_id, subject_id)
SELECT 10, s.id FROM subjects s WHERE s.subject_name IN
  ('Telugu', 'Hindi', 'English', 'Mathematics', 'Physics', 'Biology', 'Social Studies');

-- 2 Admins
INSERT INTO admins (name, email, password, role) VALUES
  ('Srinivas Reddy', 'srinivas.reddy@zphs.edu', 'admin123', 'admin'),
  ('Lakshmi Devi', 'lakshmi.devi@zphs.edu', 'admin123', 'admin');

INSERT INTO admin_schools (admin_id, school_id) VALUES
  (1, 1),
  (2, 1);

-- 7 Teachers for 10th class subjects
INSERT INTO teachers (full_name, email, password, role, school_id, subject_id) VALUES
  ('Ravi Kumar', 'ravi.telugu@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'Telugu')),
  ('Anita Sharma', 'anita.hindi@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'Hindi')),
  ('John Peter', 'john.english@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'English')),
  ('Suresh Babu', 'suresh.math@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'Mathematics')),
  ('Farhan Ali', 'farhan.physics@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'Physics')),
  ('Priyanka Rao', 'priyanka.biology@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'Biology')),
  ('Meena Joshi', 'meena.social@zphs.edu', 'teach123', 'teacher', 1, (SELECT id FROM subjects WHERE subject_name = 'Social Studies'));

-- 30 students in 10-A (15 boys + 15 girls)
INSERT INTO students (school_id, section_id, first_name, last_name, password, joined_at) VALUES
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Aarav', 'Reddy', 'stud123', '2026-02-02'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Vihaan', 'Kumar', 'stud123', '2026-02-02'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Aditya', 'Varma', 'stud123', '2026-02-03'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Sai', 'Teja', 'stud123', '2026-02-03'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Arjun', 'Naik', 'stud123', '2026-02-04'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Nikhil', 'Yadav', 'stud123', '2026-02-04'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Karthik', 'Goud', 'stud123', '2026-02-05'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Manoj', 'Rao', 'stud123', '2026-02-05'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Rohit', 'Sharma', 'stud123', '2026-02-06'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Harsha', 'Mohan', 'stud123', '2026-02-06'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Vivek', 'Patel', 'stud123', '2026-02-09'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Tarun', 'Singh', 'stud123', '2026-02-09'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Rahul', 'Chary', 'stud123', '2026-02-10'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Akhil', 'Das', 'stud123', '2026-02-10'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Pranav', 'Kiran', 'stud123', '2026-02-11'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Saanvi', 'Reddy', 'stud123', '2026-02-02'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Ananya', 'Kumari', 'stud123', '2026-02-02'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Ishita', 'Shah', 'stud123', '2026-02-03'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Diya', 'Nair', 'stud123', '2026-02-03'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Kavya', 'Rani', 'stud123', '2026-02-04'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Sneha', 'Patel', 'stud123', '2026-02-04'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Nitya', 'Verma', 'stud123', '2026-02-05'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Pooja', 'Yadav', 'stud123', '2026-02-05'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Keerthi', 'Rao', 'stud123', '2026-02-06'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Aishwarya', 'Joshi', 'stud123', '2026-02-06'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Mounika', 'Garg', 'stud123', '2026-02-09'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Bhavya', 'Soni', 'stud123', '2026-02-09'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Harini', 'Mishra', 'stud123', '2026-02-10'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Tejaswini', 'Naidu', 'stud123', '2026-02-10'),
  (1, (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 'Nandini', 'Kulkarni', 'stud123', '2026-02-11');

-- February 2026 academic working days (Mon–Sat; Sundays 1,8,15,22 off): 24 days
-- Class 10-A: 7 periods per day (one live session per subject) => 24 × 7 = 168 live_sessions
INSERT INTO live_sessions
  (teacher_id, class_id, subject_id, chapter_id, topic_id, topic_name, start_time, session_date, status, attendance_marked, quiz_submitted)
SELECT
  slot.teacher_id,
  sec.id,
  subj.id,
  NULL,
  NULL,
  CONCAT(subj.subject_name, ' Session'),
  STR_TO_DATE(CONCAT(cal.d, ' ', slot.period_time), '%Y-%m-%d %H:%i:%s'),
  cal.d,
  'ended',
  1,
  0
FROM (
  SELECT '2026-02-02' AS d UNION ALL SELECT '2026-02-03' UNION ALL SELECT '2026-02-04' UNION ALL SELECT '2026-02-05'
  UNION ALL SELECT '2026-02-06' UNION ALL SELECT '2026-02-07' UNION ALL SELECT '2026-02-09' UNION ALL SELECT '2026-02-10'
  UNION ALL SELECT '2026-02-11' UNION ALL SELECT '2026-02-12' UNION ALL SELECT '2026-02-13' UNION ALL SELECT '2026-02-14'
  UNION ALL SELECT '2026-02-16' UNION ALL SELECT '2026-02-17' UNION ALL SELECT '2026-02-18' UNION ALL SELECT '2026-02-19'
  UNION ALL SELECT '2026-02-20' UNION ALL SELECT '2026-02-21' UNION ALL SELECT '2026-02-23' UNION ALL SELECT '2026-02-24'
  UNION ALL SELECT '2026-02-25' UNION ALL SELECT '2026-02-26' UNION ALL SELECT '2026-02-27' UNION ALL SELECT '2026-02-28'
) cal
CROSS JOIN (
  SELECT 1 AS teacher_id, 'Telugu' AS subject_name, '09:30:00' AS period_time
  UNION ALL SELECT 2, 'Hindi', '10:20:00'
  UNION ALL SELECT 3, 'English', '11:10:00'
  UNION ALL SELECT 4, 'Mathematics', '12:00:00'
  UNION ALL SELECT 5, 'Physics', '13:45:00'
  UNION ALL SELECT 6, 'Biology', '14:35:00'
  UNION ALL SELECT 7, 'Social Studies', '15:25:00'
) slot
JOIN subjects subj ON subj.subject_name = slot.subject_name
JOIN sections sec ON sec.school_id = 1 AND sec.grade_id = 10 AND sec.section_code = 'A';

-- Daily attendance for 10-A: all students × each working day (demo: mostly present; see updates below)
INSERT INTO attendance (student_id, class_id, date, status)
SELECT st.id, st.section_id, cal.d, 'present'
FROM students st
CROSS JOIN (
  SELECT '2026-02-02' AS d UNION ALL SELECT '2026-02-03' UNION ALL SELECT '2026-02-04' UNION ALL SELECT '2026-02-05'
  UNION ALL SELECT '2026-02-06' UNION ALL SELECT '2026-02-07' UNION ALL SELECT '2026-02-09' UNION ALL SELECT '2026-02-10'
  UNION ALL SELECT '2026-02-11' UNION ALL SELECT '2026-02-12' UNION ALL SELECT '2026-02-13' UNION ALL SELECT '2026-02-14'
  UNION ALL SELECT '2026-02-16' UNION ALL SELECT '2026-02-17' UNION ALL SELECT '2026-02-18' UNION ALL SELECT '2026-02-19'
  UNION ALL SELECT '2026-02-20' UNION ALL SELECT '2026-02-21' UNION ALL SELECT '2026-02-23' UNION ALL SELECT '2026-02-24'
  UNION ALL SELECT '2026-02-25' UNION ALL SELECT '2026-02-26' UNION ALL SELECT '2026-02-27' UNION ALL SELECT '2026-02-28'
) cal
WHERE st.section_id = (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A');

-- Sample absents for realistic demo (class_attendance_summary updates via triggers)
UPDATE attendance a
JOIN students st ON st.id = a.student_id
SET a.status = 'absent'
WHERE a.date = '2026-02-12' AND st.first_name IN ('Rohit', 'Sneha');

UPDATE attendance a
JOIN students st ON st.id = a.student_id
SET a.status = 'absent'
WHERE a.date = '2026-02-20' AND st.first_name IN ('Vihaan', 'Kavya');

UPDATE attendance a
JOIN students st ON st.id = a.student_id
SET a.status = 'absent'
WHERE a.date = '2026-02-25' AND st.first_name IN ('Nikhil', 'Harini');

-- End-of-month teacher snapshot (Feb 2026): each teacher = 24 live classes (one period/day for their subject); extra_curricular from co-curricular assignments
INSERT INTO teacher_performance_snapshots
  (teacher_id, snapshot_date, class_id, total_students_present, total_students_absent, absent_roll_nos, classes_conducted, classes_cancelled,
   quizzes_conducted, subjects_quizzes_conducted, quiz_participants, quiz_absent, top_scorers, topic_quizzes_conducted, topics_covered, completed_topics, extra_curricular_conducted)
VALUES
  (1, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 0),
  (2, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 1),
  (3, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 2),
  (4, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 1),
  (5, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 2),
  (6, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 1),
  (7, '2026-02-28', (SELECT id FROM sections WHERE school_id = 1 AND grade_id = 10 AND section_code = 'A'), 28, 2, NULL, 24, 0, 0, 0, 0, 0, NULL, 0, 24, 8, 3);

-- Saturday co-curricular activities:
-- Every Saturday: 2 activities (subject-wise + art)
-- 2nd and 4th Saturday: extra physical game
INSERT INTO activities (admin_id, title, description) VALUES
  (1, 'Science Model Presentation - 07 Feb', 'Subject-wise activity for Class 10-A'),
  (1, 'Creative Poster Making - 07 Feb', 'Art activity for Class 10-A'),
  (1, 'Math Lab Challenge - 14 Feb', 'Subject-wise activity for Class 10-A'),
  (1, 'Sketch & Color Workshop - 14 Feb', 'Art activity for Class 10-A'),
  (1, 'Kho-Kho Tournament - 14 Feb', 'Physical game add-on for 2nd Saturday'),
  (1, 'Social Debate Forum - 21 Feb', 'Subject-wise activity for Class 10-A'),
  (1, 'Craft & Clay Session - 21 Feb', 'Art activity for Class 10-A'),
  (1, 'Physics Practical Expo - 28 Feb', 'Subject-wise activity for Class 10-A'),
  (1, 'Fine Arts Showcase - 28 Feb', 'Art activity for Class 10-A'),
  (1, 'Volleyball Mini League - 28 Feb', 'Physical game add-on for 4th Saturday');

INSERT INTO activity_assignments (activity_id, teacher_id, class_id, assigned_by_admin_id, activity_date, status, completed_at) VALUES
  (1, 5, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-07', 'completed', '2026-02-07 16:30:00'),
  (2, 3, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-07', 'completed', '2026-02-07 16:40:00'),
  (3, 4, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-14', 'completed', '2026-02-14 16:20:00'),
  (4, 7, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-14', 'completed', '2026-02-14 16:20:00'),
  (5, 1, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-14', 'completed', '2026-02-14 17:00:00'),
  (6, 7, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-21', 'completed', '2026-02-21 16:00:00'),
  (7, 6, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-21', 'completed', '2026-02-21 16:30:00'),
  (8, 5, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-28', 'completed', '2026-02-28 16:20:00'),
  (9, 3, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-28', 'completed', '2026-02-28 16:40:00'),
  (10, 2, (SELECT id FROM sections WHERE school_id=1 AND grade_id=10 AND section_code='A'), 1, '2026-02-28', 'completed', '2026-02-28 17:00:00');

-- Every student participates in every activity (demo dataset).
INSERT INTO activity_participation (activity_assignment_id, student_id, status)
SELECT aa.id, st.id, 'participated'
FROM activity_assignments aa
JOIN students st ON st.section_id = aa.class_id;

-- =========================
-- Grade 10 Curriculum Seed (as provided)
-- =========================

-- Clean only curriculum entities before re-seeding
DELETE tml FROM topic_micro_lessons tml
JOIN topics t ON t.id = tml.topic_id
JOIN chapters c ON c.id = t.chapter_id
JOIN subjects s ON s.id = c.subject_id
WHERE c.grade_id = 10 AND s.subject_name IN ('Telugu','Hindi','English','Mathematics','Physics','Biology','Social Studies');

DELETE t FROM topics t
JOIN chapters c ON c.id = t.chapter_id
JOIN subjects s ON s.id = c.subject_id
WHERE c.grade_id = 10 AND s.subject_name IN ('Telugu','Hindi','English','Mathematics','Physics','Biology','Social Studies');

DELETE c FROM chapters c
JOIN subjects s ON s.id = c.subject_id
WHERE c.grade_id = 10 AND s.subject_name IN ('Telugu','Hindi','English','Mathematics','Physics','Biology','Social Studies');

-- TELUGU
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,1,'దానశీలము (Padyam)','June','Week 1-2',6,'Poem meaning, values, explanation'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,2,'మాతృభాష ప్రాముఖ్యత','June','Week 3-4',7,'Importance of language, prose'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,3,'కొత్తబాట','July','Week 1-2',8,'Story analysis'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,4,'నగరగీతం','July','Week 3-4',6,'Poem interpretation'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,5,'భాగ్యోదయం','August','Week 1-2',7,'Biography'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,6,'శతక మాధుర్యం','August','Week 3-4',6,'Moral values'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,7,'జీవనభాష్యం','September','Week 1-2',7,'Essay understanding'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,8,'గోల్కొండ పట్టణం','September','Week 3-4',6,'Historical essay'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,9,'భిక్షువు','October','Week 1-2',6,'Poem'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,10,'భూమిక','October','Week 3-4',6,'Literary essay'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,11,'తెలంగాణ','November','Week 1-2',6,'Telangana culture'),
((SELECT id FROM subjects WHERE subject_name='Telugu'),10,12,'రామాయణం భాగాలు (Supplementary)','November','Week 3-4',8,'Reading and understanding');

-- HINDI
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,1,'बरसते बादल','June','Week 1-2',6,'Poem explanation'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,2,'ईदगाह','June','Week 3-4',8,'Story and values'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,3,'माँ मुझे आने दे!','July','Week 2',6,'Poem'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,4,'कण-कण का अधिकारी','August','Week 1-2',6,'Poem'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,5,'लोकगीत','August','Week 3-4',6,'Essay'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,6,'अंतर्राष्ट्रीय स्तर पर हिंदी','September','Week 2',5,'Letter'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,7,'भक्ति पद','October','Week 1-2',6,'Poem'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,8,'स्वराज्य की नींव','October','Week 3-4',7,'Drama'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,9,'दक्षिण गंगा गोदावरी','November','Week 2-3',6,'Travelogue'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,10,'नीति दोहे','December','Week 1-2',5,'Poem'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,11,'जल ही जीवन है','December','Week 3',6,'Story'),
((SELECT id FROM subjects WHERE subject_name='Hindi'),10,12,'धरती के सवाल अंतरिक्ष के जवाब','January','Week 1-2',6,'Interview');

-- ENGLISH
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='English'),10,1,'Personality Development','June','Full',12,'Reading + Writing + Grammar'),
((SELECT id FROM subjects WHERE subject_name='English'),10,2,'Wit and Humour','July','Full',12,'Drama + Story'),
((SELECT id FROM subjects WHERE subject_name='English'),10,3,'Human Relations','August','Full',10,'Poem + Prose'),
((SELECT id FROM subjects WHERE subject_name='English'),10,4,'Films and Theatre','September','Full',10,'Biography + Film'),
((SELECT id FROM subjects WHERE subject_name='English'),10,5,'Social Issues','October','Full',10,'Social awareness'),
((SELECT id FROM subjects WHERE subject_name='English'),10,6,'Bio-Diversity','November','Full',10,'Environment'),
((SELECT id FROM subjects WHERE subject_name='English'),10,7,'Nation and Diversity','December','Full',10,'Unity'),
((SELECT id FROM subjects WHERE subject_name='English'),10,8,'Human Rights','January','Full',10,'Rights awareness');

-- MATHEMATICS
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,1,'Real Numbers','June','Week 1-2',15,'HCF, LCM, Euclid algorithm'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,2,'Sets','June','Week 3-4',8,'Set operations'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,3,'Polynomials','July','Week 1-2',8,'Zeros, graphs'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,4,'Pair of Linear Equations','September','Week 1-2',15,'Solving equations'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,5,'Quadratic Equations','October','Full',12,'Roots'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,6,'Progressions','January','Week 1-2',11,'AP'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,7,'Coordinate Geometry','November','Week 1-2',12,'Distance formula'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,8,'Similar Triangles','July-August','Full',18,'Theorems'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,9,'Tangents and Secants','November','Week 3-4',15,'Circle properties'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,10,'Mensuration','December','Full',10,'Surface areas'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,11,'Trigonometry','August','Full',15,'Identities'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,12,'Applications of Trigonometry','September','Week 3-4',8,'Heights and distances'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,13,'Probability','January','Week 3-4',10,'Basic probability'),
((SELECT id FROM subjects WHERE subject_name='Mathematics'),10,14,'Statistics','July','Week 3-4',15,'Mean, graphs');

-- PHYSICS (as provided list)
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='Physics'),10,1,'Reflection of Light at Curved Surfaces','June','Week 1-2',6,'Mirrors, image formation, ray diagrams'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,2,'Chemical Equations','June','Week 3-4',5,'Types, balancing, reactions'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,3,'Acids, Bases and Salts','July','Week 1-2',8,'Properties, pH scale'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,4,'Refraction of Light at Curved Surfaces','July','Week 3-4',9,'Lenses, image formation'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,5,'Human Eye and Colourful World','August','Week 1-2',8,'Eye defects, dispersion'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,6,'Structure of Atom','August','Week 3-4',7,'Atomic models'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,7,'Periodic Table','September','Week 1-2',8,'Classification, trends'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,8,'Chemical Bonding','September','Week 3-4',10,'Ionic and covalent bonds'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,9,'Electric Current','October','Week 1-2',9,'Ohm law, circuits'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,10,'Electromagnetism','October','Week 3-4',10,'Magnetic effects'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,11,'Principles of Metallurgy','November','Week 1-2',6,'Extraction of metals'),
((SELECT id FROM subjects WHERE subject_name='Physics'),10,12,'Carbon and its Compounds','November','Week 3-4',10,'Hydrocarbons');

-- BIOLOGY
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='Biology'),10,1,'Nutrition','June','Full',10,'Photosynthesis, digestion'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,2,'Respiration','July','Week 1-2',10,'Breathing, cellular respiration'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,3,'Circulation','July','Week 3-4',10,'Blood flow, heart'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,4,'Excretion','August','Week 1-2',10,'Kidney function'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,5,'Coordination','September','Full',10,'Nervous system'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,6,'Reproduction','October','Full',15,'Human and plant reproduction'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,7,'Coordination in Life Processes','November','Full',10,'Integration'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,8,'Heredity and Evolution','December','Week 2-3',15,'Genetics'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,9,'Our Environment','December','Week 4',10,'Ecosystem'),
((SELECT id FROM subjects WHERE subject_name='Biology'),10,10,'Natural Resources','January','Full',10,'Conservation');

-- SOCIAL STUDIES
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,1,'India: Relief Features','June','Week 1-2',8,'Location, relief divisions'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,2,'Ideas of Development','June','Week 3-4',7,'Development concepts'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,3,'Production and Employment','July','Week 1-2',8,'Sectors, employment'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,4,'Climate of India','July','Week 3-4',8,'Climate and monsoon'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,5,'Rivers and Water Resources','August','Week 1-2',7,'River systems'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,6,'Population','August','Week 3-4',6,'Demographics'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,7,'Settlements and Migration','September','Week 1-2',7,'Migration'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,8,'Rampur Village Economy','September','Week 3-4',6,'Rural economy'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,9,'Globalisation','October','Week 1-2',6,'MNCs'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,10,'Food Security','October','Week 3-4',6,'PDS'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,11,'Sustainable Development','November','Week 1-2',7,'Sustainability'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,12,'World Wars','November','Week 3-4',8,'WW1 and WW2'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,13,'National Liberation','December','Week 1',5,'Colonial struggles'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,14,'National Movement in India','December','Week 2-3',6,'Freedom struggle'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,15,'Indian Constitution','December','Week 4',5,'Rights'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,16,'Election Process','January','Week 1-2',5,'Elections'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,17,'Independent India','January','Week 3',5,'Nation building'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,18,'Political Trends','January','Week 4',5,'Reforms'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,19,'Post-War World','February','Week 1',5,'Cold War'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,20,'Social Movements','February','Week 2',5,'Movements'),
((SELECT id FROM subjects WHERE subject_name='Social Studies'),10,21,'Telangana Movement','February','Week 3',6,'State formation');

-- Topics and detailed chapter-wise micro-plans are to be imported from your curated SQL dumps
-- (like your `LOCK TABLES topics ... INSERT INTO topics ...` block), so this file will not auto-generate generic topic rows.


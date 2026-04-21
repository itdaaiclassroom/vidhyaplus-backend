USE lms;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Canonical script: execute this file in MySQL Workbench to populate `topics` + `topic_micro_lessons`.
-- Same logic as `topics_micro_seed.sql` (duplicate kept for a clear filename).

-- Grade 10: fills `topics` and `topic_micro_lessons` for every grade-10 chapter.
-- Run after `lms.sql` chapter inserts (or equivalent). Adds Hindi supplementary chapters 101–108 if missing.
-- Re-runnable: deletes existing grade-10 topics (and dependent micro rows) then reloads.
-- Warning: dropping topics sets `live_sessions.topic_id` to NULL (FK). Re-run `february_live_sessions_curriculum_update.sql` after if you use that mapping.

SET SQL_SAFE_UPDATES = 0;

-- A) Add extra Hindi chapters (non-numbered lessons) as real chapters
INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 101, 'यह रास्ता कहाँ जाता है?', 'July', 'Week 1', 4, 'Drama reading'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'यह रास्ता कहाँ जाता है?');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 102, 'शांति की राह में', 'July', 'Week 3-4', 4, 'Essay'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'शांति की राह में');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 103, 'हम भारतीय', 'November', 'Week 1', 3, 'Poem'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'हम भारतीय');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 104, 'अपने स्कूल को उपहार', 'November', 'Week 4', 4, 'Story'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'अपने स्कूल को उपहार');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 105, 'क्या आपको पता है?', 'December', 'Week 4', 4, 'Informative'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'क्या आपको पता है?');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 106, 'अनोखा उपाय', 'January', 'Week 3', 4, 'Story'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'अनोखा उपाय');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 107, 'उलझन', 'September', 'Week 1', 3, 'Poem'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'उलझन');

INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
SELECT s.id, 10, 108, 'हम सब एक हैं', 'September', 'Week 3-4', 4, 'Essay'
FROM subjects s
WHERE s.subject_name = 'Hindi'
  AND NOT EXISTS (SELECT 1 FROM chapters c WHERE c.subject_id = s.id AND c.grade_id = 10 AND c.chapter_name = 'हम सब एक हैं');

-- B) Clear only Grade-10 topics and micro-lesson plans
DELETE tml
FROM topic_micro_lessons tml
JOIN topics t ON t.id = tml.topic_id
JOIN chapters c ON c.id = t.chapter_id
WHERE c.grade_id = 10;

DELETE t
FROM topics t
JOIN chapters c ON c.id = t.chapter_id
WHERE c.grade_id = 10;

-- C) Insert chapter-wise topics (explicit where you provided exact topic hierarchy)

-- Social Studies: India Relief Features
INSERT INTO topics (chapter_id, name, order_num, status)
SELECT c.id, 'Location & Map', 1, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Latitudes & Longitudes', 2, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Geological History', 3, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Himalayas', 4, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Plains', 5, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Plateau', 6, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Desert & Coast', 7, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features'
UNION ALL SELECT c.id, 'Revision', 8, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Social Studies' AND c.chapter_name='India: Relief Features';

-- Mathematics: Real Numbers
INSERT INTO topics (chapter_id, name, order_num, status)
SELECT c.id, 'Euclid Division Algorithm', 1, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Mathematics' AND c.chapter_name='Real Numbers'
UNION ALL SELECT c.id, 'HCF & LCM', 2, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Mathematics' AND c.chapter_name='Real Numbers'
UNION ALL SELECT c.id, 'Fundamental Theorem of Arithmetic', 3, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Mathematics' AND c.chapter_name='Real Numbers'
UNION ALL SELECT c.id, 'Decimal Expansions', 4, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Mathematics' AND c.chapter_name='Real Numbers'
UNION ALL SELECT c.id, 'Irrational Numbers', 5, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Mathematics' AND c.chapter_name='Real Numbers';

-- Physics: Reflection
INSERT INTO topics (chapter_id, name, order_num, status)
SELECT c.id, 'Reflection Basics', 1, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Spherical Mirrors', 2, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Concave Mirror', 3, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Convex Mirror', 4, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Image Formation Rules', 5, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Ray Diagrams', 6, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Mirror Formula', 7, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces'
UNION ALL SELECT c.id, 'Magnification', 8, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Physics' AND c.chapter_name='Reflection of Light at Curved Surfaces';

-- Biology: Nutrition
INSERT INTO topics (chapter_id, name, order_num, status)
SELECT c.id, 'Autotrophic Nutrition', 1, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition'
UNION ALL SELECT c.id, 'Photosynthesis', 2, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition'
UNION ALL SELECT c.id, 'Factors Affecting Photosynthesis', 3, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition'
UNION ALL SELECT c.id, 'Heterotrophic Nutrition', 4, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition'
UNION ALL SELECT c.id, 'Digestive System', 5, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition'
UNION ALL SELECT c.id, 'Enzymes & Digestion', 6, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition'
UNION ALL SELECT c.id, 'Malnutrition & Diseases', 7, 'not_started' FROM chapters c JOIN subjects s ON s.id=c.subject_id WHERE s.subject_name='Biology' AND c.chapter_name='Nutrition';

-- D) Fallback hierarchy: force exact topic count per chapter (your mapping)
DROP TEMPORARY TABLE IF EXISTS tmp_topic_seq;
CREATE TEMPORARY TABLE tmp_topic_seq (n INT PRIMARY KEY);
INSERT INTO tmp_topic_seq (n) VALUES
  (1),(2),(3),(4),(5),(6),(7),(8);

DROP TEMPORARY TABLE IF EXISTS tmp_topic_targets;
CREATE TEMPORARY TABLE tmp_topic_targets (
  subject_name VARCHAR(100) NOT NULL,
  chapter_no INT NOT NULL,
  target_count INT NOT NULL,
  PRIMARY KEY (subject_name, chapter_no)
);

INSERT INTO tmp_topic_targets (subject_name, chapter_no, target_count) VALUES
  ('Biology',1,7),('Biology',2,8),('Biology',3,8),('Biology',4,8),('Biology',5,8),('Biology',6,8),('Biology',7,8),('Biology',8,8),('Biology',9,8),('Biology',10,8),
  ('English',1,8),('English',2,8),('English',3,8),('English',4,8),('English',5,8),('English',6,8),('English',7,8),('English',8,8),
  ('Hindi',1,6),('Hindi',2,8),('Hindi',3,6),('Hindi',4,6),('Hindi',5,6),('Hindi',6,5),('Hindi',7,6),('Hindi',8,7),('Hindi',9,6),('Hindi',10,5),('Hindi',11,6),('Hindi',12,6),('Hindi',101,4),('Hindi',102,4),('Hindi',103,3),('Hindi',104,4),('Hindi',105,4),('Hindi',106,4),('Hindi',107,3),('Hindi',108,4),
  ('Mathematics',1,5),('Mathematics',2,8),('Mathematics',3,8),('Mathematics',4,8),('Mathematics',5,8),('Mathematics',6,8),('Mathematics',7,8),('Mathematics',8,8),('Mathematics',9,8),('Mathematics',10,8),('Mathematics',11,8),('Mathematics',12,8),('Mathematics',13,8),('Mathematics',14,8),
  ('Physics',1,8),('Physics',2,5),('Physics',3,8),('Physics',4,8),('Physics',5,8),('Physics',6,7),('Physics',7,8),('Physics',8,8),('Physics',9,8),('Physics',10,8),('Physics',11,6),('Physics',12,8),
  ('Social Studies',1,8),('Social Studies',2,7),('Social Studies',3,8),('Social Studies',4,8),('Social Studies',5,7),('Social Studies',6,6),('Social Studies',7,7),('Social Studies',8,6),('Social Studies',9,6),('Social Studies',10,6),('Social Studies',11,7),('Social Studies',12,8),('Social Studies',13,5),('Social Studies',14,6),('Social Studies',15,5),('Social Studies',16,5),('Social Studies',17,5),('Social Studies',18,5),('Social Studies',19,5),('Social Studies',20,5),('Social Studies',21,6),
  ('Telugu',1,6),('Telugu',2,7),('Telugu',3,8),('Telugu',4,6),('Telugu',5,7),('Telugu',6,6),('Telugu',7,7),('Telugu',8,6),('Telugu',9,6),('Telugu',10,6),('Telugu',11,6),('Telugu',12,8);

-- Add missing topics up to the exact target count for each chapter.
INSERT INTO topics (chapter_id, name, order_num, status)
SELECT
  c.id AS chapter_id,
  CASE
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 1 AND seq.n = 1 THEN 'कवि परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 1 AND seq.n = 2 THEN 'शब्दार्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 1 AND seq.n = 3 THEN 'भावार्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 1 AND seq.n = 4 THEN 'प्रकृति चित्रण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 1 AND seq.n = 5 THEN 'अलंकार'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 1 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 1 THEN 'कहानी परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 2 THEN 'पात्र विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 3 THEN 'घटनाएँ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 4 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 5 THEN 'मूल्य'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 6 THEN 'चर्चा'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 7 THEN 'प्रश्न अभ्यास'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 2 AND seq.n = 8 THEN 'पुनरावृत्ति'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 3 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 3 AND seq.n = 2 THEN 'शब्दार्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 3 AND seq.n = 3 THEN 'भाव'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 3 AND seq.n = 4 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 3 AND seq.n = 5 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 3 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 4 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 4 AND seq.n = 2 THEN 'अर्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 4 AND seq.n = 3 THEN 'भाव'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 4 AND seq.n = 4 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 4 AND seq.n = 5 THEN 'मूल्य'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 4 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 5 AND seq.n = 1 THEN 'परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 5 AND seq.n = 2 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 5 AND seq.n = 3 THEN 'अर्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 5 AND seq.n = 4 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 5 AND seq.n = 5 THEN 'महत्व'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 5 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 6 AND seq.n = 1 THEN 'परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 6 AND seq.n = 2 THEN 'पत्र संरचना'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 6 AND seq.n = 3 THEN 'विषय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 6 AND seq.n = 4 THEN 'लेखन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 6 AND seq.n = 5 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 7 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 7 AND seq.n = 2 THEN 'अर्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 7 AND seq.n = 3 THEN 'भाव'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 7 AND seq.n = 4 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 7 AND seq.n = 5 THEN 'मूल्य'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 7 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 2 THEN 'घटनाएँ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 3 THEN 'पात्र'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 4 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 5 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 6 THEN 'प्रयोग'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 8 AND seq.n = 7 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 9 AND seq.n = 1 THEN 'परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 9 AND seq.n = 2 THEN 'यात्रा वर्णन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 9 AND seq.n = 3 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 9 AND seq.n = 4 THEN 'महत्व'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 9 AND seq.n = 5 THEN 'चर्चा'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 9 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 10 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 10 AND seq.n = 2 THEN 'अर्थ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 10 AND seq.n = 3 THEN 'भाव'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 10 AND seq.n = 4 THEN 'मूल्य'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 10 AND seq.n = 5 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 11 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 11 AND seq.n = 2 THEN 'घटनाएँ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 11 AND seq.n = 3 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 11 AND seq.n = 4 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 11 AND seq.n = 5 THEN 'चर्चा'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 11 AND seq.n = 6 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 12 AND seq.n = 1 THEN 'परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 12 AND seq.n = 2 THEN 'साक्षात्कार'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 12 AND seq.n = 3 THEN 'विश्लेषण'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 12 AND seq.n = 4 THEN 'लेखन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 12 AND seq.n = 5 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 12 AND seq.n = 6 THEN 'पुनरावृत्ति'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 101 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 101 AND seq.n = 2 THEN 'संवाद'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 101 AND seq.n = 3 THEN 'चर्चा'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 101 AND seq.n = 4 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 102 AND seq.n = 1 THEN 'परिचय'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 102 AND seq.n = 2 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 102 AND seq.n = 3 THEN 'विचार'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 102 AND seq.n = 4 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 103 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 103 AND seq.n = 2 THEN 'भाव'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 103 AND seq.n = 3 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 104 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 104 AND seq.n = 2 THEN 'घटनाएँ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 104 AND seq.n = 3 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 104 AND seq.n = 4 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 105 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 105 AND seq.n = 2 THEN 'जानकारी'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 105 AND seq.n = 3 THEN 'चर्चा'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 105 AND seq.n = 4 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 106 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 106 AND seq.n = 2 THEN 'घटनाएँ'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 106 AND seq.n = 3 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 106 AND seq.n = 4 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 107 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 107 AND seq.n = 2 THEN 'भाव'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 107 AND seq.n = 3 THEN 'प्रश्न'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 108 AND seq.n = 1 THEN 'पठन'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 108 AND seq.n = 2 THEN 'विचार'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 108 AND seq.n = 3 THEN 'संदेश'
    WHEN s.subject_name = 'Hindi' AND c.chapter_no = 108 AND seq.n = 4 THEN 'प्रश्न'
    -- Social Studies exact chapter/topic mapping
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 2 THEN 'Goals'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 3 THEN 'Conflicts'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 4 THEN 'Income'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 5 THEN 'Public Facilities'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 6 THEN 'HDI'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 2 AND seq.n = 7 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 2 THEN 'Primary Sector'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 3 THEN 'Secondary Sector'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 4 THEN 'Tertiary Sector'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 5 THEN 'Employment Types'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 6 THEN 'Organized & Unorganized'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 7 THEN 'Case Study'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 3 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 1 THEN 'Climate Basics'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 2 THEN 'Factors Affecting Climate'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 3 THEN 'Monsoon'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 4 THEN 'Seasons'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 5 THEN 'Rainfall'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 6 THEN 'Regions'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 7 THEN 'Map Work'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 4 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 2 THEN 'Himalayan Rivers'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 3 THEN 'Peninsular Rivers'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 4 THEN 'Irrigation'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 5 THEN 'Conservation'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 6 THEN 'Issues'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 5 AND seq.n = 7 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 6 AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 6 AND seq.n = 2 THEN 'Growth'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 6 AND seq.n = 3 THEN 'Density'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 6 AND seq.n = 4 THEN 'Literacy'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 6 AND seq.n = 5 THEN 'Migration'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 6 AND seq.n = 6 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 1 THEN 'Types of Settlements'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 2 THEN 'Rural Settlements'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 3 THEN 'Urban Settlements'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 4 THEN 'Migration Types'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 5 THEN 'Causes'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 6 THEN 'Effects'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 7 AND seq.n = 7 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 8 AND seq.n = 1 THEN 'Village Introduction'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 8 AND seq.n = 2 THEN 'Farming'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 8 AND seq.n = 3 THEN 'Non-Farm Activities'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 8 AND seq.n = 4 THEN 'Credit System'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 8 AND seq.n = 5 THEN 'Issues'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 8 AND seq.n = 6 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 9 AND seq.n = 1 THEN 'Meaning'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 9 AND seq.n = 2 THEN 'Liberalisation'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 9 AND seq.n = 3 THEN 'MNCs'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 9 AND seq.n = 4 THEN 'Impact'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 9 AND seq.n = 5 THEN 'Advantages & Disadvantages'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 9 AND seq.n = 6 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 10 AND seq.n = 1 THEN 'Meaning'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 10 AND seq.n = 2 THEN 'Public Distribution System'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 10 AND seq.n = 3 THEN 'Buffer Stock'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 10 AND seq.n = 4 THEN 'Government Programs'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 10 AND seq.n = 5 THEN 'Issues'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 10 AND seq.n = 6 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 1 THEN 'Meaning'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 2 THEN 'Resources'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 3 THEN 'Issues'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 4 THEN 'Conservation'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 5 THEN 'Equity'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 6 THEN 'Case Study'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 11 AND seq.n = 7 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 1 THEN 'Causes of WW1'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 2 THEN 'WW1 Events'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 3 THEN 'Aftermath'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 4 THEN 'Causes of WW2'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 5 THEN 'WW2 Events'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 6 THEN 'Impact'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 7 THEN 'Comparison'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 12 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 13 AND seq.n = 1 THEN 'Movements Overview'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 13 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 14 AND seq.n = 1 THEN 'Freedom Struggle Overview'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 14 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 15 AND seq.n = 1 THEN 'Constitution Features'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 15 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 16 AND seq.n = 1 THEN 'Election Process Overview'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 16 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 17 AND seq.n = 1 THEN 'Development Overview'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 17 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 18 AND seq.n = 1 THEN 'Political Changes'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 18 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 19 AND seq.n = 1 THEN 'Cold War Overview'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 19 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 20 AND seq.n = 1 THEN 'Types of Movements'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 20 AND seq.n = 2 THEN 'Revision'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 21 AND seq.n = 1 THEN 'Telangana Movement Overview'
    WHEN s.subject_name = 'Social Studies' AND c.chapter_no = 21 AND seq.n = 2 THEN 'Revision'

    -- Biology exact chapter/topic mapping (counts as requested)
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 2 THEN 'Breathing Process'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 3 THEN 'Lungs Structure'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 4 THEN 'Gaseous Exchange'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 5 THEN 'Transport of Gases'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 6 THEN 'Cellular Respiration'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 7 THEN 'Aerobic Respiration'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 2 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 1 THEN 'Blood Components'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 2 THEN 'Functions'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 3 THEN 'Heart Structure'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 4 THEN 'Working of Heart'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 5 THEN 'Double Circulation'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 6 THEN 'Blood Vessels'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 7 THEN 'Lymph'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 3 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 2 THEN 'Human Excretory System'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 3 THEN 'Kidney Structure'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 4 THEN 'Nephron'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 5 THEN 'Urine Formation'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 6 THEN 'Excretion in Plants'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 7 THEN 'Disorders'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 4 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 2 THEN 'Nervous System'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 3 THEN 'Brain Structure'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 4 THEN 'Reflex Actions'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 5 THEN 'Hormones'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 6 THEN 'Endocrine Glands'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 7 THEN 'Coordination in Plants'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 5 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 2 THEN 'Asexual Methods'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 3 THEN 'Binary Fission'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 4 THEN 'Budding'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 5 THEN 'Vegetative Propagation'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 6 THEN 'Sexual Reproduction'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 7 THEN 'Male System'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 6 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 7 AND seq.n = 1 THEN 'System Integration'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 7 AND seq.n = 2 THEN 'Hormonal Control'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 7 AND seq.n = 3 THEN 'Case Studies'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 7 AND seq.n = 4 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 2 THEN 'Mendel Laws'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 3 THEN 'Traits'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 4 THEN 'Punnett Square'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 5 THEN 'Variation'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 6 THEN 'Evolution'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 7 THEN 'Natural Selection'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 8 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 1 THEN 'Ecosystem'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 2 THEN 'Components'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 3 THEN 'Food Chains'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 4 THEN 'Food Web'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 5 THEN 'Energy Flow'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 6 THEN 'Pollution'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 7 THEN 'Waste Management'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 9 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 2 THEN 'Air'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 3 THEN 'Water'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 4 THEN 'Soil'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 5 THEN 'Forest'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 6 THEN 'Energy'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 7 THEN 'Sustainable Use'
    WHEN s.subject_name = 'Biology' AND c.chapter_no = 10 AND seq.n = 8 THEN 'Revision'

    -- Physics exact chapter/topic mapping
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 2 AND seq.n = 1 THEN 'Writing Chemical Equations'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 2 AND seq.n = 2 THEN 'Balancing Equations'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 2 AND seq.n = 3 THEN 'Types of Reactions'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 2 AND seq.n = 4 THEN 'Combination Reaction'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 2 AND seq.n = 5 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 1 THEN 'Properties of Acids & Bases'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 2 THEN 'Indicators & pH Scale'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 3 THEN 'Strength of Acids/Bases'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 4 THEN 'Chemical Reactions'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 5 THEN 'Salt Formation'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 6 THEN 'Uses in Daily Life'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 7 THEN 'Practice'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 3 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 1 THEN 'Refraction Basics'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 2 THEN 'Laws of Refraction'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 3 THEN 'Lenses'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 4 THEN 'Convex Lens'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 5 THEN 'Concave Lens'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 6 THEN 'Image Formation'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 7 THEN 'Lens Formula'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 4 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 1 THEN 'Structure of Eye'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 2 THEN 'Image Formation in Eye'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 3 THEN 'Defects of Vision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 4 THEN 'Myopia'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 5 THEN 'Hypermetropia'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 6 THEN 'Dispersion of Light'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 7 THEN 'Scattering of Light'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 5 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 1 THEN 'Atomic Models'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 2 THEN 'Dalton Model'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 3 THEN 'Thomson Model'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 4 THEN 'Rutherford Model'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 5 THEN 'Bohr Model'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 6 THEN 'Subatomic Particles'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 6 AND seq.n = 7 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 1 THEN 'Classification of Elements'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 2 THEN 'Modern Periodic Table'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 3 THEN 'Periods & Groups'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 4 THEN 'Trends'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 5 THEN 'Atomic Size'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 6 THEN 'Valency'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 7 THEN 'Reactivity'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 7 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 1 THEN 'Ionic Bonding'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 2 THEN 'Covalent Bonding'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 3 THEN 'Properties of Compounds'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 4 THEN 'Formation of Molecules'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 5 THEN 'Chemical Structures'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 6 THEN 'Applications'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 7 THEN 'Practice'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 8 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 1 THEN 'Electric Current'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 2 THEN 'Potential Difference'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 3 THEN 'Ohm’s Law'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 4 THEN 'Resistance'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 5 THEN 'Series & Parallel Circuits'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 6 THEN 'Electric Power'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 7 THEN 'Practice'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 9 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 1 THEN 'Magnetic Effects of Current'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 2 THEN 'Electromagnets'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 3 THEN 'Fleming’s Rules'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 4 THEN 'Electric Motor'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 5 THEN 'Generator'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 6 THEN 'Electromagnetic Induction'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 7 THEN 'Applications'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 10 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 11 AND seq.n = 1 THEN 'Occurrence of Metals'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 11 AND seq.n = 2 THEN 'Extraction of Metals'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 11 AND seq.n = 3 THEN 'Concentration of Ores'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 11 AND seq.n = 4 THEN 'Refining'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 11 AND seq.n = 5 THEN 'Corrosion'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 11 AND seq.n = 6 THEN 'Revision'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 1 THEN 'Properties of Carbon'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 2 THEN 'Covalent Bonding in Carbon'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 3 THEN 'Hydrocarbons'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 4 THEN 'Functional Groups'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 5 THEN 'Homologous Series'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 6 THEN 'Uses of Carbon Compounds'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 7 THEN 'Applications'
    WHEN s.subject_name = 'Physics' AND c.chapter_no = 12 AND seq.n = 8 THEN 'Revision'

    -- Telugu (remaining chapters)
    WHEN s.subject_name = 'Telugu' AND seq.n = 1 THEN 'పరిచయం'
    WHEN s.subject_name = 'Telugu' AND seq.n = 2 THEN 'పఠనం'
    WHEN s.subject_name = 'Telugu' AND seq.n = 3 THEN 'భావం'
    WHEN s.subject_name = 'Telugu' AND seq.n = 4 THEN 'విశ్లేషణ'
    WHEN s.subject_name = 'Telugu' AND seq.n = 5 THEN 'సందేశం'
    WHEN s.subject_name = 'Telugu' AND seq.n = 6 THEN 'ప్రశ్నలు'
    WHEN s.subject_name = 'Telugu' AND seq.n = 7 THEN 'చర్చ'
    WHEN s.subject_name = 'Telugu' AND seq.n = 8 THEN 'పునర్విమర్శ'

    -- English (remaining chapters)
    WHEN s.subject_name = 'English' AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'English' AND seq.n = 2 THEN 'Main Text Reading'
    WHEN s.subject_name = 'English' AND seq.n = 3 THEN 'Vocabulary'
    WHEN s.subject_name = 'English' AND seq.n = 4 THEN 'Grammar Focus'
    WHEN s.subject_name = 'English' AND seq.n = 5 THEN 'Theme Discussion'
    WHEN s.subject_name = 'English' AND seq.n = 6 THEN 'Writing Task'
    WHEN s.subject_name = 'English' AND seq.n = 7 THEN 'Speaking Activity'
    WHEN s.subject_name = 'English' AND seq.n = 8 THEN 'Revision'

    -- Mathematics (remaining chapters)
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 2 THEN 'Types of Sets'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 3 THEN 'Union & Intersection'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 4 THEN 'Complement'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 5 THEN 'Venn Diagrams'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 6 THEN 'Problems'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 7 THEN 'Applications'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 2 AND seq.n = 8 THEN 'Revision'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 3 AND seq.n = 2 THEN 'Zeros of Polynomial'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 3 AND seq.n = 3 THEN 'Graphs'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 3 AND seq.n = 4 THEN 'Relations'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 4 AND seq.n = 2 THEN 'Graphical Method'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 4 AND seq.n = 3 THEN 'Substitution Method'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 4 AND seq.n = 4 THEN 'Elimination Method'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 5 AND seq.n = 2 THEN 'Factorisation'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 5 AND seq.n = 3 THEN 'Quadratic Formula'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 5 AND seq.n = 4 THEN 'Discriminant'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 6 AND seq.n = 2 THEN 'nth Term'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 6 AND seq.n = 3 THEN 'Sum Formula'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 7 AND seq.n = 2 THEN 'Distance Formula'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 7 AND seq.n = 3 THEN 'Section Formula'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 8 AND seq.n = 2 THEN 'Criteria of Similarity'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 8 AND seq.n = 3 THEN 'Theorems'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 8 AND seq.n = 4 THEN 'Applications'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 9 AND seq.n = 2 THEN 'Tangents'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 9 AND seq.n = 3 THEN 'Secants'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 10 AND seq.n = 2 THEN 'Surface Area'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 10 AND seq.n = 3 THEN 'Volume'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 11 AND seq.n = 2 THEN 'Trigonometric Ratios'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 11 AND seq.n = 3 THEN 'Identities'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 12 AND seq.n = 2 THEN 'Heights & Distances'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 12 AND seq.n = 3 THEN 'Case Study'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 13 AND seq.n = 2 THEN 'Probability Concepts'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 14 AND seq.n = 2 THEN 'Mean'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 14 AND seq.n = 3 THEN 'Median'
    WHEN s.subject_name = 'Mathematics' AND c.chapter_no = 14 AND seq.n = 4 THEN 'Graphs'
    WHEN s.subject_name = 'Mathematics' AND seq.n = tt.target_count THEN 'Revision'

    -- Physics/Biology/Social fallback with lesson-plan labels
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 1 THEN 'Introduction'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 2 THEN 'Core Concept 1'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 3 THEN 'Core Concept 2'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 4 THEN 'Core Concept 3'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 5 THEN 'Applications'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 6 THEN 'Discussion'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 7 THEN 'Case Study'
    WHEN s.subject_name IN ('Physics', 'Biology', 'Social Studies') AND seq.n = 8 THEN 'Revision'
    WHEN seq.n = tt.target_count THEN 'Revision'
    ELSE CONCAT(c.chapter_name, ' - Topic ', seq.n)
  END AS name,
  seq.n AS order_num,
  'not_started' AS status
FROM chapters c
JOIN subjects s ON s.id = c.subject_id
JOIN tmp_topic_targets tt
  ON tt.subject_name = s.subject_name
 AND tt.chapter_no = c.chapter_no
JOIN tmp_topic_seq seq
  ON seq.n <= tt.target_count
LEFT JOIN topics t
  ON t.chapter_id = c.id
 AND t.order_num = seq.n
WHERE c.grade_id = 10
  AND t.id IS NULL;

-- E) Micro lesson plans (one row per topic; period_no = slot order in chapter)
DELETE tml FROM topic_micro_lessons tml
JOIN topics t ON t.id = tml.topic_id
JOIN chapters c ON c.id = t.chapter_id
WHERE c.grade_id = 10;

INSERT INTO topic_micro_lessons (topic_id, period_no, concept_text, plan_text)
SELECT t.id, t.order_num, t.name,
  CONCAT('P', t.order_num, ': ', t.name, ' — explanation, examples, interaction, recap.')
FROM topics t
JOIN chapters c ON c.id = t.chapter_id
WHERE c.grade_id = 10;

-- F) Quick verification
SELECT s.subject_name, COUNT(DISTINCT c.id) AS chapters_count, COUNT(t.id) AS topics_count
FROM chapters c
JOIN subjects s ON s.id = c.subject_id
LEFT JOIN topics t ON t.chapter_id = c.id
WHERE c.grade_id = 10
GROUP BY s.subject_name
ORDER BY s.subject_name;

SELECT 'topic_micro_lessons_grade10' AS check_name, COUNT(*) AS value
FROM topic_micro_lessons ml
JOIN topics t ON t.id = ml.topic_id
JOIN chapters c ON c.id = t.chapter_id
WHERE c.grade_id = 10;

SET SQL_SAFE_UPDATES = 1;

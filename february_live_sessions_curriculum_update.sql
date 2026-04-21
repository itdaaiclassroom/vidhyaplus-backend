-- Map February 2026 live_sessions to chapters/topics after curriculum is loaded.
-- Prerequisites:
--   1) chapters for grade 10 imported (e.g. from chapters.csv; chapter_no must match syllabus).
--   2) topics populated for each chapter (at least one row per chapter you reference).
--   3) lms.sql demo calendar: 24 working days Mon–Sat (see INSERT INTO live_sessions dates).
--
-- Social Studies (subject_id 7): weeks follow syllabus — ch.19, 20, 21, then week 4 still uses ch.21
--   as "final revision" anchor (adjust if you add a dedicated Revision chapter).
-- Other subjects: "February = full syllabus revision" → each session uses that subject's last chapter_no.
--
-- topic_id: first topic per chapter by MIN(order_num). Refine with topic_micro_lessons if you need period-level tie-in.

USE lms;

SET SQL_SAFE_UPDATES = 0;

-- ---- First topic per chapter (one row per chapter_id) ----
DROP TEMPORARY TABLE IF EXISTS tmp_first_topic_per_chapter;
CREATE TEMPORARY TABLE tmp_first_topic_per_chapter AS
SELECT t.chapter_id, t.id AS topic_id
FROM topics t
JOIN (
  SELECT chapter_id, MIN(order_num) AS mo
  FROM topics
  GROUP BY chapter_id
) x ON x.chapter_id = t.chapter_id AND x.mo = t.order_num;

-- ---- Social Studies: week-based chapter (Feb 2026 working blocks) ----
UPDATE live_sessions ls
JOIN chapters c ON c.grade_id = 10
  AND c.subject_id = ls.subject_id
  AND c.subject_id = (SELECT id FROM subjects WHERE subject_name = 'Social Studies' LIMIT 1)
  AND c.chapter_no = CASE
    WHEN ls.session_date BETWEEN '2026-02-02' AND '2026-02-07' THEN 19
    WHEN ls.session_date BETWEEN '2026-02-09' AND '2026-02-14' THEN 20
    WHEN ls.session_date BETWEEN '2026-02-16' AND '2026-02-21' THEN 21
    WHEN ls.session_date BETWEEN '2026-02-23' AND '2026-02-28' THEN 21
    ELSE NULL
  END
JOIN tmp_first_topic_per_chapter ft ON ft.chapter_id = c.id
SET
  ls.chapter_id = c.id,
  ls.topic_id = ft.topic_id,
  ls.topic_name = CONCAT(c.chapter_name, ' — ', DATE_FORMAT(ls.session_date, '%d %b'))
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28';

-- ---- All other subjects: last chapter of grade 10 for that subject ----
UPDATE live_sessions ls
JOIN (
  SELECT c1.id AS chapter_id, c1.subject_id
  FROM chapters c1
  JOIN (
    SELECT subject_id, MAX(chapter_no) AS mx
    FROM chapters
    WHERE grade_id = 10
    GROUP BY subject_id
  ) m ON m.subject_id = c1.subject_id AND c1.chapter_no = m.mx AND c1.grade_id = 10
) last_ch ON last_ch.subject_id = ls.subject_id
JOIN chapters c ON c.id = last_ch.chapter_id
JOIN tmp_first_topic_per_chapter ft ON ft.chapter_id = c.id
SET
  ls.chapter_id = c.id,
  ls.topic_id = ft.topic_id,
  ls.topic_name = CONCAT(c.chapter_name, ' — Final revision (', DATE_FORMAT(ls.session_date, '%d %b'), ')')
WHERE ls.session_date BETWEEN '2026-02-01' AND '2026-02-28'
  AND ls.subject_id <> (SELECT id FROM subjects WHERE subject_name = 'Social Studies' LIMIT 1);

DROP TEMPORARY TABLE IF EXISTS tmp_first_topic_per_chapter;

SET SQL_SAFE_UPDATES = 1;

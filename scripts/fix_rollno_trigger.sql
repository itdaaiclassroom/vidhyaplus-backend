DROP TRIGGER IF EXISTS trg_students_before_insert_rollno;

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

  -- Next sequence within (school_id, grade_id, YY) to avoid collisions between sections
  SELECT COALESCE(MAX(st.roll_seq), 0) + 1
    INTO v_next_seq
  FROM students st
  JOIN sections sec ON st.section_id = sec.id
  WHERE st.school_id = NEW.school_id
    AND sec.grade_id = v_grade_id
    AND st.roll_year = v_roll_year;

  SET NEW.roll_year = v_roll_year;
  SET NEW.roll_seq = v_next_seq;
  SET NEW.roll_no = CONCAT(
    LPAD(v_roll_year, 2, '0'),
    v_school_suffix,
    LPAD(v_grade_id, 2, '0'),
    LPAD(v_next_seq, 4, '0')
  );
END;

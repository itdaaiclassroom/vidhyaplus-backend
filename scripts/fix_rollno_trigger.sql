DROP TRIGGER IF EXISTS trg_students_before_insert_rollno;

CREATE TRIGGER trg_students_before_insert_rollno
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
  DECLARE v_roll_year SMALLINT UNSIGNED;
  DECLARE v_next_seq INT UNSIGNED;

  -- Use full year (e.g. 2026)
  SET v_roll_year = YEAR(COALESCE(NEW.joined_at, CURDATE()));

  -- Next sequence within (school_id, year)
  SELECT COALESCE(MAX(st.roll_seq), 0) + 1
    INTO v_next_seq
  FROM students st
  WHERE st.school_id = NEW.school_id
    AND st.roll_year = v_roll_year;

  SET NEW.roll_year = v_roll_year;
  SET NEW.roll_seq = v_next_seq;
  -- Format: YYYY + SchoolID + 3-digit sequence
  SET NEW.roll_no = CONCAT(
    v_roll_year,
    NEW.school_id,
    LPAD(v_next_seq, 3, '0')
  );
END;

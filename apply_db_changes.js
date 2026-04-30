import getPool from "./backend/server/config/db.js";

async function applyChanges() {
  const db = getPool();
  try {
    console.log("Applying database changes...");

    // 1. Alter teachers table
    try {
      await db.query(`ALTER TABLE teachers 
        ADD COLUMN assigned_subject_ids JSON NULL,
        ADD COLUMN assigned_class_ids JSON NULL,
        ADD COLUMN assigned_section_ids JSON NULL;`);
      console.log("Added JSON columns to teachers table.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("JSON columns already exist in teachers table.");
      else throw e;
    }

    // 2. Alter teacher_attendance table
    // rename date to attendance_date
    try {
      await db.query(`ALTER TABLE teacher_attendance CHANGE date attendance_date DATE NOT NULL;`);
      console.log("Renamed date to attendance_date in teacher_attendance table.");
    } catch (e) {
      if (e.code === 'ER_BAD_FIELD_ERROR') console.log("date column might already be renamed in teacher_attendance.");
      else throw e;
    }

    // Add unique constraint to teacher_attendance
    try {
      // First, drop the old unique constraint if it exists (it was named unique_attendance previously)
      await db.query(`ALTER TABLE teacher_attendance DROP INDEX unique_attendance;`);
    } catch (e) {}

    try {
      await db.query(`ALTER TABLE teacher_attendance ADD UNIQUE KEY unique_teacher_day (teacher_id, attendance_date);`);
      console.log("Added unique_teacher_day constraint to teacher_attendance table.");
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log("unique_teacher_day already exists.");
      else throw e;
    }

    // 3. Alter attendance table (student attendance)
    // rename date to attendance_date
    try {
      await db.query(`ALTER TABLE attendance CHANGE date attendance_date DATE NOT NULL;`);
      console.log("Renamed date to attendance_date in attendance table.");
    } catch (e) {
      if (e.code === 'ER_BAD_FIELD_ERROR') console.log("date column might already be renamed in attendance.");
      else throw e;
    }

    try {
      await db.query(`ALTER TABLE students 
        MODIFY COLUMN roll_year SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        MODIFY COLUMN roll_seq INT UNSIGNED NOT NULL DEFAULT 0,
        MODIFY COLUMN roll_no VARCHAR(24) NOT NULL DEFAULT '';`);
      console.log("Updated students table schema for roll numbers.");
    } catch (e) {
      console.error("Error updating students schema:", e.message);
    }

    // 4. Re-apply roll_no trigger
    try {
      await db.query(`DROP TRIGGER IF EXISTS trg_students_before_insert_rollno;`);
      await db.query(`
        CREATE TRIGGER trg_students_before_insert_rollno
        BEFORE INSERT ON students
        FOR EACH ROW
        BEGIN
          DECLARE v_roll_year SMALLINT UNSIGNED;
          DECLARE v_next_seq INT UNSIGNED;

          SET v_roll_year = YEAR(COALESCE(NEW.joined_at, CURDATE()));

          SELECT COALESCE(MAX(st.roll_seq), 0) + 1
            INTO v_next_seq
          FROM students st
          WHERE st.school_id = NEW.school_id
            AND st.roll_year = v_roll_year;

          SET NEW.roll_year = v_roll_year;
          SET NEW.roll_seq = v_next_seq;
          SET NEW.roll_no = CONCAT(
            v_roll_year,
            NEW.school_id,
            LPAD(v_next_seq, 3, '0')
          );
        END;
      `);
      console.log("Re-applied roll_no trigger with new format.");
    } catch (e) {
      console.error("Error applying trigger:", e.message);
    }

    console.log("All database changes applied successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error applying database changes:", error);
    process.exit(1);
  }
}

applyChanges();

import getPool from "../backend/server/config/db.js";

async function applyQuizChanges() {
  const db = getPool();
  try {
    console.log("Starting student quiz database migration...");

    // 1. Add subject_id column to student_marks
    try {
      await db.query(`
        ALTER TABLE student_marks 
        ADD COLUMN subject_id INT UNSIGNED NULL AFTER student_id;
      `);
      console.log("Added subject_id column to student_marks.");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME" || err.message.includes("Duplicate column")) {
        console.log("subject_id column already exists in student_marks.");
      } else {
        throw err;
      }
    }

    // 2. Modify chapter_id column to be nullable
    try {
      await db.query(`
        ALTER TABLE student_marks 
        MODIFY COLUMN chapter_id INT UNSIGNED NULL;
      `);
      console.log("Modified chapter_id to be nullable in student_marks.");
    } catch (err) {
      console.error("Failed to modify chapter_id:", err.message);
      throw err;
    }

    // 3. Add detailed_answers JSON column
    try {
      await db.query(`
        ALTER TABLE student_marks 
        ADD COLUMN detailed_answers JSON NULL;
      `);
      console.log("Added detailed_answers JSON column to student_marks.");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME" || err.message.includes("Duplicate column")) {
        console.log("detailed_answers column already exists in student_marks.");
      } else {
        throw err;
      }
    }

    // 4. Add foreign key constraint for subject_id
    try {
      await db.query(`
        ALTER TABLE student_marks 
        ADD CONSTRAINT fk_sm_subject 
        FOREIGN KEY (subject_id) REFERENCES subjects(id) 
        ON DELETE CASCADE;
      `);
      console.log("Added fk_sm_subject constraint to student_marks.");
    } catch (err) {
      if (err.code === "ER_DUP_KEY" || err.code === "ER_DUP_CONSTRAINT_NAME" || err.message.includes("Duplicate key") || err.message.includes("already exists")) {
        console.log("Foreign key constraint fk_sm_subject already exists.");
      } else {
        console.warn("Failed to add foreign key constraint:", err.message);
      }
    }

    console.log("Student quiz database migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Database migration failed:", err);
    process.exit(1);
  }
}

applyQuizChanges();

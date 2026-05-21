import getPool from "./backend/server/config/db.js";

async function setupTables() {
  const db = getPool();
  try {
    console.log("Creating student_exam_marks table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_exam_marks (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        student_id INT UNSIGNED NOT NULL,
        subject_id INT UNSIGNED NOT NULL,
        exam_type ENUM('FA1', 'FA2', 'FA3', 'FA4', 'SA1', 'SA2', 'QUIZ') NOT NULL,
        marks_obtained INT NOT NULL,
        max_marks INT NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (student_id),
        INDEX (subject_id),
        INDEX (exam_type),
        INDEX (academic_year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating student_behavior_assessments table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_behavior_assessments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        student_id INT UNSIGNED NOT NULL,
        teacher_id INT UNSIGNED NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        communication_score INT NOT NULL DEFAULT 0,
        leadership_score INT NOT NULL DEFAULT 0,
        teamwork_score INT NOT NULL DEFAULT 0,
        participation_score INT NOT NULL DEFAULT 0,
        creativity_score INT NOT NULL DEFAULT 0,
        confidence_score INT NOT NULL DEFAULT 0,
        discipline_score INT NOT NULL DEFAULT 0,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (student_id),
        INDEX (teacher_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating student_performance_summary table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_performance_summary (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        student_id INT UNSIGNED NOT NULL,
        overall_percentage DECIMAL(5,2),
        overall_grade VARCHAR(5),
        class_rank VARCHAR(20),
        attendance_percentage DECIMAL(5,2),
        performance_index DECIMAL(5,2),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (student_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("All tables created successfully!");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    process.exit(0);
  }
}

setupTables();

import getPool from "./backend/server/config/db.js";

const queries = [
  "ALTER TABLE students ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER last_name",
  "ALTER TABLE students ADD COLUMN profile_image_path VARCHAR(255) NULL AFTER joined_at",
  "ALTER TABLE students ADD COLUMN gender VARCHAR(20) NULL",
  "ALTER TABLE students ADD COLUMN dob DATE NULL",
  "ALTER TABLE students ADD COLUMN father_name VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN mother_name VARCHAR(100) NULL",
  "ALTER TABLE students ADD COLUMN aadhaar VARCHAR(20) NULL",
  "ALTER TABLE students ADD COLUMN disabilities VARCHAR(255) NULL"
];

async function fixStudents() {
  const db = getPool();
  try {
    for (const sql of queries) {
      try {
        await db.query(sql);
        console.log("Success:", sql);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log("Column already exists:", sql);
        } else {
          console.error("Error:", sql, err.message);
        }
      }
    }
    console.log("Done fixing students table.");
  } finally {
    process.exit(0);
  }
}

fixStudents();

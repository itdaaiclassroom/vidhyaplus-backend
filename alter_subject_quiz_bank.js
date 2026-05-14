import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });
  
  try {
    await pool.query(`ALTER TABLE subject_quiz_bank ADD COLUMN assigned_for ENUM('student', 'teacher', 'both') DEFAULT 'both'`);
    console.log('Column assigned_for added successfully.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column assigned_for already exists.');
    } else {
      console.error('Error adding column:', error);
    }
  }
  process.exit(0);
}
run();

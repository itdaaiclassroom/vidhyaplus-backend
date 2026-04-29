import 'dotenv/config';
import mysql from 'mysql2/promise';

async function testInsert() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const classId = 21;
    const dateStr = '2026-04-29';
    const studentId = 1; // Assuming 1 exists
    const status = 'present';

    console.log('Testing DELETE...');
    await pool.query("DELETE FROM attendance WHERE class_id = ? AND attendance_date = ?", [classId, dateStr]);
    
    console.log('Testing INSERT...');
    await pool.query(
      "INSERT INTO attendance (student_id, class_id, attendance_date, status) VALUES (?, ?, ?, ?)",
      [studentId, classId, dateStr, status]
    );
    console.log('Test successful!');
  } catch (err) {
    console.error('DATABASE ERROR:', err.message);
    if (err.sql) console.error('SQL:', err.sql);
  } finally {
    await pool.end();
  }
}

testInsert();

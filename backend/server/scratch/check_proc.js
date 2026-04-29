import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkProc() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [procs] = await pool.query('SHOW CREATE PROCEDURE sp_recompute_class_attendance_summary');
    console.log('Procedure:', procs[0]['Create Procedure']);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkProc();

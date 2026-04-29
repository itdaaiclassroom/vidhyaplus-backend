import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkTeachers() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM teachers");
    console.log('Teachers Columns:', cols);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTeachers();

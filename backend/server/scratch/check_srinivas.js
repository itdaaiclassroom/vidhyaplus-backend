import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkUser() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [admins] = await pool.query("SELECT * FROM admins WHERE email = 'srinivas.reddy@zphs.edu'");
    console.log('Admin by email:', admins);
    
    const [teachers] = await pool.query("SELECT * FROM teachers WHERE email = 'srinivas.reddy@zphs.edu'");
    console.log('Teacher by email:', teachers);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkUser();

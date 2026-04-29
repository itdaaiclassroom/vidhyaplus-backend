import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkTriggers() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [triggers] = await pool.query('SHOW TRIGGERS LIKE "attendance"');
    console.log('Triggers on attendance:', triggers);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTriggers();

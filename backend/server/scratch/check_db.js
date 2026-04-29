import 'dotenv/config';
import mysql from 'mysql2/promise';

async function check() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [topics] = await pool.query('DESCRIBE topics');
    console.log('Topics Schema:', topics);

    const [pptMats] = await pool.query('DESCRIBE topic_ppt_materials');
    console.log('Topic PPT Materials Schema:', pptMats);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();

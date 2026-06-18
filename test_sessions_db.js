import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'Venky@9001',
    database: process.env.MYSQL_DATABASE || 'lms_new',
    port: Number(process.env.MYSQL_PORT) || 3306,
  });

  const [desc] = await connection.execute('DESCRIBE live_sessions');
  console.log('live_sessions columns:', desc.map(d => ({ field: d.Field, type: d.Type })));

  const [rows] = await connection.execute('SELECT id, topic_id, topic_name, status, class_id, subject_id FROM live_sessions ORDER BY id DESC LIMIT 20');
  console.log('Recent 20 Live Sessions:', rows);

  await connection.end();
}

main().catch(console.error);

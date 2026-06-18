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

  const [subjects] = await connection.execute('SELECT id, subject_name FROM subjects');
  console.log('Subjects list:', subjects);

  const [chapters] = await connection.execute(
    'SELECT id, chapter_name FROM chapters WHERE grade_id = 10'
  );
  console.log('Chapters in Class 10 (total:', chapters.length, '):', chapters);

  const [topics] = await connection.execute(
    `SELECT t.id, t.chapter_id, t.name, 
            (SELECT COUNT(*) FROM live_sessions WHERE topic_id = t.id) AS session_count,
            (SELECT COUNT(*) FROM live_sessions WHERE topic_id = t.id AND status = 'ended') AS ended_session_count
     FROM topics t
     WHERE t.chapter_id IN (SELECT id FROM chapters WHERE grade_id = 10)`
  );
  console.log('Topics in Class 10 (total:', topics.length, '):');
  console.log(topics.map(t => ({ id: t.id, name: t.name, chapter_id: t.chapter_id, sessions: t.session_count, ended_sessions: t.ended_session_count })));

  const [sessions] = await connection.execute('SELECT id, topic_id, topic_name, status FROM live_sessions LIMIT 15');
  console.log('Recent Live Sessions in DB:', sessions);

  await connection.end();
}

main().catch(console.error);

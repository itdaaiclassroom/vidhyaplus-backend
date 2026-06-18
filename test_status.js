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

  // Get Biology chapter IDs for Class 10
  // Subject 6 is Biology (or let's find the correct ID)
  const [subjects] = await connection.execute('SELECT id, subject_name FROM subjects WHERE subject_name LIKE "%Biology%"');
  console.log('Biology subjects:', subjects);
  if (subjects.length === 0) {
    console.log('No Biology subject found');
    await connection.end();
    return;
  }
  const subjectId = subjects[0].id;

  const [chapters] = await connection.execute(
    'SELECT id, chapter_name FROM chapters WHERE grade_id = 10 AND subject_id = ?',
    [subjectId]
  );
  console.log(`Found ${chapters.length} chapters for Biology Class 10`);
  if (chapters.length === 0) {
    await connection.end();
    return;
  }

  const chapterIds = chapters.map(c => c.id);
  const placeholders = chapterIds.map(() => '?').join(',');

  const query = `
    SELECT id, chapter_id, name AS topic_name, order_num AS topic_order,
           (
             SELECT CASE 
               WHEN COUNT(CASE WHEN ls.status IN ('ended', 'completed') THEN 1 END) > 0 THEN 'completed'
               WHEN COUNT(CASE WHEN ls.status IN ('active', 'ongoing') THEN 1 END) > 0 THEN 'in_progress'
               ELSE 'not_started'
             END
             FROM live_sessions ls
             WHERE ls.topic_id = topics.id
           ) AS status
    FROM topics
    WHERE chapter_id IN (${placeholders})
    ORDER BY chapter_id, order_num, name
  `;

  const [rows] = await connection.query(query, chapterIds);
  
  const statusCounts = { completed: 0, in_progress: 0, not_started: 0 };
  rows.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  console.log('Status counts:', statusCounts);
  console.log('Sample rows:', rows.slice(0, 10));

  await connection.end();
}

main().catch(console.error);

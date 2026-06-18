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
  const [chapters] = await connection.execute(
    'SELECT id FROM chapters WHERE grade_id = 10 AND subject_id = 6'
  );
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
  console.log('Computed status for Biology class 10 topics:', rows);
  await connection.end();
}

main().catch(console.error);

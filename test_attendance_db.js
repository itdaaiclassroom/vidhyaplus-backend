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

  const [matches] = await connection.execute(`
    SELECT COUNT(*) AS count 
    FROM attendance a 
    JOIN students s ON s.id = a.student_id
  `);
  console.log('Matching students in attendance and students table:', matches[0].count);

  const [studentIds] = await connection.execute(`SELECT id, name, school_id FROM students LIMIT 5`);
  console.log('Sample students:', studentIds);

  const [schoolIds] = await connection.execute(`SELECT id, school_name FROM schools`);
  console.log('Schools:', schoolIds);

  await connection.end();
}

main().catch(console.error);

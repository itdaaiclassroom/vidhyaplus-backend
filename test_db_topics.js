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

  const [rows] = await connection.execute('SELECT status, COUNT(*) AS count FROM topics GROUP BY status');
  console.log('Topics status counts in DB column:', rows);

  const [desc] = await connection.execute('DESCRIBE topics');
  console.log('Topics columns:', desc.map(d => ({ field: d.Field, type: d.Type })));

  await connection.end();
}

main().catch(console.error);

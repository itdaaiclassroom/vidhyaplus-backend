import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection("mysql://root:FxubTzEogjJKnNItWKKJqZMElZSpArbx@shinkansen.proxy.rlwy.net:53040/railway");
  try {
    console.log("Dropping trigger...");
    await connection.query("DROP TRIGGER IF EXISTS trg_students_before_insert_rollno");
    console.log("Trigger dropped successfully.");
  } catch (err) {
    console.error("Error dropping trigger:", err);
  } finally {
    await connection.end();
  }
}

main();

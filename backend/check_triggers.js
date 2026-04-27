import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection("mysql://root:FxubTzEogjJKnNItWKKJqZMElZSpArbx@shinkansen.proxy.rlwy.net:53040/railway");
  try {
    console.log("SHOWING TRIGGERS...");
    const [rows] = await connection.query("SHOW TRIGGERS LIKE 'students'");
    console.table(rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await connection.end();
  }
}

main();

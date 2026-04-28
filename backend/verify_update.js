import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection("mysql://root:FxubTzEogjJKnNItWKKJqZMElZSpArbx@shinkansen.proxy.rlwy.net:53040/railway");
  try {
    const studentId = 1; // Try to update the first student
    console.log(`Manually updating student ID ${studentId}...`);
    const [result] = await connection.query(
      "UPDATE students SET first_name = ? WHERE id = ?",
      ["UpdatedName", studentId]
    );
    console.log("Update result:", result);
    
    const [rows] = await connection.query("SELECT first_name FROM students WHERE id = ?", [studentId]);
    console.log("Verification - Current first_name:", rows[0]?.first_name);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await connection.end();
  }
}

main();

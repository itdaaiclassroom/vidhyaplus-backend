import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection("mysql://root:FxubTzEogjJKnNItWKKJqZMElZSpArbx@shinkansen.proxy.rlwy.net:53040/railway");
  try {
    const id = 1; // Change to an existing student ID
    const body = {
      first_name: "NewFirstName_" + Date.now(),
      last_name: "NewLastName",
      category: "B",
      phone: "9999999999",
      aadhaar: "123412341234"
    };
    
    console.log(`Simulating update for student ID ${id}...`);
    const updates = [];
    const values = [];
    
    if (body.first_name !== undefined) { updates.push("first_name = ?"); values.push(String(body.first_name).trim()); }
    if (body.last_name !== undefined) { updates.push("last_name = ?"); values.push(String(body.last_name).trim()); }
    if (body.category !== undefined) { updates.push("category = ?"); values.push(body.category); }
    
    const resolvedPhone = body.phone !== undefined ? body.phone : body.phone_number;
    if (resolvedPhone !== undefined) { updates.push("phone_number = ?"); values.push(resolvedPhone); }
    if (body.aadhaar !== undefined) { updates.push("aadhaar = ?"); values.push(body.aadhaar); }

    values.push(id);
    const sql = `UPDATE students SET ${updates.join(", ")} WHERE id = ?`;
    console.log("SQL:", sql, values);
    
    const [result] = await connection.query(sql, values);
    console.log("Result:", result);
    
    const [rows] = await connection.query("SELECT first_name, last_name, category, phone_number, aadhaar FROM students WHERE id = ?", [id]);
    console.log("Current Data in DB:", rows[0]);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await connection.end();
  }
}

main();

import getPool from "./backend/server/config/db.js";

async function search() {
  const db = getPool();
  try {
    const [tables] = await db.query("SHOW TABLES");
    console.log("Searching database for 'Rohit'...");
    
    for (const tRow of tables) {
      const tableName = Object.values(tRow)[0];
      const [columns] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
      
      const conditions = [];
      const params = [];
      for (const col of columns) {
        const type = col.Type.toLowerCase();
        if (type.includes("char") || type.includes("text") || type.includes("varchar")) {
          conditions.push(`\`${col.Field}\` LIKE ?`);
          params.push('%Rohit%');
        }
      }
      
      if (conditions.length > 0) {
        const query = `SELECT * FROM \`${tableName}\` WHERE ${conditions.join(" OR ")}`;
        const [rows] = await db.query(query, params);
        if (rows.length > 0) {
          console.log(`Found match in table "${tableName}":`, JSON.stringify(rows, null, 2));
        }
      }
    }
    
    console.log("Database search complete.");
    process.exit(0);
  } catch (err) {
    console.error("Search error:", err);
    process.exit(1);
  }
}
search();

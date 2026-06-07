const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function updateSchema() {
  try {
    const db = await mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vidhyaplus',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log("Adding mandal and district columns to admins table...");
    
    try {
      await db.query("ALTER TABLE admins ADD COLUMN mandal VARCHAR(100) DEFAULT NULL;");
      console.log("Added mandal column.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("Mandal column already exists.");
      } else {
        throw e;
      }
    }

    try {
      await db.query("ALTER TABLE admins ADD COLUMN district VARCHAR(100) DEFAULT NULL;");
      console.log("Added district column.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("District column already exists.");
      } else {
        throw e;
      }
    }

    console.log("Schema update complete!");
    process.exit(0);
  } catch (error) {
    console.error("Error updating schema:", error);
    process.exit(1);
  }
}

updateSchema();

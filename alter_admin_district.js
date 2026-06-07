import getPool from './backend/server/config/db.js';

async function updateSchema() {
  try {
    const db = getPool();
    console.log("Adding mandal and district columns to admins table...");
    
    try {
      await db.query("ALTER TABLE admins ADD COLUMN mandal VARCHAR(100) DEFAULT NULL;");
      console.log("Added mandal column.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("Mandal column already exists.");
      } else {
        console.log("Error adding mandal:", e.message);
      }
    }

    try {
      await db.query("ALTER TABLE admins ADD COLUMN district VARCHAR(100) DEFAULT NULL;");
      console.log("Added district column.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("District column already exists.");
      } else {
        console.log("Error adding district:", e.message);
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

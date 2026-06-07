import getPool from "./backend/server/config/db.js";

async function applyProfileChanges() {
  const db = getPool();
  try {
    console.log("Applying profile database changes...");

    // 1. Alter admins table
    try {
      await db.query(`ALTER TABLE admins 
        ADD COLUMN phone VARCHAR(20) NULL,
        ADD COLUMN location VARCHAR(255) NULL,
        ADD COLUMN mandal VARCHAR(255) NULL,
        ADD COLUMN district VARCHAR(255) NULL,
        ADD COLUMN language VARCHAR(100) NULL,
        ADD COLUMN designation VARCHAR(255) NULL;`);
      console.log("Added profile columns to admins table.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("Profile columns already exist in admins table.");
      else throw e;
    }

    // 2. Alter teachers table
    try {
      await db.query(`ALTER TABLE teachers 
        ADD COLUMN phone VARCHAR(20) NULL,
        ADD COLUMN designation VARCHAR(255) NULL,
        ADD COLUMN skills JSON NULL,
        ADD COLUMN experience VARCHAR(255) NULL,
        ADD COLUMN highest_qualification VARCHAR(255) NULL;`);
      console.log("Added profile columns to teachers table.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("Profile columns already exist in teachers table.");
      else throw e;
    }

    console.log("All profile database changes applied successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error applying database changes:", error);
    process.exit(1);
  }
}

applyProfileChanges();

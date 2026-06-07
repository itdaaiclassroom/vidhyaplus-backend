import getPool from './backend/server/config/db.js';

async function run() {
  try {
    const db = getPool();
    // Use IF NOT EXISTS equivalent by trying and catching if column exists, or just query schema
    const [cols] = await db.query(`SHOW COLUMNS FROM admins LIKE 'designation'`);
    if (cols.length === 0) {
      await db.query(`ALTER TABLE admins ADD COLUMN designation VARCHAR(255) DEFAULT NULL`);
      console.log('Column "designation" added to admins table.');
    } else {
      console.log('Column "designation" already exists.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error altering table:', err);
    process.exit(1);
  }
}
run();

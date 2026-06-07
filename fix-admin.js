import getPool from './backend/server/config/db.js';

async function fix() {
  try {
    const db = getPool();
    const [result] = await db.query("UPDATE admins SET role='superadmin'");
    console.log('Updated:', result.affectedRows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

fix();

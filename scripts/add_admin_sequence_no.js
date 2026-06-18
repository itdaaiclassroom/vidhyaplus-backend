import getPool from '../backend/server/config/db.js';

async function run() {
  try {
    const db = getPool();
    
    // 1. Check if sequence_no column exists in admins table
    const [cols] = await db.query(`SHOW COLUMNS FROM admins LIKE 'sequence_no'`);
    if (cols.length === 0) {
      await db.query(`ALTER TABLE admins ADD COLUMN sequence_no INT UNSIGNED DEFAULT NULL`);
      console.log('Column "sequence_no" added to admins table.');
    } else {
      console.log('Column "sequence_no" already exists.');
    }

    // 2. Populate sequence numbers for existing admins
    // Fetch all admins grouped by role, sorted by ID ascending
    const [admins] = await db.query(`SELECT id, role FROM admins ORDER BY id ASC`);
    
    // Track sequence per role
    const seqMap = {};
    for (const admin of admins) {
      const role = admin.role || 'admin';
      if (!seqMap[role]) {
        seqMap[role] = 1;
      } else {
        seqMap[role]++;
      }
      const seqNo = seqMap[role];
      await db.query(`UPDATE admins SET sequence_no = ? WHERE id = ?`, [seqNo, admin.id]);
      console.log(`Updated admin ${admin.id} (${role}) to sequence_no ${seqNo}`);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

run();

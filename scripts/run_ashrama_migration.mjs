import getPool from '../backend/server/config/db.js';
import fs from 'fs';

async function runMigration() {
  const db = getPool();
  const sqlFile = 'scripts/fix_rollno_trigger.sql';
  
  const content = fs.readFileSync(sqlFile, 'utf8');
  // Simple split that works for our specific file (split by empty line after semicolon)
  const statements = content.split(/;\s*\n\s*CREATE/).map((s, i) => i === 0 ? s + ';' : 'CREATE' + s).filter(s => s.trim().length > 0);
  
  try {
    console.log('Running Ashrama students extension migration...');
    for (const statement of statements) {
      await db.query(statement);
    }
    console.log('Migration successful!');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column already exists, skipping.');
    } else {
      console.error('Migration failed:', err.message);
    }
  } finally {
    process.exit();
  }
}

runMigration();

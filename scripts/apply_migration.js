import getPool from '../backend/server/config/db.js';
import fs from 'fs';

async function runMigration() {
  const db = getPool();
  const sqlFile = 'scripts/admin_dashboard_extension.sql';
  if (!fs.existsSync(sqlFile)) {
    console.error(`File not found: ${sqlFile}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(sqlFile, 'utf8');
  const statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  try {
    console.log('Running migration...');
    for (const statement of statements) {
      if (statement.toLowerCase().startsWith('use ')) continue;
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

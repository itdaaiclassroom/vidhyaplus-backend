import getPool from '../config/db.js';

async function run() {
  const db = getPool();
  try {
    console.log('Adding assigned_for column...');
    await db.query("ALTER TABLE subject_quiz_bank ADD COLUMN assigned_for VARCHAR(50) DEFAULT 'both' AFTER explanation");
    console.log('Successfully added assigned_for column.');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column assigned_for already exists.');
    } else {
      console.error('Error adding column:', err);
    }
  } finally {
    process.exit();
  }
}

run();

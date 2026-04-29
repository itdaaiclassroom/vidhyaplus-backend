import 'dotenv/config';
import mysql from 'mysql2/promise';

async function fixTriggers() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true
  });

  try {
    console.log('Dropping and recreating triggers...');
    
    const sql = `
      DROP TRIGGER IF EXISTS trg_attendance_after_insert;
      CREATE TRIGGER trg_attendance_after_insert AFTER INSERT ON attendance
      FOR EACH ROW BEGIN
        CALL sp_recompute_class_attendance_summary(NEW.class_id, NEW.attendance_date);
      END;

      DROP TRIGGER IF EXISTS trg_attendance_after_delete;
      CREATE TRIGGER trg_attendance_after_delete AFTER DELETE ON attendance
      FOR EACH ROW BEGIN
        CALL sp_recompute_class_attendance_summary(OLD.class_id, OLD.attendance_date);
      END;
    `;

    // Note: Recreating triggers might require DELIMITER in some environments, 
    // but with multipleStatements: true and separate queries, we can do them one by one.
    
    await pool.query("DROP TRIGGER IF EXISTS trg_attendance_after_insert");
    await pool.query(`
      CREATE TRIGGER trg_attendance_after_insert AFTER INSERT ON attendance
      FOR EACH ROW BEGIN
        CALL sp_recompute_class_attendance_summary(NEW.class_id, NEW.attendance_date);
      END
    `);

    await pool.query("DROP TRIGGER IF EXISTS trg_attendance_after_delete");
    await pool.query(`
      CREATE TRIGGER trg_attendance_after_delete AFTER DELETE ON attendance
      FOR EACH ROW BEGIN
        CALL sp_recompute_class_attendance_summary(OLD.class_id, OLD.attendance_date);
      END
    `);

    console.log('Triggers fixed successfully!');
  } catch (err) {
    console.error('Error fixing triggers:', err.message);
  } finally {
    await pool.end();
  }
}

fixTriggers();

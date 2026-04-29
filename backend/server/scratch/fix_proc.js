import 'dotenv/config';
import mysql from 'mysql2/promise';

async function fixProc() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    console.log('Fixing stored procedure...');
    
    await pool.query('DROP PROCEDURE IF EXISTS sp_recompute_class_attendance_summary');
    
    const createProcSql = `
      CREATE PROCEDURE sp_recompute_class_attendance_summary(
        IN p_class_id INT,
        IN p_date DATE
      )
      BEGIN
        DECLARE v_present INT;
        DECLARE v_absent INT;
        DECLARE v_absent_rolls TEXT;

        SELECT
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END),
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END),
          GROUP_CONCAT(st.roll_no ORDER BY st.roll_no SEPARATOR ',')
        INTO
          v_present,
          v_absent,
          v_absent_rolls
        FROM attendance a
        JOIN students st ON st.id = a.student_id
        WHERE a.class_id = p_class_id AND a.attendance_date = p_date AND a.status = 'absent';

        SELECT
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END),
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)
        INTO v_present, v_absent
        FROM attendance
        WHERE class_id = p_class_id AND attendance_date = p_date;

        INSERT INTO class_attendance_summary (class_id, attendance_date, present_count, absent_count, absent_roll_nos)
        VALUES (p_class_id, p_date, COALESCE(v_present, 0), COALESCE(v_absent, 0), v_absent_rolls)
        ON DUPLICATE KEY UPDATE
          present_count = VALUES(present_count),
          absent_count = VALUES(absent_count),
          absent_roll_nos = VALUES(absent_roll_nos);
      END
    `;

    await pool.query(createProcSql);
    console.log('Stored procedure fixed successfully!');
  } catch (err) {
    console.error('Error fixing procedure:', err.message);
  } finally {
    await pool.end();
  }
}

fixProc();

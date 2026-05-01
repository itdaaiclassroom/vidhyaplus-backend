import getPool from "../config/db.js";
import { toId } from "../utils.js";

/**
 * Admin Overview Analytics
 */
export async function getDashboardOverview(req, res) {
  const db = getPool();
  try {
    const [[schoolsCount]] = await db.query("SELECT COUNT(*) as total FROM schools");
    const [[teachersCount]] = await db.query("SELECT COUNT(*) as total FROM teachers");
    const [[studentsCount]] = await db.query("SELECT COUNT(*) as total FROM students");
    const [[sessionsCompleted]] = await db.query("SELECT COUNT(*) as total FROM live_sessions WHERE status = 'completed'");
    const [[totalSessionsPlanned]] = await db.query("SELECT SUM(planned_periods) as total FROM chapters");

    res.json({
      totalSchools: schoolsCount.total,
      totalTeachers: teachersCount.total,
      totalStudents: studentsCount.total,
      sessionsCompleted: sessionsCompleted.total,
      sessionsTotal: totalSessionsPlanned.total || 1200, // Fallback as per requirement e.g., 900/1200
    });
  } catch (err) {
    console.error("Dashboard overview error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

/**
 * Analytics Charts Data
 */
export async function getAnalyticsData(req, res) {
  const db = getPool();
  const days = 7; // Last 7 days
  try {
    // Student Analytics (Daily Active Students)
    const [studentStats] = await db.query(`
      SELECT DATE(created_at) as date, COUNT(DISTINCT student_id) as active 
      FROM student_qr_codes 
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);

    // Teacher Analytics (Daily Active Teachers)
    const [teacherStats] = await db.query(`
      SELECT DATE(session_date) as date, COUNT(DISTINCT teacher_id) as active
      FROM live_sessions
      WHERE session_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY session_date
      ORDER BY session_date ASC
    `, [days]);

    // Session Analytics
    const [[sessionStats]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM live_sessions WHERE status = 'completed') as completed,
        (SELECT COUNT(*) FROM live_sessions WHERE status != 'completed') as remaining
    `);

    res.json({
      students: studentStats,
      teachers: teacherStats,
      sessions: {
        completed: sessionStats.completed,
        remaining: sessionStats.remaining,
        total: sessionStats.completed + sessionStats.remaining
      }
    });
  } catch (err) {
    console.error("Analytics data error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

/**
 * Announcements Management
 */
export async function createAnnouncement(req, res) {
  const db = getPool();
  const { title, message, target_role, target_school_id } = req.body;
  const adminId = req.user.id; // From JWT

  if (!title || !message) return res.status(400).json({ error: "Title and message required" });

  try {
    await db.query(
      "INSERT INTO announcements (sender_admin_id, title, message, target_role, target_school_id) VALUES (?, ?, ?, ?, ?)",
      [adminId, title, message, target_role || 'teacher', target_school_id || null]
    );
    res.json({ ok: true, message: "Announcement sent" });
  } catch (err) {
    console.error("Create announcement error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function getAnnouncements(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/**
 * Activity Logs
 */
export async function getTeacherLogs(req, res) {
  const db = getPool();
  const { teacher_id } = req.query;
  try {
    let sql = `
      SELECT l.*, t.full_name as teacher_name 
      FROM teacher_activity_logs l
      JOIN teachers t ON t.id = l.teacher_id
    `;
    const params = [];
    if (teacher_id) {
      sql += " WHERE l.teacher_id = ?";
      params.push(teacher_id);
    }
    sql += " ORDER BY l.created_at DESC LIMIT 100";
    
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/**
 * Admin Management (UserManagement)
 */
export async function getAdmins(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT id, name, email, role, created_at FROM admins");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

export async function createAdmin(req, res) {
  const db = getPool();
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    await db.query(
      "INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, password, role || 'admin']
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/**
 * Subject-wise Performance Data
 */
export async function getSubjectPerformance(req, res) {
  const db = getPool();
  try {
    // 1. Average Quiz Scores per Subject
    const [scoreStats] = await db.query(`
      SELECT 
        s.subject_name as subject,
        ROUND(AVG(sm.score * 100 / sm.total), 1) as avgScore
      FROM student_marks sm
      JOIN chapters c ON c.id = sm.chapter_id
      JOIN subjects s ON s.id = c.subject_id
      GROUP BY s.id, s.subject_name
    `);

    // 2. Session Count per Subject
    const [sessionStats] = await db.query(`
      SELECT 
        s.subject_name as subject,
        COUNT(*) as sessionCount
      FROM live_sessions ls
      JOIN subjects s ON s.id = ls.subject_id
      WHERE ls.status = 'completed'
      GROUP BY s.id, s.subject_name
    `);

    // Merge results
    const performance = scoreStats.map(stat => {
      const session = sessionStats.find(s => s.subject === stat.subject);
      return {
        ...stat,
        sessions: session ? session.sessionCount : 0
      };
    });

    res.json(performance);
  } catch (err) {
    console.error("Subject performance error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

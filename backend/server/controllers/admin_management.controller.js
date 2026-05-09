import getPool from "../config/db.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/* ──────────────────────────────────────────────
   Helpers
────────────────────────────────────────────── */

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

/* ═══════════════════════════════════════════════
   DASHBOARD OVERVIEW & ANALYTICS
═══════════════════════════════════════════════ */

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
      sessionsTotal: totalSessionsPlanned.total || 1200,
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
  const days = 7;
  try {
    const [studentStats] = await db.query(`
      SELECT DATE(created_at) as date, COUNT(DISTINCT student_id) as active 
      FROM student_qr_codes 
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);

    const [teacherStats] = await db.query(`
      SELECT DATE(session_date) as date, COUNT(DISTINCT teacher_id) as active
      FROM live_sessions
      WHERE session_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY session_date
      ORDER BY session_date ASC
    `, [days]);

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

/* ═══════════════════════════════════════════════
   ANNOUNCEMENTS
═══════════════════════════════════════════════ */

export async function createAnnouncement(req, res) {
  const db = getPool();
  const { title, message, target_role, target_school_id } = req.body;
  const adminId = req.user.id;

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

/* ═══════════════════════════════════════════════
   ACTIVITY LOGS
═══════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════
   ADMIN MANAGEMENT — FULL CRUD
═══════════════════════════════════════════════ */

/** GET /api/admin/management — list all admins */
export async function getAdmins(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, role, created_at FROM admins ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** GET /api/admin/management/:id — single admin */
export async function getAdmin(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const [rows] = await db.query(
      "SELECT id, name, email, role, created_at FROM admins WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: "Admin not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** POST /api/admin/management — create admin (password is bcrypt-hashed) */
export async function createAdmin(req, res) {
  const db = getPool();
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }

  try {
    // Check for duplicate email
    const [existing] = await db.query(
      "SELECT id FROM admins WHERE email = ? LIMIT 1",
      [String(email).trim().toLowerCase()]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "An admin with this email already exists" });
    }

    const hashed = await hashPassword(password);
    const [result] = await db.query(
      "INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)",
      [String(name).trim(), String(email).trim().toLowerCase(), hashed, role || "admin"]
    );

    res.status(201).json({
      ok: true,
      id: String(result.insertId),
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      role: role || "admin"
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** PUT /api/admin/management/:id — update admin */
export async function updateAdmin(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  const { name, email, password, role } = req.body;

  try {
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push("name = ?"); values.push(String(name).trim()); }
    if (email !== undefined) { updates.push("email = ?"); values.push(String(email).trim().toLowerCase()); }
    if (password !== undefined && password !== "") {
      const hashed = await hashPassword(password);
      updates.push("password = ?");
      values.push(hashed);
    }
    if (role !== undefined) { updates.push("role = ?"); values.push(String(role).trim()); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    await db.query(`UPDATE admins SET ${updates.join(", ")} WHERE id = ?`, values);
    res.json({ ok: true, id: String(id) });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** DELETE /api/admin/management/:id — delete admin (cannot self-delete) */
export async function deleteAdmin(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  // Prevent self-deletion
  if (req.user && String(req.user.id) === String(id)) {
    return res.status(403).json({ error: "Cannot delete your own admin account" });
  }

  try {
    const [result] = await db.query("DELETE FROM admins WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Admin not found" });
    res.json({ ok: true, deleted: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/* ═══════════════════════════════════════════════
   TEAM MANAGEMENT — FULL CRUD
   (Department-level teams: material_management,
    timetable, attendance, etc.)
═══════════════════════════════════════════════ */

/** GET /api/admin/teams — list all teams */
export async function getTeams(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query(
      `SELECT id, team_name, email, role, district, is_active, created_by, created_at
       FROM admin_teams
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** GET /api/admin/teams/:id — single team */
export async function getTeam(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const [rows] = await db.query(
      `SELECT id, team_name, email, role, district, is_active, created_by, created_at
       FROM admin_teams WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: "Team not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** POST /api/admin/teams — create team */
export async function createTeam(req, res) {
  const db = getPool();
  const { team_name, email, password, role, district } = req.body;
  const createdBy = req.user?.id || null;

  if (!team_name || !email || !password || !role) {
    return res.status(400).json({ error: "team_name, email, password and role are required" });
  }

  try {
    // Check duplicate email
    const [existing] = await db.query(
      "SELECT id FROM admin_teams WHERE email = ? LIMIT 1",
      [String(email).trim().toLowerCase()]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "A team with this email already exists" });
    }

    const hashed = await hashPassword(password);
    const [result] = await db.query(
      `INSERT INTO admin_teams (team_name, email, password, role, district, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(team_name).trim(),
        String(email).trim().toLowerCase(),
        hashed,
        String(role).trim(),
        district ? String(district).trim() : null,
        createdBy
      ]
    );

    res.status(201).json({
      ok: true,
      id: String(result.insertId),
      team_name: String(team_name).trim(),
      email: String(email).trim().toLowerCase(),
      role: String(role).trim(),
      district: district || null
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** PUT /api/admin/teams/:id — update team */
export async function updateTeam(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  const { team_name, email, password, role, district, is_active } = req.body;

  try {
    const updates = [];
    const values = [];

    if (team_name !== undefined) { updates.push("team_name = ?"); values.push(String(team_name).trim()); }
    if (email !== undefined) { updates.push("email = ?"); values.push(String(email).trim().toLowerCase()); }
    if (password !== undefined && password !== "") {
      const hashed = await hashPassword(password);
      updates.push("password = ?");
      values.push(hashed);
    }
    if (role !== undefined) { updates.push("role = ?"); values.push(String(role).trim()); }
    if (district !== undefined) { updates.push("district = ?"); values.push(district ? String(district).trim() : null); }
    if (is_active !== undefined) { updates.push("is_active = ?"); values.push(is_active ? 1 : 0); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    await db.query(`UPDATE admin_teams SET ${updates.join(", ")} WHERE id = ?`, values);
    res.json({ ok: true, id: String(id) });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** DELETE /api/admin/teams/:id — delete team */
export async function deleteTeam(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const [result] = await db.query("DELETE FROM admin_teams WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Team not found" });
    res.json({ ok: true, deleted: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/* ═══════════════════════════════════════════════
   SUBJECT PERFORMANCE
═══════════════════════════════════════════════ */

export async function getSubjectPerformance(req, res) {
  const db = getPool();
  try {
    const [scoreStats] = await db.query(`
      SELECT 
        s.subject_name as subject,
        ROUND(AVG(sm.score * 100 / sm.total), 1) as avgScore
      FROM student_marks sm
      JOIN chapters c ON c.id = sm.chapter_id
      JOIN subjects s ON s.id = c.subject_id
      GROUP BY s.id, s.subject_name
    `);

    const [sessionStats] = await db.query(`
      SELECT 
        s.subject_name as subject,
        COUNT(*) as sessionCount
      FROM live_sessions ls
      JOIN subjects s ON s.id = ls.subject_id
      WHERE ls.status = 'completed'
      GROUP BY s.id, s.subject_name
    `);

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

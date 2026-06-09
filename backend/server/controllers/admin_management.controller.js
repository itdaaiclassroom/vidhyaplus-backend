import getPool from "../config/db.js";
import bcrypt from "bcrypt";
import { auditLog, actorFromReq } from "../utils/auditLogger.js";
import { generateReport, getAnalyticsSummary } from "../services/reportSummary.service.js";

const SALT_ROUNDS = 10;
const ALLOWED_TEAM_ROLES = [
  "material_management",   // Can upload/manage textbooks, PPTs, question banks
  "school_management",     // Can create/update/delete schools
  "student_management",    // Can create/update/delete students and manage attendance
  "teacher_management",    // Can create/update/delete teachers and manage attendance
];

/* ──────────────────────────────────────────────
   Helpers
────────────────────────────────────────────── */

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

/* ═══════════════════════════════════════════════
   DASHBOARD OVERVIEW & ANALYTICS
═══════════════════════════════════════════════ */

export async function getDashboardOverview(req, res) {
  const db = getPool();
  const date = req.query.date || new Date().toLocaleDateString('en-CA');
  try {
    const [[schoolsCount]] = await db.query("SELECT COUNT(*) as total FROM schools");
    const [[teachersCount]] = await db.query("SELECT COUNT(*) as total FROM teachers");
    const [[studentsCount]] = await db.query("SELECT COUNT(*) as total FROM students");
    const [[sessionsCompleted]] = await db.query("SELECT COUNT(*) as total FROM live_sessions WHERE status = 'completed'");
    const [[totalSessionsPlanned]] = await db.query("SELECT SUM(planned_periods) as total FROM chapters");

    // Daily Student Attendance on the selected date
    const [[studentAttRows]] = await db.query(`
      SELECT 
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance
      WHERE attendance_date = ?
    `, [date]);

    // Daily Teacher Attendance on the selected date
    const [[teacherAttRows]] = await db.query(`
      SELECT 
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_count
      FROM teacher_attendance
      WHERE attendance_date = ?
    `, [date]);

    // Daily Session stats on the selected date
    const [[dailySessionStats]] = await db.query(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COUNT(*) as total
      FROM live_sessions
      WHERE DATE(session_date) = ?
    `, [date]);

    res.json({
      totalSchools: schoolsCount.total,
      totalTeachers: teachersCount.total,
      totalStudents: studentsCount.total,
      sessionsCompleted: sessionsCompleted.total,
      sessionsTotal: totalSessionsPlanned.total || 1200,
      studentAttendance: {
        total: studentsCount.total,
        present: Number(studentAttRows.present) || 0,
        absent: Number(studentAttRows.absent) || 0
      },
      teacherAttendance: {
        total: teachersCount.total,
        present: Number(teacherAttRows.present) || 0,
        absent: Number(teacherAttRows.absent) || 0,
        leave: Number(teacherAttRows.leave_count) || 0
      },
      sessions: {
        total: Number(dailySessionStats.total) || 0,
        completed: Number(dailySessionStats.completed) || 0
      }
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

  // Normalize: 'teachers', 'principals', or 'all'
  const effectiveRole = target_role || 'all';

  try {
    const [result] = await db.query(
      "INSERT INTO announcements (sender_admin_id, title, message, target_role, target_school_id) VALUES (?, ?, ?, ?, ?)",
      [adminId, title, message, effectiveRole, target_school_id || null]
    );

    // Also insert into broadcast_messages for backward compat
    try {
      // Map target_role to target_audience enum: 'all', 'teachers', 'principals'
      let broadcastAudience = 'all';
      if (effectiveRole === 'teacher' || effectiveRole === 'teachers') broadcastAudience = 'teachers';
      else if (effectiveRole === 'principal' || effectiveRole === 'principals') broadcastAudience = 'principals';

      await db.query(
        "INSERT INTO broadcast_messages (message, target_audience) VALUES (?, ?)",
        [`${title}: ${message}`, broadcastAudience]
      );
    } catch (_) { /* broadcast_messages table may not exist yet */ }

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "CREATE",
      entity:    "announcement",
      entity_id: String(result.insertId),
      meta:      { title, target_role: effectiveRole, target_school_id: target_school_id || null },
      req,
    });

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
      "SELECT id, name, email, phone, location, mandal, district, role, designation, permissions, created_at FROM admins ORDER BY created_at DESC"
    );
    // parse permissions string to JSON
    const parsedRows = rows.map(r => {
      let p = {};
      try {
        if (typeof r.permissions === 'string') p = JSON.parse(r.permissions);
        else if (r.permissions) p = r.permissions;
      } catch (e) {}
      return { ...r, permissions: p };
    });
    res.json(parsedRows);
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
      "SELECT id, name, email, phone, location, mandal, district, role, designation, permissions, created_at FROM admins WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: "Admin not found" });
    
    let p = {};
    try {
      if (typeof rows[0].permissions === 'string') p = JSON.parse(rows[0].permissions);
      else if (rows[0].permissions) p = rows[0].permissions;
    } catch (e) {}
    
    res.json({ ...rows[0], permissions: p });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
}

/** POST /api/admin/management — create admin (password is bcrypt-hashed) */
export async function createAdmin(req, res) {
  const db = getPool();
  const { name, email, phone, location, mandal, district, password, role, permissions, designation } = req.body;

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
    const permsJson = permissions ? JSON.stringify(permissions) : '{}';
    
    const [result] = await db.query(
      "INSERT INTO admins (name, email, phone, location, mandal, district, password, role, permissions, designation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [String(name).trim(), String(email).trim().toLowerCase(), phone || null, location || null, mandal || null, district || null, hashed, role || "admin", permsJson, designation ? String(designation).trim() : null]
    );

    const newId = String(result.insertId);
    const finalRole = role || "admin";

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "CREATE",
      entity:    "admin",
      entity_id: newId,
      meta:      { name: String(name).trim(), email: String(email).trim().toLowerCase(), role: finalRole },
      req,
    });

    res.status(201).json({
      ok: true,
      id: newId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      role: finalRole,
      phone: phone || null,
      location: location || null,
      mandal: mandal || null,
      district: district || null,
      designation: designation ? String(designation).trim() : null,
      permissions: permissions || {}
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

  const { name, email, phone, location, mandal, district, password, role, permissions, designation } = req.body;

  try {
    const updates = [];
    const values = [];
    const changedFields = {};

    if (name !== undefined) { updates.push("name = ?"); values.push(String(name).trim()); changedFields.name = String(name).trim(); }
    if (email !== undefined) { updates.push("email = ?"); values.push(String(email).trim().toLowerCase()); changedFields.email = String(email).trim().toLowerCase(); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); changedFields.phone = phone; }
    if (location !== undefined) { updates.push("location = ?"); values.push(location); changedFields.location = location; }
    if (mandal !== undefined) { updates.push("mandal = ?"); values.push(mandal); changedFields.mandal = mandal; }
    if (district !== undefined) { updates.push("district = ?"); values.push(district); changedFields.district = district; }
    if (password !== undefined && password !== "") {
      const hashed = await hashPassword(password);
      updates.push("password = ?");
      values.push(hashed);
      changedFields.password = "[CHANGED]";
    }
    if (role !== undefined) { updates.push("role = ?"); values.push(String(role).trim()); changedFields.role = String(role).trim(); }
    if (permissions !== undefined) {
      updates.push("permissions = ?"); 
      values.push(JSON.stringify(permissions));
      changedFields.permissions = "[CHANGED]";
    }
    if (designation !== undefined) {
      updates.push("designation = ?");
      values.push(designation ? String(designation).trim() : null);
      changedFields.designation = designation ? String(designation).trim() : null;
    }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    await db.query(`UPDATE admins SET ${updates.join(", ")} WHERE id = ?`, values);

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "UPDATE",
      entity:    "admin",
      entity_id: String(id),
      meta:      { changed_fields: changedFields },
      req,
    });

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

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "DELETE",
      entity:    "admin",
      entity_id: String(id),
      req,
    });

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

  if (!ALLOWED_TEAM_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Allowed roles are: ${ALLOWED_TEAM_ROLES.join(", ")}` });
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

    const newId = String(result.insertId);

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "CREATE",
      entity:    "team",
      entity_id: newId,
      meta:      {
        team_name: String(team_name).trim(),
        email:     String(email).trim().toLowerCase(),
        role:      String(role).trim(),
        district:  district || null,
        created_by: createdBy,
      },
      req,
    });

    res.status(201).json({
      ok: true,
      id: newId,
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
    const changedFields = {};

    if (team_name !== undefined) { updates.push("team_name = ?"); values.push(String(team_name).trim()); changedFields.team_name = String(team_name).trim(); }
    if (email !== undefined) { updates.push("email = ?"); values.push(String(email).trim().toLowerCase()); changedFields.email = String(email).trim().toLowerCase(); }
    if (password !== undefined && password !== "") {
      const hashed = await hashPassword(password);
      updates.push("password = ?");
      values.push(hashed);
      changedFields.password = "[CHANGED]";
    }
    if (role !== undefined) { 
      if (!ALLOWED_TEAM_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Allowed roles are: ${ALLOWED_TEAM_ROLES.join(", ")}` });
      }
      updates.push("role = ?"); 
      values.push(String(role).trim()); 
      changedFields.role = String(role).trim(); 
    }
    if (district !== undefined) { updates.push("district = ?"); values.push(district ? String(district).trim() : null); changedFields.district = district || null; }
    if (is_active !== undefined) { updates.push("is_active = ?"); values.push(is_active ? 1 : 0); changedFields.is_active = is_active ? 1 : 0; }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    await db.query(`UPDATE admin_teams SET ${updates.join(", ")} WHERE id = ?`, values);

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "UPDATE",
      entity:    "team",
      entity_id: String(id),
      meta:      { changed_fields: changedFields },
      req,
    });

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

    await auditLog(db, {
      ...actorFromReq(req),
      action:    "DELETE",
      entity:    "team",
      entity_id: String(id),
      req,
    });

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

/* ═══════════════════════════════════════════════
   AUDIT LOGS — System-wide query endpoint
   GET /api/admin/audit-logs
   Query params (all optional):
     actor_role, entity, action, from, to, page, limit
═══════════════════════════════════════════════ */

/**
 * GET /api/admin/audit-logs
 * Returns a paginated, filterable view of the system-wide audit trail.
 * Only accessible by admins (enforced at the router level).
 */
export async function getAuditLogs(req, res) {
  const db = getPool();

  // ── Pagination ───────────────────────────────────────────────────────────
  const page  = Math.max(1, parseInt(req.query.page  || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
  const offset = (page - 1) * limit;

  // ── Filters ──────────────────────────────────────────────────────────────
  const { actor_role, entity, action, from, to, actor_id } = req.query;

  const conditions = [];
  const params     = [];

  if (actor_id)   { conditions.push("actor_id = ?");   params.push(String(actor_id)); }
  if (actor_role) { conditions.push("actor_role = ?"); params.push(String(actor_role)); }
  if (entity)     { conditions.push("entity = ?");     params.push(String(entity).toLowerCase()); }
  if (action)     { conditions.push("action = ?");     params.push(String(action).toUpperCase()); }
  if (from)       { conditions.push("created_at >= ?"); params.push(`${from} 00:00:00`); }
  if (to)         { conditions.push("created_at <= ?"); params.push(`${to} 23:59:59`); }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    // Count total matching records for pagination metadata
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
      params
    );

    // Fetch the page of records
    const [rows] = await db.query(
      `SELECT id, actor_id, actor_role, actor_name, action, entity, entity_id,
              meta, ip_address, user_agent, status, error_msg, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      total: Number(total),
      page,
      limit,
      total_pages: Math.ceil(Number(total) / limit),
      data: rows,
    });
  } catch (err) {
    console.error("getAuditLogs error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

/**
 * Generate Report Summary — uses caching, dedup, retry, and multi-provider AI
 */
export async function generateReportSummary(req, res) {
  try {
    const result = await generateReport(req.body);
    res.json(result);
  } catch (err) {
    console.error("generateReportSummary controller error:", err);
    res.status(500).json({ success: false, error: "Failed to generate report summary" });
  }
}

/**
 * Get Report AI Analytics — cache hits, token savings, etc.
 */
export async function getReportAnalytics(req, res) {
  try {
    const analytics = await getAnalyticsSummary();
    res.json({ success: true, ...analytics });
  } catch (err) {
    console.error("getReportAnalytics error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch report analytics" });
  }
}

/* ═══════════════════════════════════════════════
   ADMIN PROFILE
═══════════════════════════════════════════════ */

export async function getAdminProfile(req, res) {
  try {
    const adminId = req.user.id;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, name AS full_name, email, role, permissions, phone, location, language, designation, mandal, district, created_at FROM admins WHERE id = ?",
      [adminId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Admin not found" });

    const admin = rows[0];
    let parsedPermissions = {};
    try {
      if (typeof admin.permissions === 'string') {
        parsedPermissions = JSON.parse(admin.permissions);
      } else if (admin.permissions && typeof admin.permissions === 'object') {
        parsedPermissions = admin.permissions;
      }
    } catch (e) {
      console.warn("Failed to parse admin permissions in profile get:", e);
    }

    res.json({ ...admin, permissions: parsedPermissions });
  } catch (err) {
    console.error("getAdminProfile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateAdminProfile(req, res) {
  try {
    const adminId = req.user.id;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    const { full_name, email, phone, location, language, password, mandal, district } = req.body;
    const db = getPool();

    // Check if email is being changed and already exists
    if (email) {
      const [emailCheck] = await db.query("SELECT id FROM admins WHERE email = ? AND id != ?", [email, adminId]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    const updates = [];
    const values = [];

    if (full_name !== undefined) { updates.push("name = ?"); values.push(full_name); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); }
    if (location !== undefined) { updates.push("location = ?"); values.push(location); }
    if (language !== undefined) { updates.push("language = ?"); values.push(language); }
    if (mandal !== undefined) { updates.push("mandal = ?"); values.push(mandal); }
    if (district !== undefined) { updates.push("district = ?"); values.push(district); }

    if (password) {
      const hashed = await hashPassword(password);
      updates.push("password = ?");
      values.push(hashed);
    }

    if (updates.length > 0) {
      values.push(adminId);
      await db.query(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, values);
      await auditLog(db, {
        ...actorFromReq(req),
        action: "UPDATE",
        entity: "admin",
        entity_id: String(adminId),
        meta: { updated_fields: updates.map(u => u.split(' ')[0]) },
        req,
      });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("updateAdminProfile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

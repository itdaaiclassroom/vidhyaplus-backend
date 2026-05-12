import getPool from "../config/db.js";
import { auditLog, actorFromReq } from "../utils/auditLogger.js";

export async function createSchool(req, res) {
  const db = getPool();
  const { name, code, district, mandal, principalName, principalEmail, principalPassword } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "name and code are required" });
  }
  try {
    const [insSchool] = await db.query(
      "INSERT INTO schools (school_name, school_code, district, mandal) VALUES (?, ?, ?, ?)",
      [String(name).trim(), String(code).trim(), String(district || "").trim(), mandal != null ? String(mandal).trim() : null]
    );
    const schoolId = insSchool.insertId;

    let principalId = null;
    if (principalEmail && principalPassword) {
      const [insPrincipal] = await db.query(
        "INSERT INTO teachers (full_name, email, password, role, school_id) VALUES (?, ?, ?, 'principal', ?)",
        [principalName || "Principal", principalEmail, principalPassword, schoolId]
      );
      principalId = insPrincipal.insertId;
    }

    res.status(201).json({ 
      id: String(schoolId), 
      name: String(name).trim(), 
      code: String(code).trim(), 
      district: String(district || "").trim(), 
      mandal: mandal != null ? String(mandal).trim() : null,
      principal_id: principalId ? String(principalId) : null
    });

    // Audit log after response is sent
    auditLog(db, {
      ...actorFromReq(req),
      action: "CREATE", entity: "school", entity_id: String(schoolId),
      meta: {
        name: String(name).trim(), code: String(code).trim(),
        district: String(district || "").trim(),
        mandal: mandal != null ? String(mandal).trim() : null,
        principal_id: principalId ? String(principalId) : null,
      },
      req,
    });
  } catch (err) {
    console.error("POST /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function updateSchool(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  const { name, code, district, mandal, sessions_completed, active_status } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push("school_name = ?"); values.push(String(name).trim()); }
    if (code !== undefined) { updates.push("school_code = ?"); values.push(String(code).trim()); }
    if (district !== undefined) { updates.push("district = ?"); values.push(String(district).trim()); }
    if (mandal !== undefined) { updates.push("mandal = ?"); values.push(mandal != null ? String(mandal).trim() : null); }
    if (sessions_completed !== undefined) { updates.push("sessions_completed = ?"); values.push(Number(sessions_completed)); }
    if (active_status !== undefined) { updates.push("active_status = ?"); values.push(active_status ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    await db.query(`UPDATE schools SET ${updates.join(", ")} WHERE id = ?`, values);
    await auditLog(db, {
      ...actorFromReq(req),
      action: "UPDATE", entity: "school", entity_id: String(id),
      meta: { changed_fields: Object.fromEntries(updates.map((u, i) => [u.replace(" = ?",""), values[i]])) },
      req,
    });
    res.json({ id: String(id), updated: true });
  } catch (err) {
    console.error("PUT /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function deleteSchool(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Find all sections and classes belonging to this school
    let sections = [];
    try {
      const [rows] = await connection.query("SELECT id FROM sections WHERE school_id = ?", [id]);
      sections = rows;
    } catch (e) { throw new Error(`Step 1 (Find sections) failed: ${e.message}`); }
    const sectionIds = sections.map(s => s.id);
    
    // 2. Find all students belonging to this school or these sections
    let studentIds = [];
    try {
      const [s1] = await connection.query("SELECT id FROM students WHERE school_id = ?", [id]);
      studentIds = s1.map(r => r.id);
    } catch (e) { throw new Error(`Step 2a (Find students by school_id) failed: ${e.message}`); }
    
    if (sectionIds.length > 0) {
      try {
        const [s2] = await connection.query("SELECT id FROM students WHERE section_id IN (?)", [sectionIds]);
        s2.forEach(r => { if (!studentIds.includes(r.id)) studentIds.push(r.id); });
      } catch (e) { throw new Error(`Step 2b (Find students by section_id) failed: ${e.message}`); }
    }

    // 3. Delete Student Dependencies
    if (studentIds.length > 0) {
      try { await connection.query("DELETE FROM student_marks WHERE student_id IN (?)", [studentIds]); } catch (e) { throw new Error(`Step 3a (Delete student_marks) failed: ${e.message}`); }
      try { await connection.query("DELETE FROM attendance WHERE student_id IN (?)", [studentIds]); } catch (e) { throw new Error(`Step 3b (Delete attendance) failed: ${e.message}`); }
      try { await connection.query("DELETE FROM student_qr_codes WHERE student_id IN (?)", [studentIds]); } catch (e) { throw new Error(`Step 3c (Delete student_qr_codes) failed: ${e.message}`); }
      try { await connection.query("DELETE FROM student_usage_logs WHERE student_id IN (?)", [studentIds]).catch(() => {}); } catch (e) { /* ignore usage logs if table missing */ }
      try { await connection.query("DELETE FROM live_quiz_answers WHERE student_id IN (?)", [studentIds]); } catch (e) { throw new Error(`Step 3e (Delete live_quiz_answers) failed: ${e.message}`); }
      try { await connection.query("DELETE FROM leave_applications WHERE student_id IN (?)", [studentIds]).catch(() => {}); } catch (e) { /* ignore leave apps if table missing */ }
      try { await connection.query("DELETE FROM students WHERE id IN (?)", [studentIds]); } catch (e) { throw new Error(`Step 3g (Delete students) failed: ${e.message}`); }
    }

    // 4. Delete Teacher Dependencies
    let teachers = [];
    try {
      const [rows] = await connection.query("SELECT id FROM teachers WHERE school_id = ?", [id]);
      teachers = rows;
    } catch (e) { throw new Error(`Step 4a (Find teachers) failed: ${e.message}`); }
    const teacherIds = teachers.map(t => t.id);
    
    if (teacherIds.length > 0) {
      try { await connection.query("DELETE FROM teacher_attendance WHERE teacher_id IN (?)", [teacherIds]); } catch (e) { throw new Error(`Step 4b (Delete teacher_attendance) failed: ${e.message}`); }
      try { await connection.query("DELETE FROM teacher_activity_logs WHERE teacher_id IN (?)", [teacherIds]).catch(() => {}); } catch (e) { /* ignore activity logs if table missing */ }
      try { await connection.query("DELETE FROM teachers WHERE id IN (?)", [teacherIds]); } catch (e) { throw new Error(`Step 4d (Delete teachers) failed: ${e.message}`); }
    }

    // 5. Delete Session Dependencies
    if (sectionIds.length > 0) {
      try { await connection.query("DELETE FROM live_sessions WHERE class_id IN (?)", [sectionIds]); } catch (e) { throw new Error(`Step 5a (Delete live_sessions) failed: ${e.message}`); }
      try { await connection.query("DELETE FROM sections WHERE id IN (?)", [sectionIds]); } catch (e) { throw new Error(`Step 5b (Delete sections) failed: ${e.message}`); }
    }
    
    // 6. Delete Admin-School Mappings
    try { await connection.query("DELETE FROM admin_schools WHERE school_id = ?", [id]); } catch (e) { throw new Error(`Step 6 (Delete admin_schools) failed: ${e.message}`); }
    
    // 7. Finally Delete the School
    let r;
    try {
      const [rows] = await connection.query("DELETE FROM schools WHERE id = ?", [id]);
      r = rows;
    } catch (e) { throw new Error(`Step 7 (Delete school) failed: ${e.message}`); }
    
    await connection.commit();
    res.json({ deleted: r.affectedRows > 0 });

    // Audit log after successful deletion
    if (r.affectedRows > 0) {
      auditLog(db, {
        ...actorFromReq(req),
        action: "DELETE", entity: "school", entity_id: String(id),
        meta: { school_id: id },
        req,
      });
    }
  } catch (err) {
    await connection.rollback();
    console.error("DELETE /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  } finally {
    connection.release();
  }
}

export async function getSchools(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT * FROM schools");
    res.json({ schools: rows });
  } catch (err) {
    console.error("GET /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

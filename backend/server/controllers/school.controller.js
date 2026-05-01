import getPool from "../config/db.js";

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
    const [sections] = await connection.query("SELECT id FROM sections WHERE school_id = ?", [id]);
    const sectionIds = sections.map(s => s.id);
    
    // 2. Find all students belonging to this school or these sections
    let studentIds = [];
    const [s1] = await connection.query("SELECT id FROM students WHERE school_id = ?", [id]);
    studentIds = s1.map(r => r.id);
    
    if (sectionIds.length > 0) {
      const [s2] = await connection.query("SELECT id FROM students WHERE section_id IN (?)", [sectionIds]);
      s2.forEach(r => { if (!studentIds.includes(r.id)) studentIds.push(r.id); });
    }

    // 3. Delete Student Dependencies
    if (studentIds.length > 0) {
      // Use chunks if there are many students, but for school deletion it's usually manageable
      await connection.query("DELETE FROM student_marks WHERE student_id IN (?)", [studentIds]);
      await connection.query("DELETE FROM attendance WHERE student_id IN (?)", [studentIds]);
      await connection.query("DELETE FROM student_qr_codes WHERE student_id IN (?)", [studentIds]);
      await connection.query("DELETE FROM student_usage_logs WHERE student_id IN (?)", [studentIds]);
      await connection.query("DELETE FROM live_quiz_answers WHERE student_id IN (?)", [studentIds]);
      await connection.query("DELETE FROM leave_applications WHERE student_id IN (?)", [studentIds]);
      await connection.query("DELETE FROM students WHERE id IN (?)", [studentIds]);
    }

    // 4. Delete Teacher Dependencies
    const [teachers] = await connection.query("SELECT id FROM teachers WHERE school_id = ?", [id]);
    const teacherIds = teachers.map(t => t.id);
    if (teacherIds.length > 0) {
      await connection.query("DELETE FROM teacher_attendance WHERE teacher_id IN (?)", [teacherIds]);
      await connection.query("DELETE FROM teacher_activity_logs WHERE teacher_id IN (?)", [teacherIds]);
      await connection.query("DELETE FROM teachers WHERE id IN (?)", [teacherIds]);
    }

    // 5. Delete Session Dependencies
    await connection.query("DELETE FROM live_sessions WHERE school_id = ?", [id]);
    if (sectionIds.length > 0) {
      await connection.query("DELETE FROM live_sessions WHERE class_id IN (?)", [sectionIds]);
      // Remove any other table that might point to sections
      await connection.query("DELETE FROM sections WHERE id IN (?)", [sectionIds]);
    }

    // 6. Delete Classes
    await connection.query("DELETE FROM classes WHERE school_id = ?", [id]);
    
    // 7. Finally Delete the School
    const [r] = await connection.query("DELETE FROM schools WHERE id = ?", [id]);
    
    await connection.commit();
    res.json({ deleted: r.affectedRows > 0 });
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

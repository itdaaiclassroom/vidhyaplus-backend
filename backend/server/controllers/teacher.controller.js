import getPool from "../config/db.js";

export async function createTeacher(req, res) {
  const db = getPool();
  const { full_name, email, school_id, password } = req.body || {};
  if (!full_name || !school_id || !email) {
    return res.status(400).json({ error: "full_name, email and school_id are required" });
  }
  if (!password || String(password).trim() === "") {
    return res.status(400).json({ error: "password is required for teacher login" });
  }
  const emailVal = String(email).trim();
  const passwordPlain = String(password).trim();
  try {
    const [insertResult] = await db.query(
      "INSERT INTO teachers (full_name, email, school_id, password) VALUES (?, ?, ?, ?)",
      [String(full_name).trim(), emailVal, Number(school_id), passwordPlain]
    );
    const teacherId = insertResult.insertId;
    res.status(201).json({ id: String(teacherId), full_name: String(full_name).trim(), email: emailVal, school_id: String(school_id) });
  } catch (err) {
    console.error("POST /api/teachers error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function updateTeacher(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  const { full_name, email, school_id, password } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const updates = [];
    const values = [];
    if (full_name !== undefined) { updates.push("full_name = ?"); values.push(String(full_name).trim()); }
    if (email !== undefined) { updates.push("email = ?"); values.push(String(email).trim()); }
    if (school_id !== undefined) { updates.push("school_id = ?"); values.push(Number(school_id)); }
    if (password !== undefined) {
      const plain = password && String(password).trim() ? String(password).trim() : null;
      updates.push("password = ?");
      values.push(plain);
    }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    await db.query(`UPDATE teachers SET ${updates.join(", ")} WHERE id = ?`, values);
    console.log('TEACHER ASSIGNMENTS API CALLED FOR ID:', id, 'SUBJECTS:', subjectIds, 'SECTIONS:', sectionIds); res.json({ id: String(id), updated: true });
  } catch (err) {
    console.error("PUT /api/teachers error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function deleteTeacher(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const [r] = await db.query("DELETE FROM teachers WHERE id = ?", [id]);
    res.json({ deleted: r.affectedRows > 0 });
  } catch (err) {
    console.error("DELETE /api/teachers error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function bulkCreateTeachers(req, res) {
  const db = getPool();
  const teachers = req.body.teachers;
  if (!Array.isArray(teachers)) {
    return res.status(400).json({ error: "Expected 'teachers' to be an array" });
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const teacher of teachers) {
    const { full_name, email, school_id, password, subjects } = teacher || {};
    
    const parsedSchoolId = Number(school_id);
    if (!full_name || !school_id || !email || isNaN(parsedSchoolId)) {
      results.failed.push({ teacher, error: "valid full_name, email and school_id are required" });
      continue;
    }
    if (!password || String(password).trim() === "") {
      results.failed.push({ teacher, error: "password is required" });
      continue;
    }

    const emailVal = String(email).trim();
    const passwordPlain = String(password).trim();

    try {
      const [insertResult] = await db.query(
        "INSERT INTO teachers (full_name, email, school_id, password, role) VALUES (?, ?, ?, ?, 'teacher')",
        [String(full_name).trim(), emailVal, parsedSchoolId, passwordPlain]
      );
      
      const teacherId = insertResult.insertId;

      // Handle subjects if provided
      if (subjects && Array.isArray(subjects)) {
        for (const subjectId of subjects) {
          await db.query(
            "INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)",
            [teacherId, Number(subjectId)]
          );
        }
      }
      
      results.successful.push({
        id: String(teacherId), 
        full_name: String(full_name).trim(), 
        email: emailVal, 
        school_id: String(school_id)
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        results.failed.push({ teacher, error: `Email '${emailVal}' is already registered.` });
      } else {
        results.failed.push({ teacher, error: err.message });
      }
    }
  }

  res.status(200).json(results);
}

export async function getTeacherDashboard(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  
  if (!id) {
    return res.status(400).json({ error: "id required" });
  }

  try {
    const [teacherRows] = await db.query(
      "SELECT id, full_name, email, school_id FROM teachers WHERE id = ? LIMIT 1",
      [id]
    );

    if (!teacherRows || teacherRows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacher = teacherRows[0];

    let assignments = [];
    try {
      const [assignmentRows] = await db.query(
        `SELECT sub.subject_name, s.section_code, s.grade_id 
         FROM teacher_assignments ta 
         JOIN sections s ON ta.section_id = s.id 
         JOIN subjects sub ON ta.subject_id = sub.id
         WHERE ta.teacher_id = ?`,
        [id]
      );
      assignments = assignmentRows || [];
    } catch (err) {
    }

    let stats = { total_students: 0, average_performance: 0 };
    try {
      const [statRows] = await db.query(
        `SELECT COUNT(st.id) as total_students
         FROM students st
         JOIN teacher_assignments ta ON st.section_id = ta.section_id
         WHERE ta.teacher_id = ?`,
         [id]
      );
      if (statRows && statRows.length > 0) {
        stats.total_students = statRows[0].total_students || 0;
        stats.average_performance = 75; // Default average
      }
    } catch (err) {
    }

    res.json({
      teacher,
      assignments,
      stats
    });

  } catch (err) {
    console.error("GET /api/teachers/dashboard/:id error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function markTeacherAttendance(req, res) {
  const db = getPool();
  const { date, attendance } = req.body; // attendance is array of { teacher_id, school_id, status }
  
  if (!date || !Array.isArray(attendance)) {
    return res.status(400).json({ error: "date and attendance array are required" });
  }

  try {
    for (const record of attendance) {
      const { teacher_id, school_id, status } = record;
      if (!teacher_id || !school_id || !status) continue;
      
      // Upsert attendance record
      await db.query(
        `INSERT INTO teacher_attendance (teacher_id, school_id, attendance_date, status) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [teacher_id, school_id, date, status]
      );
    }
    res.json({ ok: true, message: "Teacher attendance marked successfully" });
  } catch (err) {
    console.error("POST /api/teachers/attendance error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function getTeacherAttendance(req, res) {
  const db = getPool();
  const { school_id, date } = req.query;

  if (!school_id || !date) {
    return res.status(400).json({ error: "school_id and date are required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, teacher_id, school_id, attendance_date as date, status, created_at FROM teacher_attendance WHERE school_id = ? AND attendance_date = ?",
      [school_id, date]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/teachers/attendance error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function getTeacherAssignments(req, res) {
  const db = getPool();
  const id = Number(req.params.id);

  console.log("--- getTeacherAssignments START --- ID:", id);

  if (!id) {
    return res.status(400).json({ error: "id required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT assigned_subject_ids, assigned_class_ids, assigned_section_ids, school_id FROM teachers WHERE id = ? LIMIT 1",
      [id]
    );

    console.log("DB RAW ROWS:", JSON.stringify(rows));

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const teacher = rows[0];
    let subjectIds = teacher.assigned_subject_ids || [];
    let classIds = teacher.assigned_class_ids || [];
    let sectionIds = teacher.assigned_section_ids || [];

    // Force parsing if strings
    if (typeof subjectIds === 'string') try { subjectIds = JSON.parse(subjectIds); } catch (_) { subjectIds = []; }
    if (typeof classIds === 'string') try { classIds = JSON.parse(classIds); } catch (_) { classIds = []; }
    if (typeof sectionIds === 'string') try { sectionIds = JSON.parse(sectionIds); } catch (_) { sectionIds = []; }

    // Ensure they are arrays
    if (!Array.isArray(subjectIds)) subjectIds = [];
    if (!Array.isArray(classIds)) classIds = [];
    if (!Array.isArray(sectionIds)) sectionIds = [];

    const assignments = [];

    // Get subject names
    const subjectMap = {};
    if (subjectIds.length > 0) {
      const [subRows] = await db.query("SELECT id, subject_name FROM subjects WHERE id IN (?)", [subjectIds]);
      (subRows || []).forEach(s => { subjectMap[s.id] = s.subject_name; });
    }

    // Get section info
    const sectionMap = {};
    if (sectionIds.length > 0) {
      const [secRows] = await db.query(
        "SELECT sec.id, sec.grade_id, sec.section_code, s.school_name FROM sections sec LEFT JOIN schools s ON s.id = sec.school_id WHERE sec.id IN (?)",
        [sectionIds]
      );
      (secRows || []).forEach(s => { sectionMap[s.id] = s; });
    }

    console.log("RESOLVING ASSIGNMENTS for subs:", subjectIds, "sections:", sectionIds);

    for (const subId of subjectIds) {
      if (sectionIds.length > 0) {
        for (const secId of sectionIds) {
          const sec = sectionMap[secId] || {};
          assignments.push({
            id: `${id}-${subId}-${secId}`,
            teacherId: String(id),
            schoolId: String(teacher.school_id),
            classId: String(secId),
            subjectId: String(subId),
            subjectName: subjectMap[subId] || `Subject ${subId}`,
            className: sec.section_code ? `Class ${sec.grade_id}-${sec.section_code}` : `Section ${secId}`,
            schoolName: sec.school_name || ""
          });
        }
      } else {
        assignments.push({
          id: `${id}-${subId}`,
          teacherId: String(id),
          schoolId: String(teacher.school_id),
          classId: "",
          subjectId: String(subId),
          subjectName: subjectMap[subId] || `Subject ${subId}`,
          className: "No class assigned",
          schoolName: ""
        });
      }
    }

    console.log("RETURNING ASSIGNMENTS COUNT:", assignments.length);

    res.json({
      DEBUG_VERSION: "v2-explicit-json",
      assigned_subject_ids: subjectIds,
      assigned_class_ids: classIds,
      assigned_section_ids: sectionIds,
      assignments: assignments
    });
  } catch (err) {
    console.error("GET /api/teachers/:id/assignments error:", err);
    res.status(500).json({ error: "Failed to fetch teacher assignments" });
  }
}

export async function markSelfAttendance(req, res) {
  const db = getPool();
  const teacherId = Number(req.params.id);
  const { status } = req.body; // 'present', 'absent', 'leave'
  
  if (!teacherId) return res.status(400).json({ error: "teacherId required" });
  if (!status || !['present', 'absent', 'leave'].includes(status)) {
    return res.status(400).json({ error: "valid status ('present', 'absent', 'leave') required" });
  }

  try {
    const [teacherRows] = await db.query("SELECT school_id FROM teachers WHERE id = ? LIMIT 1", [teacherId]);
    if (teacherRows.length === 0) return res.status(404).json({ error: "Teacher not found" });
    const school_id = teacherRows[0].school_id;

    const [result] = await db.query(
      `INSERT INTO teacher_attendance (teacher_id, school_id, attendance_date, status) 
       VALUES (?, ?, CURDATE(), ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [teacherId, school_id, status]
    );

    res.json({ ok: true, message: "Attendance marked successfully", status });
  } catch (err) {
    console.error("POST /api/teachers/:id/attendance error:", err);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
}

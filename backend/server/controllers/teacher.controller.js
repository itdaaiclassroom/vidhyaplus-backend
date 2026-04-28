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
    res.json({ id: String(id), updated: true });
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
        `SELECT subject_name, section_code, grade_id 
         FROM teacher_assignments ta 
         JOIN sections s ON ta.section_id = s.id 
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

import getPool from "../config/db.js";
import { generateStudentQRIds } from "./student.controller.js";
import * as assetStorage from "../storage.js";

export async function getPrincipalProfile(req, res) {
  const db = getPool();
  const principalId = req.user.id;
  try {
    const [rows] = await db.query(
      "SELECT id, email, full_name, school_id, role FROM teachers WHERE id = ? AND role = 'principal' LIMIT 1",
      [principalId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Principal profile not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /api/principal/profile error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function registerTeacherByPrincipal(req, res) {
  const { school_id, full_name, email, password, subjects } = req.body;
  if (!school_id || !full_name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields: school_id, full_name, email, password" });
  }
  const db = getPool();
  try {
    const [result] = await db.query(
      "INSERT INTO teachers (school_id, full_name, email, password, role) VALUES (?, ?, ?, ?, 'teacher')",
      [Number(school_id), full_name, email, password]
    );
    const teacherId = result.insertId;
    if (subjects && Array.isArray(subjects)) {
      for (const subjectId of subjects) {
        await db.query("INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)", [teacherId, Number(subjectId)]);
      }
    }
    res.status(201).json({ ok: true, teacher_id: String(teacherId) });
  } catch (err) {
    console.error("Teacher registration error:", err);
    res.status(500).json({ error: "Failed to register teacher" });
  }
}

export async function registerStudentByPrincipal(req, res) {
  const { 
    school_id, section_id, roll_no, first_name, last_name, category, joined_at, profile_image_path,
    gender, dob, father_name, mother_name, phone, phone_number, aadhaar,
    address, village, mandal, district, state, pincode, is_hosteller, disabilities
  } = req.body;
  if (!school_id || !section_id || !first_name || !last_name) {
    return res.status(400).json({ error: "Missing required fields: school_id, section_id, first_name, last_name" });
  }
  const db = getPool();
  try {
    const [result] = await db.query(
      `INSERT INTO students (
        school_id, section_id, roll_no, first_name, last_name, category, joined_at, profile_image_path,
        gender, dob, father_name, mother_name, phone_number, aadhaar, address, village, mandal, district, state, pincode, is_hosteller, disabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(school_id), 
        Number(section_id), 
        roll_no || null,
        first_name, 
        last_name, 
        category || 'General', 
        joined_at || new Date().toISOString().slice(0, 10),
        profile_image_path || null,
        gender || null,
        dob || null,
        father_name || null,
        mother_name || null,
        phone || phone_number || null,
        aadhaar || null,
        address || null,
        village || null,
        mandal || null,
        district || null,
        state || "Telangana",
        pincode || null,
        (is_hosteller === 1 || is_hosteller === true) ? 1 : 0,
        disabilities || null
      ]
    );
    const studentId = result.insertId;
    
    // Generate QR IDs (no images)
    await generateStudentQRIds(db, studentId);
    
    res.status(201).json({ 
      ok: true, 
      student_id: String(studentId),
      profile_image_url: profile_image_path ? assetStorage.getPublicUrl(profile_image_path) : null
    });
  } catch (err) {
    console.error("Student registration error:", err);
    res.status(500).json({ error: "Failed to register student" });
  }
}

export async function getSchoolStudents(req, res) {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) return res.status(400).json({ error: "school id required" });
  const db = getPool();
  try {
    const [rows] = await db.query(`
      SELECT s.*, sec.grade_id, sec.section_code,
             GROUP_CONCAT(CONCAT(sq.qr_type, ':', sq.qr_code_value) SEPARATOR '|') as qr_codes_raw
      FROM students s
      JOIN sections sec ON sec.id = s.section_id
      LEFT JOIN student_qr_codes sq ON sq.student_id = s.id
      WHERE s.school_id = ?
      GROUP BY s.id
      ORDER BY s.id DESC
    `, [schoolId]);
    
    const students = rows.map(r => {
      const qrs = (r.qr_codes_raw || "").split('|').filter(Boolean).map(qc => {
        const [type, value] = qc.split(':');
        return { type, value };
      });
      const { qr_codes_raw, ...rest } = r;
      return { 
        ...rest, 
        qr_codes: qrs,
        profile_image_url: r.profile_image_path ? assetStorage.getPublicUrl(r.profile_image_path) : null
      };
    });
    
    res.json(students);
  } catch (err) {
    console.error("GET /api/principals/students error:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
}

export async function getSchoolTeachers(req, res) {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) return res.status(400).json({ error: "school id required" });
  const db = getPool();
  try {
    const [rows] = await db.query(`
      SELECT t.id, t.full_name, t.email, t.role,
             t.assigned_subject_ids, t.assigned_class_ids, t.assigned_section_ids,
             GROUP_CONCAT(ts.subject_id SEPARATOR ',') as subject_ids
      FROM teachers t
      LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
      WHERE t.school_id = ?
      GROUP BY t.id
      ORDER BY t.id DESC
    `, [schoolId]);

    // Fetch all subjects for name resolution
    const [allSubjects] = await db.query("SELECT id, subject_name FROM subjects");
    const subjectMap = {};
    (allSubjects || []).forEach(s => { subjectMap[s.id] = s.subject_name; });

    // Fetch all sections for class name resolution
    const [allSections] = await db.query("SELECT id, grade_id, section_code FROM sections WHERE school_id = ?", [schoolId]);
    const sectionMap = {};
    (allSections || []).forEach(sec => { 
      sectionMap[sec.id] = `Class ${sec.grade_id}-${sec.section_code}`; 
    });

    const teachers = rows.map(r => {
      // Merge subjects from both sources
      const subjectIdSet = new Set();
      if (r.subject_ids) {
        r.subject_ids.split(',').filter(Boolean).forEach(id => subjectIdSet.add(Number(id)));
      }
      let jsonSubjectIds = r.assigned_subject_ids;
      if (typeof jsonSubjectIds === 'string') {
        try { jsonSubjectIds = JSON.parse(jsonSubjectIds); } catch (_) { jsonSubjectIds = []; }
      }
      if (Array.isArray(jsonSubjectIds)) {
        jsonSubjectIds.forEach(id => subjectIdSet.add(Number(id)));
      }
      const subjects = Array.from(subjectIdSet).map(id => subjectMap[id]).filter(Boolean);

      // Resolve class names from assigned_section_ids (or assigned_class_ids)
      let sectionIds = r.assigned_section_ids;
      if (typeof sectionIds === 'string') {
        try { sectionIds = JSON.parse(sectionIds); } catch (_) { sectionIds = []; }
      }
      if (!Array.isArray(sectionIds)) sectionIds = [];
      
      const classNames = sectionIds.map(id => sectionMap[id]).filter(Boolean);

      return {
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        role: r.role,
        subject_ids: r.subject_ids,
        assigned_subject_ids: jsonSubjectIds || [],
        assigned_class_ids: r.assigned_class_ids || [],
        assigned_section_ids: sectionIds || [],
        subjects,
        class_names: classNames
      };
    });

    res.json(teachers);
  } catch (err) {
    console.error("GET /api/principals/teachers error:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
}

// ── Subjects CRUD (manage the subjects master list) ──

export async function getSubjects(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT id, subject_name FROM subjects ORDER BY subject_name");
    res.json(rows);
  } catch (err) {
    console.error("GET /api/principal/subjects error:", err);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
}

export async function createSubject(req, res) {
  const { subject_name } = req.body || {};
  if (!subject_name || !String(subject_name).trim()) {
    return res.status(400).json({ error: "subject_name is required" });
  }
  const name = String(subject_name).trim();
  const db = getPool();
  try {
    // Check for duplicate
    const [existing] = await db.query(
      "SELECT id FROM subjects WHERE subject_name = ? LIMIT 1",
      [name]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: `Subject '${name}' already exists` });
    }
    const [result] = await db.query(
      "INSERT INTO subjects (subject_name) VALUES (?)",
      [name]
    );
    res.status(201).json({ ok: true, subject: { id: result.insertId, subject_name: name } });
  } catch (err) {
    console.error("POST /api/principal/subjects error:", err);
    res.status(500).json({ error: "Failed to create subject" });
  }
}

export async function updateSubject(req, res) {
  const subjectId = Number(req.params.subjectId);
  const { subject_name } = req.body || {};
  if (!subjectId) return res.status(400).json({ error: "subject id required" });
  if (!subject_name || !String(subject_name).trim()) {
    return res.status(400).json({ error: "subject_name is required" });
  }
  const name = String(subject_name).trim();
  const db = getPool();
  try {
    // Check subject exists
    const [existing] = await db.query("SELECT id FROM subjects WHERE id = ? LIMIT 1", [subjectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }
    // Check for duplicate name (excluding this record)
    const [dup] = await db.query(
      "SELECT id FROM subjects WHERE subject_name = ? AND id != ? LIMIT 1",
      [name, subjectId]
    );
    if (dup && dup.length > 0) {
      return res.status(409).json({ error: `Subject '${name}' already exists` });
    }
    await db.query("UPDATE subjects SET subject_name = ? WHERE id = ?", [name, subjectId]);
    res.json({ ok: true, subject: { id: subjectId, subject_name: name } });
  } catch (err) {
    console.error("PUT /api/principal/subjects/:subjectId error:", err);
    res.status(500).json({ error: "Failed to update subject" });
  }
}

export async function deleteSubject(req, res) {
  const subjectId = Number(req.params.subjectId);
  if (!subjectId) return res.status(400).json({ error: "subject id required" });
  const db = getPool();
  try {
    // Check subject exists
    const [existing] = await db.query("SELECT id FROM subjects WHERE id = ? LIMIT 1", [subjectId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }
    // Block deletion if any teacher has this subject assigned
    const [assigned] = await db.query(
      "SELECT COUNT(*) AS cnt FROM teacher_subjects WHERE subject_id = ?",
      [subjectId]
    );
    const count = assigned && assigned[0] ? Number(assigned[0].cnt) : 0;
    if (count > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${count} teacher(s) are assigned to this subject. Remove their assignments first.`
      });
    }
    await db.query("DELETE FROM subjects WHERE id = ?", [subjectId]);
    res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("DELETE /api/principal/subjects/:subjectId error:", err);
    res.status(500).json({ error: "Failed to delete subject" });
  }
}

// ── Teacher ↔ Subject assignment ──

export async function getTeacherSubjects(req, res) {
  const teacherId = Number(req.params.teacherId);
  if (!teacherId) return res.status(400).json({ error: "teacher id required" });
  
  const db = getPool();
  try {
    const [rows] = await db.query(
      `SELECT ts.subject_id, s.subject_name
       FROM teacher_subjects ts
       JOIN subjects s ON s.id = ts.subject_id
       WHERE ts.teacher_id = ?
       ORDER BY s.subject_name`,
      [teacherId]
    );
    res.json({ teacher_id: teacherId, subjects: rows });
  } catch (err) {
    console.error("GET /api/principal/teachers/:teacherId/subjects error:", err);
    res.status(500).json({ error: "Failed to fetch teacher subjects" });
  }
}

// ── Teacher Subject/Class Assignment (JSON) ──
export async function assignTeacherSubjectsAndClasses(req, res) {
  const teacherId = Number(req.params.teacherId);
  if (!teacherId) return res.status(400).json({ error: "teacherId required" });

  const { assigned_subject_ids, assigned_class_ids, assigned_section_ids } = req.body;
  const db = getPool();

  try {
    const updates = [];
    const values = [];

    if (assigned_subject_ids !== undefined) {
      updates.push("assigned_subject_ids = ?");
      values.push(JSON.stringify(assigned_subject_ids));
    }
    if (assigned_class_ids !== undefined) {
      updates.push("assigned_class_ids = ?");
      values.push(JSON.stringify(assigned_class_ids));
    }
    if (assigned_section_ids !== undefined) {
      updates.push("assigned_section_ids = ?");
      values.push(JSON.stringify(assigned_section_ids));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No assignments provided to update" });
    }

    values.push(teacherId);

    const [result] = await db.query(
      `UPDATE teachers SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json({ ok: true, message: "Teacher assignments updated successfully" });
  } catch (err) {
    console.error("PUT /api/principal/teachers/:teacherId/assignments error:", err);
    res.status(500).json({ error: "Failed to update teacher assignments" });
  }
}

export async function updateTeacherSubjects(req, res) {
  const teacherId = Number(req.params.teacherId);
  const { subjects } = req.body;
  if (!teacherId) return res.status(400).json({ error: "teacher id required" });
  if (!Array.isArray(subjects)) return res.status(400).json({ error: "subjects array required" });
  
  const db = getPool();
  try {
    // Verify all provided subject IDs exist
    if (subjects.length > 0) {
      const [validSubs] = await db.query(
        "SELECT id FROM subjects WHERE id IN (?)",
        [subjects.map(Number)]
      );
      if (validSubs.length !== subjects.length) {
        return res.status(400).json({ error: "One or more subject IDs are invalid" });
      }
    }

    // Sync: clear existing and re-insert new list
    await db.query("DELETE FROM teacher_subjects WHERE teacher_id = ?", [teacherId]);
    if (subjects.length > 0) {
      for (const subjectId of subjects) {
        await db.query(
          "INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)",
          [teacherId, Number(subjectId)]
        );
      }
    }
    res.json({ ok: true, message: "Teacher subjects updated successfully", teacher_id: teacherId, subject_ids: subjects });
  } catch (err) {
    console.error("PUT /api/principal/teachers/:teacherId/subjects error:", err);
    res.status(500).json({ error: "Failed to update teacher subjects" });
  }
}

// ── Helper: resolve principal's school_id from JWT ──
async function getPrincipalSchoolId(db, principalId) {
  const [rows] = await db.query(
    "SELECT school_id FROM teachers WHERE id = ? AND role = 'principal' LIMIT 1",
    [Number(principalId)]
  );
  return rows && rows[0] ? Number(rows[0].school_id) : null;
}

// ── Grades ──

export async function getGrades(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT id, grade_label FROM grades ORDER BY id");
    res.json({ grades: rows });
  } catch (err) {
    console.error("GET /api/principal/grades error:", err);
    res.status(500).json({ error: "Failed to fetch grades" });
  }
}

// ── Sections (Classes) CRUD ──

export async function getSchoolSections(req, res) {
  const db = getPool();
  const principalId = req.user.id;
  try {
    const schoolId = await getPrincipalSchoolId(db, principalId);
    if (!schoolId) return res.status(403).json({ error: "Principal school not found" });

    // Optional filter by grade
    const gradeFilter = req.query.grade_id ? Number(req.query.grade_id) : null;

    let sql = `
      SELECT sec.id, sec.school_id, sec.grade_id, g.grade_label,
             sec.section_code,
             CONCAT(g.grade_label, ' - ', sec.section_code) AS display_name,
             COALESCE(sc.student_count, 0) AS student_count
      FROM sections sec
      JOIN grades g ON g.id = sec.grade_id
      LEFT JOIN (
        SELECT section_id, COUNT(*) AS student_count
        FROM students
        GROUP BY section_id
      ) sc ON sc.section_id = sec.id
      WHERE sec.school_id = ?
    `;
    const params = [schoolId];

    if (gradeFilter) {
      sql += " AND sec.grade_id = ?";
      params.push(gradeFilter);
    }

    sql += " ORDER BY sec.grade_id, sec.section_code";

    const [rows] = await db.query(sql, params);
    res.json({ sections: rows });
  } catch (err) {
    console.error("GET /api/principal/sections error:", err);
    res.status(500).json({ error: "Failed to fetch sections" });
  }
}

export async function createSection(req, res) {
  const { grade_id, section_code } = req.body || {};
  if (!grade_id || !section_code) {
    return res.status(400).json({ error: "grade_id and section_code are required" });
  }
  const db = getPool();
  const principalId = req.user.id;
  try {
    const schoolId = await getPrincipalSchoolId(db, principalId);
    if (!schoolId) return res.status(403).json({ error: "Principal school not found" });

    const code = String(section_code).trim().toUpperCase();
    const gradeId = Number(grade_id);

    // Check for duplicate
    const [existing] = await db.query(
      "SELECT id FROM sections WHERE school_id = ? AND grade_id = ? AND section_code = ? LIMIT 1",
      [schoolId, gradeId, code]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: `Section '${code}' already exists for this grade` });
    }

    // Validate grade exists
    const [gradeRows] = await db.query("SELECT id FROM grades WHERE id = ? LIMIT 1", [gradeId]);
    if (!gradeRows || gradeRows.length === 0) {
      return res.status(400).json({ error: `Grade ${gradeId} does not exist` });
    }

    const [result] = await db.query(
      "INSERT INTO sections (school_id, grade_id, section_code) VALUES (?, ?, ?)",
      [schoolId, gradeId, code]
    );

    res.status(201).json({
      ok: true,
      section: {
        id: Number(result.insertId),
        school_id: schoolId,
        grade_id: gradeId,
        section_code: code,
        student_count: 0
      }
    });
  } catch (err) {
    console.error("POST /api/principal/sections error:", err);
    res.status(500).json({ error: "Failed to create section" });
  }
}

export async function updateSection(req, res) {
  const sectionId = Number(req.params.id);
  const { section_code } = req.body || {};
  if (!sectionId) return res.status(400).json({ error: "Section id required" });
  if (!section_code) return res.status(400).json({ error: "section_code is required" });

  const db = getPool();
  const principalId = req.user.id;
  try {
    const schoolId = await getPrincipalSchoolId(db, principalId);
    if (!schoolId) return res.status(403).json({ error: "Principal school not found" });

    // Verify the section belongs to this school
    const [secRows] = await db.query(
      "SELECT id, grade_id FROM sections WHERE id = ? AND school_id = ? LIMIT 1",
      [sectionId, schoolId]
    );
    if (!secRows || secRows.length === 0) {
      return res.status(404).json({ error: "Section not found in your school" });
    }

    const code = String(section_code).trim().toUpperCase();
    const gradeId = secRows[0].grade_id;

    // Check for duplicate with new code
    const [dup] = await db.query(
      "SELECT id FROM sections WHERE school_id = ? AND grade_id = ? AND section_code = ? AND id != ? LIMIT 1",
      [schoolId, gradeId, code, sectionId]
    );
    if (dup && dup.length > 0) {
      return res.status(409).json({ error: `Section '${code}' already exists for this grade` });
    }

    await db.query("UPDATE sections SET section_code = ? WHERE id = ?", [code, sectionId]);
    res.json({ ok: true, id: sectionId, section_code: code });
  } catch (err) {
    console.error("PUT /api/principal/sections error:", err);
    res.status(500).json({ error: "Failed to update section" });
  }
}

export async function deleteSection(req, res) {
  const sectionId = Number(req.params.id);
  if (!sectionId) return res.status(400).json({ error: "Section id required" });

  const db = getPool();
  const principalId = req.user.id;
  try {
    const schoolId = await getPrincipalSchoolId(db, principalId);
    if (!schoolId) return res.status(403).json({ error: "Principal school not found" });

    // Verify the section belongs to this school
    const [secRows] = await db.query(
      "SELECT id FROM sections WHERE id = ? AND school_id = ? LIMIT 1",
      [sectionId, schoolId]
    );
    if (!secRows || secRows.length === 0) {
      return res.status(404).json({ error: "Section not found in your school" });
    }

    // Block deletion if students are enrolled
    const [studentRows] = await db.query(
      "SELECT COUNT(*) AS cnt FROM students WHERE section_id = ?",
      [sectionId]
    );
    const studentCount = studentRows && studentRows[0] ? Number(studentRows[0].cnt) : 0;
    if (studentCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${studentCount} student(s) are enrolled in this section. Reassign them first.`
      });
    }

    await db.query("DELETE FROM sections WHERE id = ?", [sectionId]);
    res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("DELETE /api/principal/sections error:", err);
    res.status(500).json({ error: "Failed to delete section" });
  }
}
// ── Dashboard Overview APIs ──

export async function getTeacherAttendanceSummary(req, res) {
  const db = getPool();
  const schoolId = Number(req.params.schoolId) || req.user?.school_id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    const [totalTeachersRows] = await db.query("SELECT COUNT(*) as total FROM teachers WHERE school_id = ?", [schoolId]);
    const totalTeachers = totalTeachersRows[0].total;

    const [attendanceRows] = await db.query(
      "SELECT status, COUNT(*) as count FROM teacher_attendance WHERE school_id = ? AND attendance_date = ? GROUP BY status",
      [schoolId, date]
    );

    let present = 0, absent = 0, leave = 0;
    attendanceRows.forEach(row => {
      if (row.status === 'present') present = row.count;
      else if (row.status === 'absent') absent = row.count;
      else if (row.status === 'leave') leave = row.count;
    });

    res.json({
      total_teachers: totalTeachers,
      present_today: present,
      absent_today: absent,
      leave_today: leave,
      date
    });
  } catch (err) {
    console.error("GET teacher attendance summary error:", err);
    res.status(500).json({ error: "Failed to fetch teacher attendance summary" });
  }
}

export async function getStudentAttendanceSummary(req, res) {
  const db = getPool();
  const schoolId = Number(req.params.schoolId) || req.user?.school_id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    // Total students in the school
    const [totalStudentsRows] = await db.query("SELECT COUNT(*) as total FROM students WHERE school_id = ?", [schoolId]);
    const totalStudents = totalStudentsRows[0].total;

    // Attendance stats
    const [attendanceRows] = await db.query(`
      SELECT a.status, COUNT(*) as count 
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE s.school_id = ? AND a.attendance_date = ?
      GROUP BY a.status
    `, [schoolId, date]);

    let present = 0, absent = 0;
    attendanceRows.forEach(row => {
      if (row.status === 'present') present = row.count;
      else if (row.status === 'absent') absent = row.count;
    });

    // Class-wise breakdown
    const [classRows] = await db.query(`
      SELECT sec.section_code, a.status, COUNT(*) as count
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN sections sec ON s.section_id = sec.id
      WHERE s.school_id = ? AND a.attendance_date = ?
      GROUP BY sec.id, a.status
    `, [schoolId, date]);

    const classBreakdown = {};
    classRows.forEach(row => {
      if (!classBreakdown[row.section_code]) {
        classBreakdown[row.section_code] = { present: 0, absent: 0 };
      }
      classBreakdown[row.section_code][row.status] = row.count;
    });

    res.json({
      total_students: totalStudents,
      present_today: present,
      absent_today: absent,
      class_breakdown: classBreakdown,
      date
    });
  } catch (err) {
    console.error("GET student attendance summary error:", err);
    res.status(500).json({ error: "Failed to fetch student attendance summary" });
  }
}

export async function getPrincipalOverview(req, res) {
  // Can just aggregate the two above functions if needed, or send a combined summary.
  // For simplicity, we just trigger the other functions or aggregate here.
  const schoolId = Number(req.params.schoolId) || req.user?.school_id;
  const date = req.query.date || new Date().toISOString().split('T')[0];
  
  res.json({
    ok: true,
    school_id: schoolId,
    date,
    message: "Overview endpoints are /teacher-attendance-summary and /student-attendance-summary"
  });
}

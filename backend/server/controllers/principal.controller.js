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
  const { school_id, section_id, first_name, last_name, category, joined_at, profile_image_path } = req.body;
  if (!school_id || !section_id || !first_name || !last_name) {
    return res.status(400).json({ error: "Missing required fields: school_id, section_id, first_name, last_name" });
  }
  const db = getPool();
  try {
    const [result] = await db.query(
      "INSERT INTO students (school_id, section_id, first_name, last_name, category, joined_at, profile_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        Number(school_id), 
        Number(section_id), 
        first_name, 
        last_name, 
        category || 'General', 
        joined_at || new Date().toISOString().slice(0, 10),
        profile_image_path || null
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
             GROUP_CONCAT(ts.subject_id SEPARATOR ',') as subject_ids
      FROM teachers t
      LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
      WHERE t.school_id = ?
      GROUP BY t.id
      ORDER BY t.id DESC
    `, [schoolId]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/principals/teachers error:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
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

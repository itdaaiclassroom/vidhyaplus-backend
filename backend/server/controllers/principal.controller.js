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

import getPool from "../config/db.js";
import { toId } from "../utils.js";
import * as assetStorage from "../storage.js";

/**
 * Generate Student QR Code ID and store in DB
 * Format: <roll_number>-<option>
 */
export async function generateStudentQRIds(db, studentId) {
  const sid = Number(studentId);
  if (!sid) return [];
  
  const [studentRows] = await db.query("SELECT roll_no, category FROM students WHERE id = ? LIMIT 1", [sid]);
  const student = studentRows && studentRows[0] ? studentRows[0] : null;
  
  if (!student) return [];
  
  const rollNo = String(student.roll_no || sid);
  const category = String(student.category || "A"); // Default to A if not set
  
  const qrCodeId = `${rollNo}-${category}`;
  
  const QR_TYPES = ["DATA", "A", "B", "C", "D"];
  const created = [];
  
  for (const qrType of QR_TYPES) {
    // For now, we use the same ID for all types or distinguish if needed.
    // The requirement says "Each student will have a QR Code ID", implying one per student.
    // But the existing system has 5 types. I'll store the same ID or follow a similar pattern.
    // Given "Store only the QR Code IDs", I'll store the formatted ID.
    
    const value = qrType === "DATA" ? qrCodeId : `stu${rollNo}_${qrType}`;
    
    await db.query(
      "INSERT INTO student_qr_codes (student_id, qr_type, qr_code_value, qr_image_path) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE qr_code_value = VALUES(qr_code_value), qr_image_path = NULL",
      [sid, qrType, value, null]
    );
    
    created.push({ qr_type: qrType, qr_code_value: value });
  }
  
  return created;
}

export async function createStudent(req, res) {
  const db = getPool();
  const { full_name, first_name, last_name, section, school_id, section_id, grade_id, joined_at, password, category, profile_image_path } = req.body || {};
  
  if (!school_id) {
    return res.status(400).json({ error: "school_id is required" });
  }
  if (!password || String(password).trim() === "") {
    return res.status(400).json({ error: "password is required for student login" });
  }
  
  const passwordPlain = String(password).trim();
  try {
    const schoolIdNum = Number(school_id);
    let resolvedSectionId = section_id != null ? Number(section_id) : null;
    
    if (!resolvedSectionId) {
      const sectionCode = section ? String(section).trim().toUpperCase() : "A";
      const gradeIdNum = grade_id != null ? Number(grade_id) : 10;
      const [secRows] = await db.query(
        "SELECT id FROM sections WHERE school_id = ? AND grade_id = ? AND section_code = ? LIMIT 1",
        [schoolIdNum, gradeIdNum, sectionCode]
      );
      if (Array.isArray(secRows) && secRows[0]) {
        resolvedSectionId = Number(secRows[0].id);
      } else {
        const [insSec] = await db.query(
          "INSERT INTO sections (school_id, grade_id, section_code) VALUES (?, ?, ?)",
          [schoolIdNum, gradeIdNum, sectionCode]
        );
        resolvedSectionId = Number(insSec.insertId);
      }
    }
    
    const fullName = String(full_name || "").trim();
    const firstNameResolved = String(first_name || (fullName.split(" ")[0] || "Student")).trim();
    const lastNameResolved = String(last_name || fullName.split(" ").slice(1).join(" ") || "Demo").trim();
    const studentCategory = category || "A";
    
    const [insertResult] = await db.query(
      "INSERT INTO students (school_id, section_id, first_name, last_name, password, joined_at, category, profile_image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        schoolIdNum, 
        resolvedSectionId, 
        firstNameResolved, 
        lastNameResolved, 
        passwordPlain, 
        joined_at ? String(joined_at).slice(0, 10) : new Date().toISOString().slice(0, 10), 
        studentCategory,
        profile_image_path || null
      ]
    );
    
    const studentId = insertResult.insertId;
    
    // Generate QR IDs (no images)
    try {
      await generateStudentQRIds(db, studentId);
    } catch (qrErr) {
      console.error("QR ID generation failed for student", studentId, qrErr.message);
    }
    
    res.status(201).json({ 
      id: String(studentId), 
      full_name: `${firstNameResolved} ${lastNameResolved}`.trim(), 
      school_id: String(schoolIdNum), 
      section_id: String(resolvedSectionId),
      category: studentCategory,
      profile_image_url: profile_image_path ? assetStorage.getPublicUrl(profile_image_path) : null
    });
  } catch (err) {
    console.error("POST /api/students error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function updateStudent(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  const { full_name, roll_no, section, school_id, password, category, profile_image_path } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const updates = [];
    const values = [];
    if (full_name !== undefined) {
      const fn = String(full_name).trim();
      const first = fn.split(" ")[0] || "";
      const last = fn.split(" ").slice(1).join(" ") || "";
      updates.push("first_name = ?");
      values.push(first);
      updates.push("last_name = ?");
      values.push(last);
    }
    if (roll_no !== undefined) { updates.push("roll_no = ?"); values.push(Number(roll_no)); }
    if (section !== undefined && school_id !== undefined) {
      const sec = section ? String(section).trim().toUpperCase() : "A";
      const [secRows] = await db.query(
        "SELECT id FROM sections WHERE school_id = ? AND grade_id = 10 AND section_code = ? LIMIT 1",
        [Number(school_id), sec]
      );
      if (Array.isArray(secRows) && secRows[0]) {
        updates.push("section_id = ?");
        values.push(Number(secRows[0].id));
      }
    }
    if (school_id !== undefined) { updates.push("school_id = ?"); values.push(Number(school_id)); }
    if (category !== undefined) { updates.push("category = ?"); values.push(category); }
    if (password !== undefined) {
      const plain = password && String(password).trim() ? String(password).trim() : null;
      updates.push("password = ?");
      values.push(plain);
    }
    if (profile_image_path !== undefined) {
      updates.push("profile_image_path = ?");
      values.push(profile_image_path || null);
    }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    await db.query(`UPDATE students SET ${updates.join(", ")} WHERE id = ?`, values);
    
    // Regenerate QR IDs if category changed
    if (category !== undefined) {
      await generateStudentQRIds(db, id);
    }
    
    res.json({ id: String(id), updated: true });
  } catch (err) {
    console.error("PUT /api/students error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function deleteStudent(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const [r2] = await db.query("DELETE FROM students WHERE id = ?", [id]);
    res.json({ deleted: r2.affectedRows > 0 });
  } catch (err) {
    console.error("DELETE /api/students error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function getStudentQRCodes(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const [rows] = await db.query(
      "SELECT id, student_id, qr_type, qr_code_value, qr_image_path, created_at FROM student_qr_codes WHERE student_id = ? ORDER BY qr_type",
      [id]
    );
    const list = (rows || []).map((r) => ({
      id: toId(r.id),
      studentId: toId(r.student_id),
      qrType: r.qr_type,
      qrCodeValue: r.qr_code_value,
      qrImagePath: null, // Images no longer stored
      createdAt: r.created_at ? String(r.created_at) : null,
    }));
    res.json({ qrcodes: list });
  } catch (err) {
    console.error("GET /api/admin/student/:id/qrcodes error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

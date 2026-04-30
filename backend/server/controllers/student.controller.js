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
  const { 
    full_name, first_name, last_name, roll_no, section, school_id, section_id, grade_id, 
    joined_at, password, category, profile_image_path,
    gender, dob, father_name, mother_name, phone, phone_number, aadhaar,
    address, village, mandal, district, state, pincode, hostel_status, is_hosteller, disabilities
  } = req.body || {};

  
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
    
    const resolvedPhone = phone || phone_number || null;
    const resolvedIsHosteller = (hostel_status === 'Yes' || is_hosteller === true || is_hosteller === 1) ? 1 : 0;

    const [insertResult] = await db.query(
      `INSERT INTO students (
        school_id, section_id, first_name, last_name, roll_no, password, joined_at, category, profile_image_path,
        gender, dob, father_name, mother_name, phone_number, aadhaar, address, village, mandal, district, state, pincode, is_hosteller, disabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolIdNum, 
        resolvedSectionId, 
        firstNameResolved, 
        lastNameResolved, 
        roll_no || null,
        passwordPlain, 
        joined_at ? String(joined_at).slice(0, 10) : new Date().toISOString().slice(0, 10), 
        studentCategory,
        profile_image_path || null,
        gender || null,
        dob || null,
        father_name || null,
        mother_name || null,
        resolvedPhone,
        aadhaar || null,
        address || null,
        village || null,
        mandal || null,
        district || null,
        state || "Telangana",
        pincode || null,
        resolvedIsHosteller,
        disabilities || null,
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
  const { 
    first_name, last_name, full_name, section_id, grade_id, school_id, 
    password, category, profile_image_path, gender, dob, father_name, 
    mother_name, phone, phone_number, aadhaar, address, village, mandal, 
    district, state, pincode, is_hosteller, disabilities 
  } = req.body || {};
  
  if (!id) return res.status(400).json({ error: "id required" });
  console.log(`UPDATING STUDENT ID: ${id}`, req.body);
  try {
    // Verify student exists
    const [existing] = await db.query("SELECT id FROM students WHERE id = ? LIMIT 1", [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: `Student with ID ${id} not found` });
    }

    const updates = [];
    const values = [];
    
    if (first_name !== undefined) { updates.push("first_name = ?"); values.push(String(first_name).trim()); }
    if (last_name !== undefined) { updates.push("last_name = ?"); values.push(String(last_name).trim()); }
    
    if (section_id !== undefined) { updates.push("section_id = ?"); values.push(Number(section_id)); }
    if (category !== undefined) { updates.push("category = ?"); values.push(category); }
    if (gender !== undefined) { updates.push("gender = ?"); values.push(gender); }
    if (dob !== undefined) { updates.push("dob = ?"); values.push(dob); }
    if (father_name !== undefined) { updates.push("father_name = ?"); values.push(father_name); }
    if (mother_name !== undefined) { updates.push("mother_name = ?"); values.push(mother_name); }
    
    // Support both 'phone' and 'phone_number' from frontend
    const resolvedPhone = phone !== undefined ? phone : phone_number;
    if (resolvedPhone !== undefined) { updates.push("phone_number = ?"); values.push(resolvedPhone); }
    
    if (aadhaar !== undefined) { updates.push("aadhaar = ?"); values.push(aadhaar); }
    if (address !== undefined) { updates.push("address = ?"); values.push(address); }
    if (village !== undefined) { updates.push("village = ?"); values.push(village); }
    if (mandal !== undefined) { updates.push("mandal = ?"); values.push(mandal); }
    if (district !== undefined) { updates.push("district = ?"); values.push(district); }
    if (state !== undefined) { updates.push("state = ?"); values.push(state); }
    if (pincode !== undefined) { updates.push("pincode = ?"); values.push(pincode); }
    if (is_hosteller !== undefined) { updates.push("is_hosteller = ?"); values.push((is_hosteller === 1 || is_hosteller === true) ? 1 : 0); }
    if (disabilities !== undefined) { updates.push("disabilities = ?"); values.push(disabilities); }
    
    if (password !== undefined && password !== null && String(password).trim() !== "") {
      updates.push("password = ?");
      values.push(String(password).trim());
    }
    if (profile_image_path !== undefined) {
      updates.push("profile_image_path = ?");
      values.push(profile_image_path || null);
    }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    
    values.push(id);
    const sql = `UPDATE students SET ${updates.join(", ")} WHERE id = ?`;
    console.log("EXECUTING SQL:", sql, values);
    const [result] = await db.query(sql, values);
    console.log("SQL RESULT:", result);
    
    // Regenerate QR IDs if category changed
    if (category !== undefined) {
      await generateStudentQRIds(db, id);
    }
    
    res.json({ id: id, updated: result.affectedRows > 0, ok: true });
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

export async function bulkCreateStudents(req, res) {
  const db = getPool();
  const students = req.body.students;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: "Expected 'students' to be an array" });
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const student of students) {
    const { 
      full_name, first_name, last_name, roll_no, section, school_id, section_id, grade_id, 
      joined_at, password, category, profile_image_path,
      gender, dob, father_name, mother_name, phone, phone_number, aadhaar,
      address, village, mandal, district, state, pincode, hostel_status, is_hosteller, disabilities
    } = student || {};

    const parsedSchoolId = Number(school_id);
    if (!school_id || isNaN(parsedSchoolId)) {
      results.failed.push({ student, error: "valid school_id is required" });
      continue;
    }
    if (!password || String(password).trim() === "") {
      results.failed.push({ student, error: "password is required" });
      continue;
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
      
      const resolvedPhone = phone || phone_number || null;
      const resolvedIsHosteller = (hostel_status === 'Yes' || is_hosteller === true || is_hosteller === 1) ? 1 : 0;
      
      // Duplicate Check
      let existingStudent = null;
      
      // Aadhaar check removed as requested by user.
      
      const [existing] = await db.query(
        "SELECT id, first_name, last_name FROM students WHERE school_id = ? AND section_id = ? AND first_name = ? AND last_name = ? LIMIT 1",
        [schoolIdNum, resolvedSectionId, firstNameResolved, lastNameResolved]
      );
      if (existing && existing.length > 0) existingStudent = existing[0];

      if (existingStudent) {
        results.failed.push({ 
          student, 
          error: `This student is already registered (Matches ID: ${existingStudent.id}).` 
        });
        continue;
      }

      const [insertResult] = await db.query(
        `INSERT INTO students (
          school_id, section_id, first_name, last_name, roll_no, password, joined_at, category, profile_image_path,
          gender, dob, father_name, mother_name, phone_number, aadhaar, address, village, mandal, district, state, pincode, is_hosteller, disabilities
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          schoolIdNum, 
          resolvedSectionId, 
          firstNameResolved, 
          lastNameResolved, 
          roll_no || null,
          passwordPlain, 
          joined_at ? String(joined_at).slice(0, 10) : new Date().toISOString().slice(0, 10), 
          studentCategory,
          profile_image_path || null,
          gender || null,
          dob || null,
          father_name || null,
          mother_name || null,
          resolvedPhone,
          aadhaar || null,
          address || null,
          village || null,
          mandal || null,
          district || null,
          state || "Telangana",
          pincode || null,
          resolvedIsHosteller,
          disabilities || null
        ]
      );
      
      const studentId = insertResult.insertId;
      
      try {
        await generateStudentQRIds(db, studentId);
      } catch (qrErr) {
        console.error("QR ID generation failed for student", studentId, qrErr.message);
      }
      
      results.successful.push({
        id: String(studentId), 
        full_name: `${firstNameResolved} ${lastNameResolved}`.trim(), 
        school_id: String(schoolIdNum), 
        section_id: String(resolvedSectionId),
        category: studentCategory
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        results.failed.push({ student, error: `Duplicate entry error: ${err.message}` });
      } else {
        results.failed.push({ student, error: err.message });
      }
    }
  }

  res.status(200).json(results);
}

export async function getStudentDashboard(req, res) {
  const db = getPool();
  const roll_no = req.params.roll_no;
  
  if (!roll_no) {
    return res.status(400).json({ error: "roll_no is required" });
  }

  try {
    const [studentRows] = await db.query(
      `SELECT s.*, sec.section_code, sec.grade_id 
       FROM students s 
       LEFT JOIN sections sec ON s.section_id = sec.id 
       WHERE s.roll_no = ? LIMIT 1`,
      [roll_no]
    );

    if (!studentRows || studentRows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = studentRows[0];
    const studentId = student.id;

    let attendance = { total_present: 0, total_absent: 0, total_days: 0, percentage: 0 };
    try {
      const [attendanceRows] = await db.query(
        `SELECT 
           COUNT(*) as total_days,
           SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as total_present,
           SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as total_absent
         FROM attendance WHERE student_id = ?`,
        [studentId]
      );
      if (attendanceRows && attendanceRows[0] && attendanceRows[0].total_days > 0) {
        attendance = {
          total_days: attendanceRows[0].total_days,
          total_present: attendanceRows[0].total_present || 0,
          total_absent: attendanceRows[0].total_absent || 0,
          percentage: Math.round(((attendanceRows[0].total_present || 0) / attendanceRows[0].total_days) * 100)
        };
      }
    } catch (err) {
      console.error("Error fetching attendance", err);
    }

    let academics = { average_score: 0, total_exams: 0 };
    try {
      const [resultRows] = await db.query(
        `SELECT 
           COUNT(*) as total_exams,
           AVG((marks_obtained / max_marks) * 100) as average_score
         FROM results WHERE student_id = ? AND max_marks > 0`,
        [studentId]
      );
      if (resultRows && resultRows[0] && resultRows[0].total_exams > 0) {
        academics = {
          total_exams: resultRows[0].total_exams,
          average_score: Math.round(resultRows[0].average_score || 0)
        };
      }
    } catch (err) {
      console.error("Error fetching results", err);
    }

    let achievements = [];
    try {
      const [achRows] = await db.query(
        `SELECT title, date, description FROM achievements WHERE student_id = ? ORDER BY date DESC LIMIT 5`,
        [studentId]
      );
      achievements = achRows || [];
    } catch (err) {
    }

    res.json({
      student: {
        id: student.id,
        full_name: `${student.first_name} ${student.last_name}`.trim(),
        roll_no: student.roll_no,
        school_id: student.school_id,
        section: student.section_code,
        grade_id: student.grade_id,
        category: student.category,
        profile_image_url: student.profile_image_path ? assetStorage.getPublicUrl(student.profile_image_path) : null
      },
      attendance,
      academics,
      achievements
    });

  } catch (err) {
    console.error("GET /api/students/dashboard/:roll_no error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function markStudentAttendance(req, res) {
  const db = getPool();
  // Support both date and attendance_date from frontend
  const attendanceDate = req.body.attendance_date || req.body.date;
  const attendance = req.body.attendance; // array of { student_id, class_id, status, section_id, teacher_id }
  
  if (!attendanceDate || !Array.isArray(attendance)) {
    return res.status(400).json({ error: "date/attendance_date and attendance array are required" });
  }

  try {
    for (const record of attendance) {
      const { student_id, class_id, status, section_id, teacher_id } = record;
      if (!student_id || !status) continue;
      
      const cId = class_id || null;
      const sId = section_id || null;
      const tId = teacher_id || null;

      // Upsert attendance record
      await db.query(
        `INSERT INTO attendance (student_id, class_id, section_id, teacher_id, attendance_date, status) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE status = VALUES(status), teacher_id = VALUES(teacher_id)`,
        [student_id, cId, sId, tId, attendanceDate, status]
      );
    }
    res.json({ ok: true, message: "Attendance marked successfully" });
  } catch (err) {
    console.error("POST /api/students/attendance error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function getStudentAttendance(req, res) {
  const db = getPool();
  const class_id = req.query.class_id || req.query.section_id; // Frontend might send section_id
  const date = req.query.attendance_date || req.query.date;

  if (!class_id || !date) {
    return res.status(400).json({ error: "class_id/section_id and date are required" });
  }

  try {
    // Match either class_id or section_id for flexibility with existing frontend
    const [rows] = await db.query(
      "SELECT id, student_id, class_id, section_id, teacher_id, attendance_date, status, created_at FROM attendance WHERE (class_id = ? OR section_id = ?) AND attendance_date = ?",
      [class_id, class_id, date]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/students/attendance error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function updateStudentAttendance(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!id) return res.status(400).json({ error: "attendance id required" });
  if (!status) return res.status(400).json({ error: "status required" });

  try {
    const [result] = await db.query(
      "UPDATE attendance SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    res.json({ ok: true, message: "Attendance updated successfully" });
  } catch (err) {
    console.error("PUT /api/students/attendance/:id error:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
}

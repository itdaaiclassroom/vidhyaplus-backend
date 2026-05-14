import getPool from "../config/db.js";

// Fetch all subjects
export async function getSubjects(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query(
      "SELECT id, subject_name AS name, grades, icon FROM subjects ORDER BY subject_name"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/subjects error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Fetch a single subject
export async function getSubject(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const [rows] = await db.query(
      "SELECT id, subject_name AS name, grades, icon FROM subjects WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /api/subjects/:id error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Create a new subject
export async function createSubject(req, res) {
  const db = getPool();
  const { name, grades, icon } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    // Check for duplicate name
    const [existing] = await db.query(
      "SELECT id FROM subjects WHERE subject_name = ? LIMIT 1",
      [name]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: `Subject '${name}' already exists` });
    }

    const [result] = await db.query(
      "INSERT INTO subjects (subject_name, grades, icon) VALUES (?, ?, ?)",
      [name, grades || null, icon || '📚']
    );
    res.status(201).json({
      id: String(result.insertId),
      name,
      grades: grades || null,
      icon: icon || '📚'
    });
  } catch (err) {
    console.error("POST /api/subjects error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Update a subject
export async function updateSubject(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  const { name, grades, icon } = req.body;

  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push("subject_name = ?"); values.push(String(name).trim()); }
    if (grades !== undefined) { updates.push("grades = ?"); values.push(grades ? String(grades).trim() : null); }
    if (icon !== undefined) { updates.push("icon = ?"); values.push(String(icon).trim()); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    await db.query(`UPDATE subjects SET ${updates.join(", ")} WHERE id = ?`, values);
    res.json({ ok: true, id: String(id), updated: true });
  } catch (err) {
    console.error("PUT /api/subjects/:id error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Delete a subject
export async function deleteSubject(req, res) {
  const db = getPool();
  const id = Number(req.params.id);

  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const [result] = await db.query("DELETE FROM subjects WHERE id = ?", [id]);
    res.json({ ok: true, deleted: result.affectedRows > 0 });
  } catch (err) {
    console.error("DELETE /api/subjects/:id error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Fetch all materials for a subject
export async function getSubjectMaterials(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const gradeId = req.query.grade_id ? Number(req.query.grade_id) : null;
    let sql = "SELECT id, subject_id, grade_id, title, file_path, uploaded_by, created_at FROM subject_materials WHERE subject_id = ?";
    const params = [id];
    
    if (gradeId) {
      sql += " AND grade_id = ?";
      params.push(gradeId);
    }
    
    sql += " ORDER BY created_at DESC";
    
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/subjects/:id/materials error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Upload a new material for a subject
import * as assetStorage from "./../storage.js";
import XLSX from "xlsx";
import { auditLog, actorFromReq } from "../utils/auditLogger.js";

export async function uploadSubjectMaterial(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const { title, file, contentType = "application/pdf" } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    if (!file) return res.status(400).json({ error: "file (base64) required" });

    // Validate subject exists
    const [subjRows] = await db.query("SELECT id FROM subjects WHERE id = ?", [id]);
    if (subjRows.length === 0) return res.status(404).json({ error: "Subject not found" });

    // Save file via assetStorage
    const safeKey = `subject_materials/sub${id}_${Date.now()}.pdf`;
    const buffer = Buffer.from(file.replace(/^data:[^;]+;base64,/, ""), "base64");
    
    if (buffer.length === 0) {
      return res.status(400).json({ error: "file content is empty" });
    }

    await assetStorage.saveUploadBuffer(safeKey, buffer, contentType);
    const publicUrl = assetStorage.getPublicUrl(safeKey);

    // Save record to DB
    const [result] = await db.query(
      "INSERT INTO subject_materials (subject_id, grade_id, title, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?)",
      [id, req.body.grade_id ? Number(req.body.grade_id) : null, title, publicUrl, "admin"]
    );

    res.status(201).json({
      id: String(result.insertId),
      subject_id: id,
      title,
      file_path: publicUrl,
      uploaded_by: "admin"
    });
  } catch (err) {
    console.error("POST /api/subjects/:id/materials error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Delete a specific subject material
export async function deleteSubjectMaterial(req, res) {
  const db = getPool();
  const id = Number(req.params.id); // material id
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const [rows] = await db.query("SELECT file_path FROM subject_materials WHERE id = ?", [id]);
    if (rows && rows[0] && rows[0].file_path) {
      const url = rows[0].file_path;
      // Extract key from URL or use as is if relative
      let key = url;
      if (url.startsWith('http')) {
        // Simple extraction: everything after the third slash
        const parts = url.split('/');
        key = parts.slice(3).join('/');
      }
      try {
        await assetStorage.deleteUpload(key);
      } catch (e) {
        console.warn("Could not delete file from storage:", e.message);
      }
    }

    await db.query("DELETE FROM subject_materials WHERE id = ?", [id]);
    res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("DELETE /api/subjects/materials/:id error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

/* ═══════════════════════════════════════════════════════════════
   SUBJECT QUESTION BANK
   A new table (subject_quiz_bank) holds questions tagged with:
     subject_id (from URL param), chapter (free text), grade (6-10)
   No topic_id required — teacher-friendly design.
═══════════════════════════════════════════════════════════════ */

/** Allowed file MIME types and extensions for Excel/CSV uploads */
const ALLOWED_EXCEL_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                           // .xls
  "text/csv",                                                            // .csv
  "application/csv",
  "text/plain",                                                          // Some clients send CSV as text/plain
]);

/**
 * Parse a base64 or raw-base64 encoded spreadsheet/csv buffer
 * using SheetJS (xlsx). Returns an array of row objects.
 */
function parseSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  // header: 1 — use first row as keys
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
}

/**
 * Normalize a correct_option value to uppercase single letter A/B/C/D.
 * Returns null if invalid.
 */
function normalizeCorrectOption(raw) {
  const val = String(raw ?? "").trim().toUpperCase();
  return ["A", "B", "C", "D"].includes(val) ? val : null;
}

/**
 * Normalize a grade value to an integer 6-10, or null if invalid.
 */
function normalizeGrade(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const num = parseInt(String(raw).trim(), 10);
  return num >= 6 && num <= 10 ? num : null;
}

/**
 * Normalize a level value to Easy, Medium, Hard.
 */
function normalizeLevel(raw) {
  if (!raw) return null;
  const val = String(raw).trim().toLowerCase();
  if (val === 'easy') return 'Easy';
  if (val === 'medium') return 'Medium';
  if (val === 'hard') return 'Hard';
  return null;
}

/* ──────────────────────────────────────────────────────────────
   1. BULK UPLOAD (GLOBAL MASTER UPLOAD)
   POST /api/subjects/question-bank/bulk
   Body: { file: "<base64 string of .xlsx / .xls / .csv>" }
──────────────────────────────────────────────────────────────── */
export async function bulkUploadQuestions(req, res) {
  const db = getPool();
  const { file } = req.body;
  if (!file) return res.status(400).json({ error: "file (base64) is required" });

  try {
    // 1. Fetch all subjects to build a map: { "physics": 1, "maths": 2 }
    const [subjRows] = await db.query("SELECT id, subject_name FROM subjects");
    const subjectMap = {};
    subjRows.forEach(s => {
      subjectMap[s.subject_name.trim().toLowerCase()] = s.id;
    });

    // 2. Decode base64 → Buffer
    const base64Data = file.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length === 0) return res.status(400).json({ error: "file content is empty" });

    // 3. Parse spreadsheet
    let rows;
    try {
      rows = parseSpreadsheetBuffer(buffer);
    } catch (parseErr) {
      return res.status(422).json({ error: "Could not parse file. Ensure it is a valid .xlsx, .xls, or .csv file.", detail: parseErr.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(422).json({ error: "The uploaded file has no data rows." });
    }

    const actor = actorFromReq(req);
    const uploadedBy   = actor.actor_name;
    const uploadedById = actor.actor_id;

    const validRows  = [];
    const errorRows  = [];

    for (let i = 0; i < rows.length; i++) {
      const row     = rows[i];
      const rowNum  = i + 2; // +2 because row 1 is the header in Excel

      const keys = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? "").trim()])
      );

      const rawSubject    = keys["subject"] || keys["subject name"] || "";
      const questionText  = keys["question"] || keys["question text"] || "";
      const optionA       = keys["option a"] || keys["a"] || "";
      const optionB       = keys["option b"] || keys["b"] || "";
      const optionC       = keys["option c"] || keys["c"] || "";
      const optionD       = keys["option d"] || keys["d"] || "";
      const rawCorrect    = keys["correct answer"] || keys["correct"] || keys["answer"] || "";
      const explanation   = keys["explanation"] || keys["explain"] || null;
      const chapter       = keys["chapter"] || null;
      const rawGrade      = keys["grade"] || keys["class"] || null;
      const topicName     = keys["topic name"] || keys["topic"] || null;
      const rawLevel      = keys["level"] || keys["difficulty"] || null;

      // Validate Subject
      if (!rawSubject) {
        errorRows.push({ row: rowNum, reason: "Subject is missing" });
        continue;
      }
      const subjectId = subjectMap[rawSubject.toLowerCase()];
      if (!subjectId) {
        errorRows.push({ row: rowNum, reason: `Subject '${rawSubject}' not found in database.` });
        continue;
      }

      // Validate required fields
      if (!questionText) {
        errorRows.push({ row: rowNum, reason: "Question text is missing" });
        continue;
      }
      if (!optionA || !optionB || !optionC || !optionD) {
        errorRows.push({ row: rowNum, reason: "One or more options (A/B/C/D) are missing" });
        continue;
      }
      const correctOption = normalizeCorrectOption(rawCorrect);
      if (!correctOption) {
        errorRows.push({ row: rowNum, reason: `Correct Answer "${rawCorrect}" is invalid. Must be A, B, C, or D.` });
        continue;
      }

      const grade = normalizeGrade(rawGrade);
      const level = normalizeLevel(rawLevel);

      validRows.push([
        subjectId,
        chapter && chapter.length > 0 ? chapter : null,
        grade,
        topicName && topicName.length > 0 ? topicName : null,
        level,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        explanation && explanation.length > 0 ? explanation : null,
        uploadedBy,
        uploadedById,
      ]);
    }

    // Bulk insert all valid rows in one query
    let insertedCount = 0;
    if (validRows.length > 0) {
      const [insertResult] = await db.query(
        `INSERT INTO subject_quiz_bank
          (subject_id, chapter, grade, topic_name, level, question_text,
           option_a, option_b, option_c, option_d,
           correct_option, explanation, uploaded_by, uploaded_by_id)
         VALUES ?`,
        [validRows]
      );
      insertedCount = insertResult.affectedRows;
    }

    // Audit log
    await auditLog(db, {
      ...actor,
      action:    "CREATE",
      entity:    "question_bank_bulk_global",
      entity_id: "global",
      meta: {
        total_rows:   rows.length,
        uploaded:     insertedCount,
        failed:       errorRows.length,
      },
      req,
    });

    return res.status(201).json({
      ok:       true,
      uploaded: insertedCount,
      failed:   errorRows.length,
      errors:   errorRows,
    });
  } catch (err) {
    console.error("POST /api/subjects/question-bank/bulk error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────
   2. SINGLE QUESTION CREATE
   POST /api/subjects/:id/question-bank
──────────────────────────────────────────────────────────────── */
export async function createSubjectQuestion(req, res) {
  const db = getPool();
  const subjectId = Number(req.params.id);
  if (!subjectId) return res.status(400).json({ error: "subject id required" });

  const {
    question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, chapter, grade, topic_name, level
  } = req.body;

  if (!question_text || !option_a || !option_b || !option_c || !option_d) {
    return res.status(400).json({ error: "question_text and all four options are required" });
  }
  const normalizedCorrect = normalizeCorrectOption(correct_option);
  if (!normalizedCorrect) {
    return res.status(400).json({ error: "correct_option must be A, B, C, or D" });
  }

  try {
    const [subjRows] = await db.query("SELECT id FROM subjects WHERE id = ? LIMIT 1", [subjectId]);
    if (!subjRows || subjRows.length === 0) return res.status(404).json({ error: "Subject not found" });

    const actor = actorFromReq(req);
    const [result] = await db.query(
      `INSERT INTO subject_quiz_bank
        (subject_id, chapter, grade, topic_name, level, question_text,
         option_a, option_b, option_c, option_d,
         correct_option, explanation, uploaded_by, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subjectId,
        chapter || null,
        normalizeGrade(grade),
        topic_name || null,
        normalizeLevel(level),
        question_text,
        option_a, option_b, option_c, option_d,
        normalizedCorrect,
        explanation || null,
        actor.actor_name,
        actor.actor_id,
      ]
    );

    await auditLog(db, {
      ...actor,
      action: "CREATE", entity: "question_bank", entity_id: String(result.insertId),
      meta: { subject_id: subjectId, chapter, grade, question_text },
      req,
    });

    return res.status(201).json({ ok: true, id: String(result.insertId), subject_id: subjectId });
  } catch (err) {
    console.error("POST /api/subjects/:id/question-bank error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────
   3. GET — Per-subject filtered list
   GET /api/subjects/:id/question-bank
   ?chapter=Optics &grade=10 &page=1 &limit=50
──────────────────────────────────────────────────────────────── */
export async function getSubjectQuestionBank(req, res) {
  const db = getPool();
  const subjectId = Number(req.params.id);
  if (!subjectId) return res.status(400).json({ error: "subject id required" });

  const page  = Math.max(1, parseInt(req.query.page  || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
  const offset = (page - 1) * limit;

  const conditions = ["sqb.subject_id = ?"];
  const params     = [subjectId];

  if (req.query.grade) {
    const g = normalizeGrade(req.query.grade);
    if (g) { conditions.push("sqb.grade = ?"); params.push(g); }
  }
  if (req.query.chapter) {
    conditions.push("sqb.chapter LIKE ?");
    params.push(`%${req.query.chapter}%`);
  }
  if (req.query.topic_name) {
    conditions.push("sqb.topic_name LIKE ?");
    params.push(`%${req.query.topic_name}%`);
  }
  if (req.query.level) {
    const l = normalizeLevel(req.query.level);
    if (l) { conditions.push("sqb.level = ?"); params.push(l); }
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM subject_quiz_bank sqb ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT sqb.id, sqb.subject_id, s.subject_name, sqb.chapter, sqb.grade, sqb.topic_name, sqb.level,
              sqb.question_text, sqb.option_a, sqb.option_b, sqb.option_c, sqb.option_d,
              sqb.correct_option, sqb.explanation, sqb.uploaded_by, sqb.created_at
       FROM subject_quiz_bank sqb
       JOIN subjects s ON s.id = sqb.subject_id
       ${where}
       ORDER BY sqb.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      total: Number(total),
      page, limit,
      total_pages: Math.ceil(Number(total) / limit),
      filters: {
        subject_id: subjectId,
        grade: req.query.grade || null,
        chapter: req.query.chapter || null,
        topic_name: req.query.topic_name || null,
        level: req.query.level || null,
      },
      data: rows,
    });
  } catch (err) {
    console.error("GET /api/subjects/:id/question-bank error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────
   4. GET — System-wide filtered list (admin view)
   GET /api/subjects/question-bank
   ?subject_id=3 &chapter=Optics &grade=10 &page=1 &limit=50
──────────────────────────────────────────────────────────────── */
export async function getQuestionBank(req, res) {
  const db = getPool();

  const page  = Math.max(1, parseInt(req.query.page  || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params     = [];

  if (req.query.subject_id) {
    conditions.push("sqb.subject_id = ?");
    params.push(Number(req.query.subject_id));
  }
  if (req.query.grade) {
    const g = normalizeGrade(req.query.grade);
    if (g) { conditions.push("sqb.grade = ?"); params.push(g); }
  }
  if (req.query.chapter) {
    conditions.push("sqb.chapter LIKE ?");
    params.push(`%${req.query.chapter}%`);
  }
  if (req.query.topic_name) {
    conditions.push("sqb.topic_name LIKE ?");
    params.push(`%${req.query.topic_name}%`);
  }
  if (req.query.level) {
    const l = normalizeLevel(req.query.level);
    if (l) { conditions.push("sqb.level = ?"); params.push(l); }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM subject_quiz_bank sqb ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT sqb.id, sqb.subject_id, s.subject_name, sqb.chapter, sqb.grade, sqb.topic_name, sqb.level,
              sqb.question_text, sqb.option_a, sqb.option_b, sqb.option_c, sqb.option_d,
              sqb.correct_option, sqb.explanation, sqb.uploaded_by, sqb.created_at
       FROM subject_quiz_bank sqb
       JOIN subjects s ON s.id = sqb.subject_id
       ${where}
       ORDER BY sqb.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      total: Number(total),
      page, limit,
      total_pages: Math.ceil(Number(total) / limit),
      filters: {
        subject_id: req.query.subject_id || null,
        grade: req.query.grade || null,
        chapter: req.query.chapter || null,
        topic_name: req.query.topic_name || null,
        level: req.query.level || null,
      },
      data: rows,
    });
  } catch (err) {
    console.error("GET /api/subjects/question-bank error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────
   5. UPDATE — Edit a single question
   PUT /api/subjects/question-bank/:qid
──────────────────────────────────────────────────────────────── */
export async function updateSubjectQuestion(req, res) {
  const db = getPool();
  const qid = Number(req.params.qid);
  if (!qid) return res.status(400).json({ error: "question id required" });

  const {
    question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, chapter, grade, topic_name, level
  } = req.body;

  try {
    const updates = [];
    const values  = [];

    if (question_text !== undefined) { updates.push("question_text = ?"); values.push(String(question_text).trim()); }
    if (option_a !== undefined)      { updates.push("option_a = ?");      values.push(String(option_a).trim()); }
    if (option_b !== undefined)      { updates.push("option_b = ?");      values.push(String(option_b).trim()); }
    if (option_c !== undefined)      { updates.push("option_c = ?");      values.push(String(option_c).trim()); }
    if (option_d !== undefined)      { updates.push("option_d = ?");      values.push(String(option_d).trim()); }
    if (explanation !== undefined)   { updates.push("explanation = ?");   values.push(explanation || null); }
    if (chapter !== undefined)       { updates.push("chapter = ?");       values.push(chapter || null); }
    if (topic_name !== undefined)    { updates.push("topic_name = ?");    values.push(topic_name || null); }
    if (grade !== undefined)         { updates.push("grade = ?");         values.push(normalizeGrade(grade)); }
    if (level !== undefined)         { updates.push("level = ?");         values.push(normalizeLevel(level)); }
    if (correct_option !== undefined) {
      const normalized = normalizeCorrectOption(correct_option);
      if (!normalized) return res.status(400).json({ error: "correct_option must be A, B, C, or D" });
      updates.push("correct_option = ?");
      values.push(normalized);
    }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(qid);
    const [result] = await db.query(
      `UPDATE subject_quiz_bank SET ${updates.join(", ")} WHERE id = ?`, values
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Question not found" });

    await auditLog(db, {
      ...actorFromReq(req),
      action: "UPDATE", entity: "question_bank", entity_id: String(qid),
      meta: { updated_fields: updates.map(u => u.split(" = ")[0]) },
      req,
    });

    return res.json({ ok: true, id: String(qid), updated: true });
  } catch (err) {
    console.error("PUT /api/subjects/question-bank/:qid error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────
   6. DELETE — Remove a single question
   DELETE /api/subjects/question-bank/:qid
──────────────────────────────────────────────────────────────── */
export async function deleteSubjectQuestion(req, res) {
  const db = getPool();
  const qid = Number(req.params.qid);
  if (!qid) return res.status(400).json({ error: "question id required" });

  try {
    const [result] = await db.query("DELETE FROM subject_quiz_bank WHERE id = ?", [qid]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Question not found" });

    await auditLog(db, {
      ...actorFromReq(req),
      action: "DELETE", entity: "question_bank", entity_id: String(qid), req,
    });

    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("DELETE /api/subjects/question-bank/:qid error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

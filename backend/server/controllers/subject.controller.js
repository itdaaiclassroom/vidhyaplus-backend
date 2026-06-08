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
      "SELECT id, grades, icon FROM subjects WHERE subject_name = ? LIMIT 1",
      [name]
    );
    if (existing && existing.length > 0) {
      const subjectId = existing[0].id;
      const currentGradesStr = existing[0].grades || "";
      
      if (currentGradesStr) {
        const currentGradesList = currentGradesStr.split(",").map(g => g.trim()).filter(Boolean);
        const incomingGradesList = (Array.isArray(grades) ? grades : [grades]).map(g => String(g).trim()).filter(Boolean);
        
        // Merge without duplicates
        const mergedGradesSet = new Set([...currentGradesList, ...incomingGradesList]);
        const updatedGradesStr = Array.from(mergedGradesSet).join(",");
        
        await db.query("UPDATE subjects SET grades = ? WHERE id = ?", [updatedGradesStr, subjectId]);
        
        return res.status(200).json({
          id: String(subjectId),
          name,
          grades: Array.from(mergedGradesSet).map(Number),
          icon: existing[0].icon || '📚',
          updated: true
        });
      } else {
        // If grades column is null/empty, it's already available for all grades
        return res.status(200).json({
          id: String(subjectId),
          name,
          grades: null,
          icon: existing[0].icon || '📚',
          updated: false
        });
      }
    }

    const [result] = await db.query(
      "INSERT INTO subjects (subject_name, grades, icon) VALUES (?, ?, ?)",
      [name, grades ? String(grades) : null, icon || '📚']
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
  const gradeId = req.query.grade_id ? String(req.query.grade_id).trim() : null;

  if (!id) return res.status(400).json({ error: "id required" });

  try {
    if (gradeId) {
      const [rows] = await db.query("SELECT grades FROM subjects WHERE id = ? LIMIT 1", [id]);
      if (rows && rows.length > 0) {
        const gradesStr = rows[0].grades || "";
        if (gradesStr) {
          const gradesList = gradesStr.split(",").map(g => g.trim()).filter(g => g !== gradeId && g.length > 0);
          if (gradesList.length > 0) {
            const updatedGradesStr = gradesList.join(",");
            await db.query("UPDATE subjects SET grades = ? WHERE id = ?", [updatedGradesStr, id]);
            return res.json({ ok: true, disassociated: true });
          }
        }
      }
    }

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

    // --- REPLACEMENT LOGIC: Check for existing material with same title/grade ---
    const [existing] = await db.query(
      "SELECT id, file_path FROM subject_materials WHERE subject_id = ? AND grade_id = ? AND title = ? LIMIT 1",
      [id, req.body.grade_id ? Number(req.body.grade_id) : null, title]
    );

    if (existing && existing.length > 0) {
      const oldUrl = existing[0].file_path;
      if (oldUrl) {
        let oldKey = oldUrl;
        if (oldUrl.startsWith('http')) {
          const parts = oldUrl.split('/');
          oldKey = parts.slice(3).join('/');
        }
        try {
          await assetStorage.deleteUpload(oldKey);
          console.log("[materials] Deleted old file before replacement:", oldKey);
        } catch (e) {
          console.warn("[materials] Could not delete old file:", e.message);
        }
      }

      // Update existing record
      await db.query(
        "UPDATE subject_materials SET file_path = ?, uploaded_by = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
        [publicUrl, "admin", existing[0].id]
      );

      return res.json({
        id: String(existing[0].id),
        subject_id: id,
        title,
        file_path: publicUrl,
        uploaded_by: "admin",
        replaced: true
      });
    }

    // Save record to DB (New insert)
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
    const uploadedBy = actor.actor_name;
    const uploadedById = actor.actor_id;

    // --- DEDUPLICATION LOGIC ---
    // Fetch all existing subject_id and question_text to build a fast memory Set
    const [existingRows] = await db.query("SELECT subject_id, question_text FROM subject_quiz_bank");
    const existingSet = new Set(
      existingRows.map(r => `${r.subject_id}_${(r.question_text || "").trim().toLowerCase()}`)
    );
    let skippedCount = 0;
    // ---------------------------

    const validRows = [];
    const errorRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is the header in Excel

      const keys = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? "").trim()])
      );

      const rawSubject = keys["subject"] || keys["subject name"] || "";
      const questionText = keys["question"] || keys["question text"] || "";
      const optionA = keys["option a"] || keys["a"] || "";
      const optionB = keys["option b"] || keys["b"] || "";
      const optionC = keys["option c"] || keys["c"] || "";
      const optionD = keys["option d"] || keys["d"] || "";
      const rawCorrect = keys["correct answer"] || keys["correct"] || keys["answer"] || "";
      const explanation = keys["explanation"] || keys["explain"] || null;
      const chapter = keys["chapter"] || null;
      const rawGrade = keys["grade"] || keys["class"] || null;
      const topicName = keys["topic name"] || keys["topic"] || null;
      const rawLevel = keys["level"] || keys["difficulty"] || null;

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

      // --- DEDUPLICATION CHECK ---
      const uniqueKey = `${subjectId}_${questionText.trim().toLowerCase()}`;
      if (existingSet.has(uniqueKey)) {
        skippedCount++;
        continue;
      }
      existingSet.add(uniqueKey); // Prevent duplicates inside the SAME excel file
      // ---------------------------

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
      action: "CREATE",
      entity: "question_bank_bulk_global",
      entity_id: "global",
      meta: {
        total_rows: rows.length,
        uploaded: insertedCount,
        skipped: skippedCount,
        failed: errorRows.length,
      },
      req,
    });

    return res.status(201).json({
      ok: true,
      uploaded: insertedCount,
      skipped: skippedCount,
      failed: errorRows.length,
      errors: errorRows,
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

export async function getSubjectTopics(req, res) {
  const db = getPool();
  const subjectId = Number(req.params.id);
  const grade = req.query.grade ? Number(req.query.grade) : null;

  try {
    let query = `
      SELECT t.id, t.name, t.chapter_id, c.chapter_name 
      FROM topics t
      JOIN chapters c ON c.id = t.chapter_id
      WHERE c.subject_id = ?
    `;
    const params = [subjectId];

    if (grade) {
      query += " AND c.grade_id = ?";
      params.push(grade);
    }

    query += " ORDER BY c.chapter_name, t.id";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/subjects/:id/topics error:", err);
    res.status(500).json({ error: String(err.message) });
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

  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
  const offset = (page - 1) * limit;

  const conditions = ["sqb.subject_id = ?"];
  const params = [subjectId];

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

  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
  const offset = (page - 1) * limit;
  // random=true: used by the AI service to get a varied selection (ORDER BY RAND())
  const useRandom = req.query.random === "true";

  const conditions = [];
  const params = [];

  if (req.query.subject_id) {
    conditions.push("sqb.subject_id = ?");
    params.push(Number(req.query.subject_id));
  }
  if (req.query.subject_name) {
    conditions.push("s.subject_name = ?");
    params.push(String(req.query.subject_name).trim());
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
  // Use ORDER BY RAND() only for AI requests; use created_at DESC for normal admin UI
  const orderBy = useRandom ? "ORDER BY RAND()" : "ORDER BY sqb.created_at DESC";

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM subject_quiz_bank sqb JOIN subjects s ON s.id = sqb.subject_id ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT sqb.id, sqb.subject_id, s.subject_name, sqb.chapter, sqb.grade, sqb.topic_name, sqb.level,
              sqb.question_text, sqb.option_a, sqb.option_b, sqb.option_c, sqb.option_d,
              sqb.correct_option, sqb.explanation, sqb.uploaded_by, sqb.created_at
       FROM subject_quiz_bank sqb
       JOIN subjects s ON s.id = sqb.subject_id
       ${where}
       ${orderBy}
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
    const values = [];

    if (question_text !== undefined) { updates.push("question_text = ?"); values.push(String(question_text).trim()); }
    if (option_a !== undefined) { updates.push("option_a = ?"); values.push(String(option_a).trim()); }
    if (option_b !== undefined) { updates.push("option_b = ?"); values.push(String(option_b).trim()); }
    if (option_c !== undefined) { updates.push("option_c = ?"); values.push(String(option_c).trim()); }
    if (option_d !== undefined) { updates.push("option_d = ?"); values.push(String(option_d).trim()); }
    if (explanation !== undefined) { updates.push("explanation = ?"); values.push(explanation || null); }
    if (chapter !== undefined) { updates.push("chapter = ?"); values.push(chapter || null); }
    if (topic_name !== undefined) { updates.push("topic_name = ?"); values.push(topic_name || null); }
    if (grade !== undefined) { updates.push("grade = ?"); values.push(normalizeGrade(grade)); }
    if (level !== undefined) { updates.push("level = ?"); values.push(normalizeLevel(level)); }
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

/**
 * GET /api/subjects/question-bank/metadata
 * Fetches unique chapters and topics for filtering.
 */
export async function getQuestionBankMetadata(req, res) {
  const db = getPool();
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
  const grade = req.query.grade ? Number(req.query.grade) : null;

  try {
    let where = "WHERE 1=1";
    const params = [];
    if (subjectId) {
      where += " AND subject_id = ?";
      params.push(subjectId);
    }
    if (grade) {
      where += " AND grade = ?";
      params.push(grade);
    }

    const [chapters] = await db.query(
      `SELECT DISTINCT chapter FROM subject_quiz_bank ${where} AND chapter IS NOT NULL AND chapter != '' ORDER BY chapter`,
      params
    );
    const [topics] = await db.query(
      `SELECT DISTINCT topic_name FROM subject_quiz_bank ${where} AND topic_name IS NOT NULL AND topic_name != '' ORDER BY topic_name`,
      params
    );

    res.json({
      chapters: chapters.map(c => c.chapter),
      topics: topics.map(t => t.topic_name)
    });
  } catch (err) {
    console.error("GET /api/subjects/question-bank/metadata error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────
   7. BULK DELETE — Remove multiple questions or all based on filters
   DELETE /api/subjects/question-bank/bulk
──────────────────────────────────────────────────────────────── */
export async function bulkDeleteQuestionsHandler(req, res) {
  const db = getPool();
  const { question_ids, delete_all, filters } = req.body;

  try {
    if (delete_all) {
      // Delete based on filters
      const conditions = [];
      const params = [];
      if (filters) {
        if (filters.subject_id) { conditions.push("subject_id = ?"); params.push(Number(filters.subject_id)); }
        if (filters.grade) { conditions.push("grade = ?"); params.push(Number(filters.grade)); }
        if (filters.chapter) { conditions.push("chapter = ?"); params.push(filters.chapter); }
        if (filters.topic_name) { conditions.push("topic_name = ?"); params.push(filters.topic_name); }
        if (filters.level) { conditions.push("level = ?"); params.push(filters.level); }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      
      const [result] = await db.query(`DELETE FROM subject_quiz_bank ${whereClause}`, params);
      
      await auditLog(db, {
        ...actorFromReq(req),
        action: "DELETE_BULK", entity: "question_bank", entity_id: "multiple",
        meta: { deleted_count: result.affectedRows, filters, delete_all: true }, req,
      });

      return res.json({ ok: true, deleted_count: result.affectedRows });
    } else if (Array.isArray(question_ids) && question_ids.length > 0) {
      // Create ?,?,? placeholders for IN clause
      const placeholders = question_ids.map(() => "?").join(",");
      const [result] = await db.query(`DELETE FROM subject_quiz_bank WHERE id IN (${placeholders})`, question_ids);
      
      await auditLog(db, {
        ...actorFromReq(req),
        action: "DELETE_BULK", entity: "question_bank", entity_id: "multiple",
        meta: { deleted_count: result.affectedRows, question_ids }, req,
      });

      return res.json({ ok: true, deleted_count: result.affectedRows });
    } else {
      return res.status(400).json({ error: "Provide either a non-empty question_ids array or delete_all flag." });
    }
  } catch (err) {
    console.error("DELETE /api/subjects/question-bank/bulk error:", err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ══════════════════════════════════════════════════════════════════════
   CURRICULUM STRUCTURE — Excel-based chapter/topic hierarchy upload
   Table: curriculum_structure
   Mirrors the question-bank bulk-upload pattern exactly.
══════════════════════════════════════════════════════════════════════ */

/** Normalize grade for curriculum: allows 1–10 (wider than question bank's 6–10) */
function normalizeGradeFull(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const num = parseInt(String(raw).trim(), 10);
  return num >= 1 && num <= 10 ? num : null;
}

/* ──────────────────────────────────────────────────────────────────────
   1. BULK UPLOAD — Excel / CSV → writes to chapters + topics tables
   POST /api/subjects/curriculum/bulk
   Body: { file: "<base64 .xlsx / .xls / .csv>" }
   Auth: admin, principal, material_management

   Excel columns: subject, grade, chapter, topic
   Optional:      subtopics (;-separated), learning_intent

   One row = one topic. Multiple rows with same chapter = topics under it.
   Writes to the SAME chapters+topics tables the Teacher Dashboard reads.
────────────────────────────────────────────────────────────────────── */
export async function bulkUploadCurriculum(req, res) {
  const db = getPool();
  const { file } = req.body;
  if (!file) return res.status(400).json({ error: 'file (base64) is required' });

  try {
    // 1. Build subject name → id map
    const [subjRows] = await db.query('SELECT id, subject_name FROM subjects');
    const subjectMap = {};
    subjRows.forEach(s => { subjectMap[s.subject_name.trim().toLowerCase()] = s.id; });

    // 2. Decode & parse spreadsheet (reuses existing parseSpreadsheetBuffer helper)
    const base64Data = file.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) return res.status(400).json({ error: 'file content is empty' });

    let rows;
    try {
      rows = parseSpreadsheetBuffer(buffer);
    } catch (parseErr) {
      return res.status(422).json({ error: 'Could not parse file. Ensure it is .xlsx, .xls, or .csv.', detail: parseErr.message });
    }
    if (!rows || rows.length === 0) {
      return res.status(422).json({ error: 'The uploaded file has no data rows.' });
    }

    // 3. Pre-load existing chapters and topics into memory maps/sets for fast lookup
    const [existChapters] = await db.query('SELECT id, subject_id, grade_id, chapter_name, chapter_no FROM chapters');
    const dbChapters = {};
    const maxChapterNo = {};
    for (const c of existChapters) {
      const chKey = `${c.subject_id}_${c.grade_id}_${c.chapter_name.trim().toLowerCase()}`;
      dbChapters[chKey] = { id: c.id, chapterNo: c.chapter_no };

      const sgKey = `${c.subject_id}_${c.grade_id}`;
      maxChapterNo[sgKey] = Math.max(maxChapterNo[sgKey] || 0, c.chapter_no);
    }

    const [existTopics] = await db.query('SELECT id, chapter_id, name, order_num FROM topics');
    const dbTopics = new Set();
    const maxTopicOrder = {};
    for (const t of existTopics) {
      dbTopics.add(`${t.chapter_id}_${t.name.trim().toLowerCase()}`);
      maxTopicOrder[t.chapter_id] = Math.max(maxTopicOrder[t.chapter_id] || 0, t.order_num);
    }

    // 4. Parse and validate all rows
    const validRows = [];
    const errorRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const keys = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim()])
      );

      const rawSubject     = keys['subject'] || keys['subject name'] || '';
      const rawGrade       = keys['grade'] || keys['class'] || '';
      const chapterName    = (keys['chapter'] || keys['chapter name'] || '').trim();
      const topicName      = (keys['topic'] || keys['topic name'] || '').trim();
      const learningIntent = keys['learning intent'] || keys['learning_intent'] || null;

      if (!rawSubject) { errorRows.push({ row: rowNum, reason: 'Subject is missing' }); continue; }
      const subjectId = subjectMap[rawSubject.toLowerCase()];
      if (!subjectId) { errorRows.push({ row: rowNum, reason: `Subject '${rawSubject}' not found` }); continue; }
      const grade = normalizeGradeFull(rawGrade);
      if (!grade) { errorRows.push({ row: rowNum, reason: `Grade '${rawGrade}' is invalid (1–10)` }); continue; }
      if (!chapterName) { errorRows.push({ row: rowNum, reason: 'Chapter is missing' }); continue; }
      if (!topicName)   { errorRows.push({ row: rowNum, reason: 'Topic is missing' }); continue; }

      validRows.push({
        subjectId,
        grade,
        chapterName,
        topicName,
        learningIntent: learningIntent || null
      });
    }

    if (validRows.length === 0 && errorRows.length > 0) {
      return res.status(422).json({ ok: false, uploaded: 0, skipped: 0, failed: errorRows.length, errors: errorRows });
    }

    // 5. Process valid rows in a transaction: reuse/insert chapters, skip/insert topics
    let chaptersInserted = 0;
    let topicsInserted = 0;
    let topicsSkipped = 0;

    const processedTopicsInFile = new Set();

    await db.query('START TRANSACTION');
    try {
      for (const item of validRows) {
        const { subjectId, grade, chapterName, topicName, learningIntent } = item;

        // Check if chapter already exists in database or was created during this transaction
        const chKey = `${subjectId}_${grade}_${chapterName.toLowerCase()}`;
        let chapterId;
        
        if (dbChapters[chKey]) {
          chapterId = dbChapters[chKey].id;
        } else {
          // Determine the next chapter number for this subject and grade
          const sgKey = `${subjectId}_${grade}`;
          const nextNo = (maxChapterNo[sgKey] || 0) + 1;
          maxChapterNo[sgKey] = nextNo;

          // Insert new chapter
          const [chResult] = await db.query(
            `INSERT INTO chapters (subject_id, grade_id, chapter_name, chapter_no, macro_month_label, teaching_plan_summary)
             VALUES (?, ?, ?, ?, 'June', ?)`,
            [subjectId, grade, chapterName, nextNo, learningIntent]
          );
          chapterId = chResult.insertId;
          dbChapters[chKey] = { id: chapterId, chapterNo: nextNo };
          chaptersInserted++;
        }

        if (!chapterId) {
          throw new Error(`Failed to resolve chapter ID for chapter '${chapterName}'`);
        }

        // Check if topic already exists in database or within the same file upload
        const tKey = `${chapterId}_${topicName.toLowerCase()}`;
        
        if (dbTopics.has(tKey) || processedTopicsInFile.has(tKey)) {
          topicsSkipped++;
          continue; // Skip existing topic
        }

        // Determine next topic order number
        const nextOrder = (maxTopicOrder[chapterId] || 0) + 1;
        maxTopicOrder[chapterId] = nextOrder;

        // Insert new topic
        await db.query(
          `INSERT INTO topics (chapter_id, name, order_num, status)
           VALUES (?, ?, ?, 'not_started')`,
          [chapterId, topicName, nextOrder]
        );
        
        dbTopics.add(tKey);
        processedTopicsInFile.add(tKey);
        topicsInserted++;
      }
      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    console.log(`[curriculum-bulk] ✅ ${chaptersInserted} chapters, ${topicsInserted} topics from Excel (skipped ${topicsSkipped} duplicates)`);
    return res.status(201).json({
      ok: true,
      chapters_inserted: chaptersInserted,
      uploaded: topicsInserted,
      skipped: topicsSkipped,
      failed: errorRows.length,
      errors: errorRows,
    });

  } catch (err) {
    console.error('POST /api/subjects/curriculum/bulk error:', err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────────────
   2. GET — Curriculum list (reads from chapters + topics — same as Teacher Dashboard)
   GET /api/subjects/curriculum
   Query: ?subject_id=1&grade=10
   Auth: admin, principal, teacher, material_management
────────────────────────────────────────────────────────────────────── */
export async function getCurriculumStructure(req, res) {
  const db = getPool();

  const conditions = [];
  const params = [];

  if (req.query.subject_id) {
    conditions.push('c.subject_id = ?');
    params.push(Number(req.query.subject_id));
  }
  if (req.query.grade) {
    const g = normalizeGradeFull(req.query.grade);
    if (g) { conditions.push('c.grade_id = ?'); params.push(g); }
  }
  if (req.query.chapter) {
    conditions.push('c.chapter_name LIKE ?');
    params.push(`%${req.query.chapter}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Fetch all matching chapters with their subject name
    const [chapters] = await db.query(
      `SELECT c.id AS chapter_id, c.subject_id, s.subject_name, c.grade_id AS grade,
              c.chapter_name, c.chapter_no, c.teaching_plan_summary AS learning_intent
       FROM chapters c
       JOIN subjects s ON s.id = c.subject_id
       ${where}
       ORDER BY c.subject_id, c.grade_id, c.chapter_no, c.chapter_name`,
      params
    );

    if (chapters.length === 0) {
      return res.json({ total_topics: 0, chapters: [] });
    }

    // Fetch topics for all returned chapters in one query
    const chapterIds = chapters.map(c => c.chapter_id);
    const placeholders = chapterIds.map(() => '?').join(',');
    const [topics] = await db.query(
      `SELECT id, chapter_id, name AS topic_name, order_num AS topic_order, status
       FROM topics
       WHERE chapter_id IN (${placeholders})
       ORDER BY chapter_id, order_num, name`,
      chapterIds
    );

    // Group topics under their chapter
    const topicsByChapter = {};
    for (const t of topics) {
      if (!topicsByChapter[t.chapter_id]) topicsByChapter[t.chapter_id] = [];
      topicsByChapter[t.chapter_id].push({
        id: t.id,
        topic_name: t.topic_name,
        topic_order: t.topic_order,
        status: t.status,
        subtopics: [],
      });
    }

    const result = chapters.map(c => ({
      chapter_id: c.chapter_id,
      subject_id: c.subject_id,
      subject_name: c.subject_name,
      grade: c.grade,
      chapter_name: c.chapter_name,
      chapter_order: c.chapter_no,
      learning_intent: c.learning_intent,
      topics: topicsByChapter[c.chapter_id] || [],
    }));

    return res.json({
      total_topics: topics.length,
      chapters: result,
    });
  } catch (err) {
    console.error('GET /api/subjects/curriculum error:', err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────────────
   3. DELETE — Remove a single topic by topics.id
   DELETE /api/subjects/curriculum/:id
   Auth: admin, material_management
────────────────────────────────────────────────────────────────────── */
export async function deleteCurriculumEntry(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    // Delete from topics table (same table Teacher Dashboard uses)
    const [result] = await db.query('DELETE FROM topics WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Topic not found' });
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('DELETE /api/subjects/curriculum/:id error:', err);
    return res.status(500).json({ error: String(err.message) });
  }
}

/* ──────────────────────────────────────────────────────────────────────
   4. BULK DELETE — Remove multiple entries or all by filters
   DELETE /api/subjects/curriculum/bulk
   Body: { entry_ids: [1,2,3] } OR { delete_all: true, filters: { subject_id, grade, chapter_name } }
   Auth: admin, material_management
────────────────────────────────────────────────────────────────────── */
export async function bulkDeleteCurriculumHandler(req, res) {
  const db = getPool();
  const { entry_ids, delete_all, filters } = req.body;

  try {
    if (delete_all) {
      const conditions = [];
      const params = [];
      if (filters) {
        if (filters.subject_id) { conditions.push('subject_id = ?'); params.push(Number(filters.subject_id)); }
        if (filters.grade)      { conditions.push('grade = ?');      params.push(Number(filters.grade)); }
        if (filters.chapter_name) { conditions.push('chapter_name = ?'); params.push(filters.chapter_name); }
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const [result] = await db.query(`DELETE FROM curriculum_structure ${whereClause}`, params);
      return res.json({ ok: true, deleted_count: result.affectedRows });
    } else if (Array.isArray(entry_ids) && entry_ids.length > 0) {
      const placeholders = entry_ids.map(() => '?').join(',');
      const [result] = await db.query(`DELETE FROM curriculum_structure WHERE id IN (${placeholders})`, entry_ids);
      return res.json({ ok: true, deleted_count: result.affectedRows });
    } else {
      return res.status(400).json({ error: 'Provide entry_ids array or delete_all flag.' });
    }
  } catch (err) {
    console.error('DELETE /api/subjects/curriculum/bulk error:', err);
    return res.status(500).json({ error: String(err.message) });
  }
}

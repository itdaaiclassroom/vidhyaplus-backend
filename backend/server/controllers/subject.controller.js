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
    const [rows] = await db.query(
      "SELECT id, subject_id, title, file_path, uploaded_by, created_at FROM subject_materials WHERE subject_id = ? ORDER BY created_at DESC",
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/subjects/:id/materials error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

// Upload a new material for a subject
import * as assetStorage from "./../storage.js";

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
      "INSERT INTO subject_materials (subject_id, title, file_path, uploaded_by) VALUES (?, ?, ?, ?)",
      [id, title, publicUrl, "admin"]
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

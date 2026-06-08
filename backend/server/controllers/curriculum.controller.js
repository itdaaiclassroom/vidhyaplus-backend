import getPool from "../config/db.js";

// --- Grades (Classes) ---
export async function getGrades(req, res) {
  try {
    const db = getPool();
    const [rows] = await db.query("SELECT id, grade_label FROM grades ORDER BY id");
    res.json({ grades: rows });
  } catch (err) {
    console.error("GET /api/curriculum/grades error:", err);
    res.status(500).json({ error: "Failed to fetch grades" });
  }
}

export async function createGrade(req, res) {
  try {
    const db = getPool();
    const { id, grade_label } = req.body;
    if (!id || !grade_label) return res.status(400).json({ error: "id and grade_label required" });
    
    await db.query("INSERT INTO grades (id, grade_label) VALUES (?, ?)", [id, grade_label]);
    res.json({ ok: true, grade: { id, grade_label } });
  } catch (err) {
    console.error("POST /api/curriculum/grades error:", err);
    res.status(500).json({ error: "Failed to create grade" });
  }
}

export async function updateGrade(req, res) {
  try {
    const db = getPool();
    const { grade_label } = req.body;
    const { id } = req.params;
    
    await db.query("UPDATE grades SET grade_label = ? WHERE id = ?", [grade_label, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/curriculum/grades error:", err);
    res.status(500).json({ error: "Failed to update grade" });
  }
}

export async function deleteGrade(req, res) {
  try {
    const db = getPool();
    const { id } = req.params;
    await db.query("DELETE FROM grades WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/curriculum/grades error:", err);
    res.status(500).json({ error: "Failed to delete grade. Ensure no sections are linked to it." });
  }
}

// --- Chapters ---
export async function createChapter(req, res) {
  try {
    const db = getPool();
    const { subject_id, grade_id, chapter_no, chapter_name } = req.body;
    if (!subject_id || !grade_id || !chapter_no || !chapter_name) {
      return res.status(400).json({ error: "subject_id, grade_id, chapter_no, chapter_name required" });
    }
    
    const [result] = await db.query(
      "INSERT INTO chapters (subject_id, grade_id, chapter_no, chapter_name) VALUES (?, ?, ?, ?)",
      [subject_id, grade_id, chapter_no, chapter_name]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("POST /api/curriculum/chapters error:", err);
    res.status(500).json({ error: "Failed to create chapter" });
  }
}

export async function updateChapter(req, res) {
  try {
    const db = getPool();
    const { id } = req.params;
    const { chapter_no, chapter_name } = req.body;
    
    await db.query(
      "UPDATE chapters SET chapter_no = ?, chapter_name = ? WHERE id = ?",
      [chapter_no, chapter_name, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/curriculum/chapters error:", err);
    res.status(500).json({ error: "Failed to update chapter" });
  }
}

export async function deleteChapter(req, res) {
  try {
    const db = getPool();
    const { id } = req.params;
    await db.query("DELETE FROM chapters WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/curriculum/chapters error:", err);
    res.status(500).json({ error: "Failed to delete chapter" });
  }
}

// --- Topics ---
export async function createTopic(req, res) {
  try {
    const db = getPool();
    const { chapter_id, name, order_num } = req.body;
    if (!chapter_id || !name) return res.status(400).json({ error: "chapter_id and name required" });
    
    const order = order_num || 0;
    const [result] = await db.query(
      "INSERT INTO topics (chapter_id, name, order_num) VALUES (?, ?, ?)",
      [chapter_id, name, order]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("POST /api/curriculum/topics error:", err);
    res.status(500).json({ error: "Failed to create topic" });
  }
}

export async function updateTopic(req, res) {
  try {
    const db = getPool();
    const { id } = req.params;
    const { name, order_num } = req.body;
    
    await db.query(
      "UPDATE topics SET name = ?, order_num = ? WHERE id = ?",
      [name, order_num, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/curriculum/topics error:", err);
    res.status(500).json({ error: "Failed to update topic" });
  }
}

export async function deleteTopic(req, res) {
  try {
    const db = getPool();
    const { id } = req.params;
    await db.query("DELETE FROM topics WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/curriculum/topics error:", err);
    res.status(500).json({ error: "Failed to delete topic" });
  }
}

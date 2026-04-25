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

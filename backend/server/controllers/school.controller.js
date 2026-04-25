import getPool from "../config/db.js";

export async function createSchool(req, res) {
  const db = getPool();
  const { name, code, district, mandal, principalName, principalEmail, principalPassword } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "name and code are required" });
  }
  try {
    const [insSchool] = await db.query(
      "INSERT INTO schools (school_name, school_code, district, mandal) VALUES (?, ?, ?, ?)",
      [String(name).trim(), String(code).trim(), String(district || "").trim(), mandal != null ? String(mandal).trim() : null]
    );
    const schoolId = insSchool.insertId;

    let principalId = null;
    if (principalEmail && principalPassword) {
      const [insPrincipal] = await db.query(
        "INSERT INTO teachers (full_name, email, password, role, school_id) VALUES (?, ?, ?, 'principal', ?)",
        [principalName || "Principal", principalEmail, principalPassword, schoolId]
      );
      principalId = insPrincipal.insertId;
    }

    res.status(201).json({ 
      id: String(schoolId), 
      name: String(name).trim(), 
      code: String(code).trim(), 
      district: String(district || "").trim(), 
      mandal: mandal != null ? String(mandal).trim() : null,
      principal_id: principalId ? String(principalId) : null
    });
  } catch (err) {
    console.error("POST /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function updateSchool(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  const { name, code, district, mandal, sessions_completed, active_status } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push("school_name = ?"); values.push(String(name).trim()); }
    if (code !== undefined) { updates.push("school_code = ?"); values.push(String(code).trim()); }
    if (district !== undefined) { updates.push("district = ?"); values.push(String(district).trim()); }
    if (mandal !== undefined) { updates.push("mandal = ?"); values.push(mandal != null ? String(mandal).trim() : null); }
    if (sessions_completed !== undefined) { updates.push("sessions_completed = ?"); values.push(Number(sessions_completed)); }
    if (active_status !== undefined) { updates.push("active_status = ?"); values.push(active_status ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    await db.query(`UPDATE schools SET ${updates.join(", ")} WHERE id = ?`, values);
    res.json({ id: String(id), updated: true });
  } catch (err) {
    console.error("PUT /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function deleteSchool(req, res) {
  const db = getPool();
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const [r] = await db.query("DELETE FROM schools WHERE id = ?", [id]);
    res.json({ deleted: r.affectedRows > 0 });
  } catch (err) {
    console.error("DELETE /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

export async function getSchools(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT * FROM schools");
    res.json({ schools: rows });
  } catch (err) {
    console.error("GET /api/schools error:", err);
    res.status(500).json({ error: String(err.message) });
  }
}

const fs = require('fs');
const path = require('path');

const codeToAppend = `
export async function updatePrincipalProfile(req, res) {
  try {
    const principalId = req.user.id;
    const db = getPool();
    const { full_name, email, phone, designation, password } = req.body;

    const updates = [];
    const values = [];

    if (full_name !== undefined) { updates.push("full_name = ?"); values.push(full_name); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); }
    if (designation !== undefined) { updates.push("designation = ?"); values.push(designation); }

    if (password) {
      const bcrypt = await import("bcrypt");
      const hashed = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      values.push(hashed);
    }

    if (updates.length > 0) {
      values.push(principalId);
      await db.query("UPDATE teachers SET " + updates.join(", ") + " WHERE id = ? AND role = 'principal'", values);
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("updatePrincipalProfile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
`;

fs.appendFileSync(path.join(__dirname, 'backend', 'server', 'controllers', 'principal.controller.js'), codeToAppend);
console.log("Appended updatePrincipalProfile to principal.controller.js");

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import getPool from "../config/db.js";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key_here";

async function verifyPassword(candidate, storedHashOrPlain) {
  const cand = String(candidate || "");
  const stored = String(storedHashOrPlain || "");
  if (!stored) return false;
  try {
    if (stored.startsWith("$2")) return await bcrypt.compare(cand, stored);
  } catch (_) { }
  return cand === stored;
}

/**
 * Principal Login API
 * POST /api/principal/login
 */
export async function principalLogin(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  const { password } = req.body || {};

  if (!emailTrim || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, email, full_name, school_id, role, password FROM teachers WHERE email = ? AND role = 'principal' LIMIT 1",
      [emailTrim]
    );

    const principal = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (principal) {
      const ok = await verifyPassword(password, principal.password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        {
          id: principal.id,
          email: principal.email,
          full_name: principal.full_name,
          school_id: principal.school_id,
          role: "principal"
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        user: {
          id: String(principal.id),
          email: principal.email,
          full_name: principal.full_name || principal.email,
          school_id: String(principal.school_id),
          role: "principal"
        }
      });
    }
    return res.status(401).json({ error: "Principal not found" });
  } catch (err) {
    console.error("Principal login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
}

/**
 * Teacher Login API
 * POST /api/auth/login/teacher
 */
export async function teacherLogin(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  const { password } = req.body || {};
  if (!emailTrim || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, email, full_name, school_id, role, password FROM teachers WHERE email = ? LIMIT 1",
      [emailTrim]
    );
    const teacher = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (teacher) {
      const ok = await verifyPassword(password, teacher.password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: teacher.id, email: teacher.email, role: teacher.role || "teacher", school_id: teacher.school_id },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        user: {
          id: String(teacher.id),
          email: teacher.email,
          full_name: teacher.full_name || teacher.email,
          school_id: String(teacher.school_id),
          role: teacher.role || "teacher",
        }
      });
    }
    return res.status(401).json({ error: "Teacher not found" });
  } catch (err) {
    console.error("Teacher login error:", err);
    return res.status(500).json({ error: "Teacher login failed" });
  }
}

/**
 * Student Login API
 * POST /api/auth/login/student
 */
export async function studentLogin(req, res) {
  const identifier = req.body?.email != null ? String(req.body.email).trim() : (req.body?.student_id != null ? String(req.body.student_id).trim() : "");
  const { password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: "Email or Student ID and password are required" });
  }
  try {
    const db = getPool();
    let query, params;
    
    if (identifier.includes("@")) {
      query = "SELECT id, first_name, last_name, school_id, password FROM students WHERE email = ? LIMIT 1";
      params = [identifier];
    } else {
      const numericId = parseInt(identifier, 10);
      query = "SELECT id, first_name, last_name, school_id, password FROM students WHERE id = ? OR roll_no = ? LIMIT 1";
      params = [Number.isNaN(numericId) ? -1 : numericId, identifier];
    }

    const [rows] = await db.query(query, params);
    const student = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (student) {
      const ok = await verifyPassword(password, student.password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: student.id, role: "student", school_id: student.school_id },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        user: {
          id: String(student.id),
          full_name: [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || "Student",
          school_id: String(student.school_id),
        }
      });
    }
    return res.status(401).json({ error: "Student not found" });
  } catch (err) {
    console.error("Student login error:", err);
    return res.status(500).json({ error: "Student login failed" });
  }
}

/**
 * Admin Login API (fully dynamic — DB-driven only)
 * POST /api/auth/login
 */
export async function adminLogin(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  const { password } = req.body || {};
  if (!emailTrim || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, email, name, role, permissions, password FROM admins WHERE email = ? LIMIT 1",
      [emailTrim]
    );
    const admin = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!admin) return res.status(401).json({ error: "Admin not found" });

    const ok = await verifyPassword(password, admin.password);
    if (!ok) return res.status(401).json({ error: "Invalid admin credentials" });

    let parsedPermissions = {};
    try {
      if (typeof admin.permissions === 'string') {
        parsedPermissions = JSON.parse(admin.permissions);
      } else if (admin.permissions && typeof admin.permissions === 'object') {
        parsedPermissions = admin.permissions;
      }
    } catch (e) {
      console.warn("Failed to parse admin permissions JSON:", e);
    }

    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: admin.role || "admin",
        permissions: parsedPermissions 
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      token,
      user: {
        id: String(admin.id),
        email: admin.email,
        full_name: admin.name || admin.email,
        role: admin.role || "admin",
        permissions: parsedPermissions
      }
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Admin login failed" });
  }
}

/**
 * Team Login API (department-level team members)
 * POST /api/auth/login/team
 */
export async function teamLogin(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  const { password } = req.body || {};
  if (!emailTrim || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, team_name, email, role, district, password FROM admin_teams WHERE email = ? AND is_active = 1 LIMIT 1",
      [emailTrim]
    );
    const team = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!team) return res.status(401).json({ error: "Team account not found" });

    const ok = await verifyPassword(password, team.password);
    if (!ok) return res.status(401).json({ error: "Invalid team credentials" });

    const token = jwt.sign(
      { id: team.id, email: team.email, role: team.role, district: team.district, type: "team" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      token,
      user: {
        id: String(team.id),
        email: team.email,
        full_name: team.team_name,
        role: team.role,
        district: team.district || null,
        type: "team"
      }
    });
  } catch (err) {
    console.error("Team login error:", err);
    return res.status(500).json({ error: "Team login failed" });
  }
}

/**
 * Forgot Password API
 * POST /api/auth/forgot-password
 */
import { sendPasswordResetEmail } from "../utils/email.js";

export async function forgotPassword(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  if (!emailTrim) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const db = getPool();
    
    // Check if the user exists in admins, teachers, or admin_teams
    let userType = null;
    let userId = null;
    
    // Try admins
    let [rows] = await db.query("SELECT id FROM admins WHERE email = ? LIMIT 1", [emailTrim]);
    if (rows && rows.length > 0) {
      userType = "admin";
      userId = rows[0].id;
    } else {
      // Try teachers/principals
      [rows] = await db.query("SELECT id FROM teachers WHERE email = ? LIMIT 1", [emailTrim]);
      if (rows && rows.length > 0) {
        userType = "teacher";
        userId = rows[0].id;
      } else {
        // Try admin_teams
        [rows] = await db.query("SELECT id FROM admin_teams WHERE email = ? LIMIT 1", [emailTrim]);
        if (rows && rows.length > 0) {
          userType = "team";
          userId = rows[0].id;
        }
      }
    }

    if (!userType) {
      // Return a success message anyway to prevent email enumeration
      return res.json({ message: "If an account with that email exists, we have sent a reset link." });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    
    // Expiration: 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.query(
      "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
      [emailTrim, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(emailTrim)}`;

    const emailSent = await sendPasswordResetEmail(emailTrim, resetUrl);

    if (emailSent) {
      return res.json({ message: "If an account with that email exists, we have sent a reset link." });
    } else {
      return res.status(500).json({ error: "Failed to send password reset email." });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "An error occurred during password reset request." });
  }
}

/**
 * Reset Password API
 * POST /api/auth/reset-password
 */
export async function resetPassword(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  const token = req.body?.token != null ? String(req.body.token).trim() : "";
  const newPassword = req.body?.newPassword != null ? String(req.body.newPassword) : "";

  if (!emailTrim || !token || !newPassword) {
    return res.status(400).json({ error: "Email, token, and new password are required." });
  }

  try {
    const db = getPool();
    
    // Check if token exists and is valid
    const [rows] = await db.query(
      "SELECT id, expires_at FROM password_resets WHERE email = ? AND token = ? LIMIT 1",
      [emailTrim, token]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const resetRecord = rows[0];
    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: "Reset token has expired." });
    }

    // Determine which table the user is in
    let tableToUpdate = null;
    let [userRows] = await db.query("SELECT id FROM admins WHERE email = ? LIMIT 1", [emailTrim]);
    if (userRows && userRows.length > 0) {
      tableToUpdate = "admins";
    } else {
      [userRows] = await db.query("SELECT id FROM teachers WHERE email = ? LIMIT 1", [emailTrim]);
      if (userRows && userRows.length > 0) {
        tableToUpdate = "teachers";
      } else {
        [userRows] = await db.query("SELECT id FROM admin_teams WHERE email = ? LIMIT 1", [emailTrim]);
        if (userRows && userRows.length > 0) {
          tableToUpdate = "admin_teams";
        }
      }
    }

    if (!tableToUpdate) {
      return res.status(400).json({ error: "User account not found." });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.query(`UPDATE ${tableToUpdate} SET password = ? WHERE email = ?`, [hashedPassword, emailTrim]);

    // Delete used token
    await db.query("DELETE FROM password_resets WHERE id = ?", [resetRecord.id]);

    return res.json({ message: "Password has been successfully reset." });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "An error occurred while resetting the password." });
  }
}


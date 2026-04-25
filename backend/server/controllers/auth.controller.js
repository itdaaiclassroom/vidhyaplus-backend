import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
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
  const sid = req.body?.student_id != null ? String(req.body.student_id).trim() : "";
  const { password } = req.body || {};
  if (!sid || !password) {
    return res.status(400).json({ error: "Student ID and password are required" });
  }
  const numericId = parseInt(sid, 10);
  if (Number.isNaN(numericId) || numericId < 1) {
    return res.status(400).json({ error: "Student ID must be a positive number" });
  }
  try {
    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, first_name, last_name, school_id, password FROM students WHERE id = ? OR roll_no = ? LIMIT 1",
      [numericId, sid]
    );
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
 * Admin Login API
 * POST /api/auth/login
 */
export async function adminLogin(req, res) {
  const emailTrim = req.body?.email != null ? String(req.body.email).trim() : "";
  const { password } = req.body || {};
  if (!emailTrim || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Static admins: strict password check
  const STATIC_ADMINS = [
    { email: "admin1@aliet.com", full_name: "Admin 1" },
    { email: "admin2@ghs.com", full_name: "Admin 2" },
    { email: "admin3@zphs.com", full_name: "Admin 3" },
    { email: "admin4@modelschool.com", full_name: "Admin 4" },
    { email: "admin5@residential.com", full_name: "Admin 5" },
  ];

  const staticAdmin = STATIC_ADMINS.find((a) => a.email.toLowerCase() === emailTrim.toLowerCase());
  if (staticAdmin) {
    if (String(password).trim() !== "passadmin123") {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }
    
    const token = jwt.sign(
      { id: "admin-" + staticAdmin.email.replace(/@.*/, ""), email: staticAdmin.email, role: "admin" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      token,
      user: {
        id: "admin-" + staticAdmin.email.replace(/@.*/, ""),
        email: staticAdmin.email,
        full_name: staticAdmin.full_name || staticAdmin.email,
        role: "admin",
      }
    });
  }

  // DB-backed admins
  try {
    const db = getPool();
    const [rows] = await db.query(
      "SELECT id, email, name, role, password FROM admins WHERE email = ? LIMIT 1",
      [emailTrim]
    );
    const admin = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (admin) {
      const ok = await verifyPassword(password, admin.password);
      if (!ok) return res.status(401).json({ error: "Invalid admin credentials" });
      
      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: admin.role || "admin" },
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
        }
      });
    }
    return res.status(401).json({ error: "Admin not found" });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Admin login failed" });
  }
}

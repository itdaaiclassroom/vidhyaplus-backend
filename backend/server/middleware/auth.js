import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key_here";

/**
 * Middleware to authenticate JWT token from headers.
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Bearer <token>

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Forbidden: Invalid token" });
      }

      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: "Unauthorized: Token required" });
  }
}

/**
 * Middleware to authorize based on user role.
 * @param {string|string[]} roles 
 */
export function authorizeRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires ${roles} role` });
    }

    next();
  };
}

/**
 * Legacy Principal authorization middleware (adapted to use JWT if available, else headers).
 */
export async function authorizePrincipal(req, res, next) {
  // If we have a user from JWT and they are a principal, we can skip DB check or supplement it
  if (req.user && req.user.role === 'principal') {
    // Optionally check school_id
    const schoolId = req.headers["x-school-id"] || req.params.schoolId || req.body.school_id;
    if (schoolId && String(req.user.school_id) !== String(schoolId)) {
       return res.status(403).json({ error: "Forbidden: Not authorized for this school" });
    }
    return next();
  }

  // Fallback to old header-based check for backward compatibility during migration
  const principalId = req.headers["x-principal-id"];
  const schoolId = req.headers["x-school-id"] || req.params.schoolId || req.body.school_id;

  if (!principalId || !schoolId) {
    return res.status(401).json({ error: "Unauthorized: Principal ID and School ID required" });
  }

  try {
    const db = await import("../config/db.js").then(m => m.getPool());
    const [rows] = await db.query(
      "SELECT id FROM teachers WHERE id = ? AND school_id = ? AND role = 'principal' LIMIT 1",
      [Number(principalId), Number(schoolId)]
    );
    if (!rows || rows.length === 0) {
      return res.status(403).json({ error: "Forbidden: Not an authorized Principal" });
    }
    next();
  } catch (err) {
    console.error("Authorization check failed:", err);
    res.status(500).json({ error: "Authorization check failed" });
  }
}

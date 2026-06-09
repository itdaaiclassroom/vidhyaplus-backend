import jwt from "jsonwebtoken";
import "dotenv/config";
import { getPool } from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key_here";

/**
 * Middleware to authenticate JWT token from headers.
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Bearer <token>

    jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
      if (err) {
        return res.status(403).json({ error: "Forbidden: Invalid token" });
      }

      try {
        const db = getPool();
        const role = String(decodedUser.role || "").trim().toLowerCase();
        const userId = decodedUser.id;

        if (!userId) {
          return res.status(401).json({ error: "Unauthorized: Invalid token payload" });
        }

        let dbUser = null;

        // Query the database based on user role to fetch real-time data and status
        if (role === "superadmin" || role === "admin") {
          const [rows] = await db.query(
            "SELECT id, role, permissions FROM admins WHERE id = ? LIMIT 1",
            [userId]
          );
          if (rows && rows.length > 0) {
            dbUser = rows[0];
            let parsedPermissions = {};
            try {
              if (typeof dbUser.permissions === "string") {
                parsedPermissions = JSON.parse(dbUser.permissions);
              } else if (dbUser.permissions && typeof dbUser.permissions === "object") {
                parsedPermissions = dbUser.permissions;
              }
            } catch (e) {
              console.warn("Failed to parse admin permissions in JWT verify:", e);
            }
            dbUser.permissions = parsedPermissions;
          }
        } else if (role === "teacher" || role === "principal") {
          const [rows] = await db.query(
            "SELECT id, role, school_id FROM teachers WHERE id = ? LIMIT 1",
            [userId]
          );
          if (rows && rows.length > 0) {
            dbUser = rows[0];
          }
        } else if (role === "student") {
          const [rows] = await db.query(
            "SELECT id, school_id FROM students WHERE id = ? LIMIT 1",
            [userId]
          );
          if (rows && rows.length > 0) {
            dbUser = rows[0];
            dbUser.role = "student";
          }
        } else if (decodedUser.type === "team" || role === "team" || role === "material_management" || role === "school_management" || role === "student_management" || role === "teacher_management") {
          const [rows] = await db.query(
            "SELECT id, role, district, is_active FROM admin_teams WHERE id = ? LIMIT 1",
            [userId]
          );
          if (rows && rows.length > 0) {
            const team = rows[0];
            if (team.is_active === 1) {
              dbUser = team;
            }
          }
        }

        // If user was deleted or deactivated, block immediately
        if (!dbUser) {
          return res.status(401).json({ error: "Unauthorized: User session invalid or account inactive/deleted" });
        }

        // Overwrite token values with dynamic real-time values from the DB
        req.user = {
          ...decodedUser,
          role: dbUser.role || decodedUser.role,
          school_id: dbUser.school_id !== undefined ? dbUser.school_id : decodedUser.school_id,
          permissions: dbUser.permissions !== undefined ? dbUser.permissions : decodedUser.permissions,
          district: dbUser.district !== undefined ? dbUser.district : decodedUser.district
        };

        next();
      } catch (dbErr) {
        console.error("[Auth Middleware] Database verification failed, falling back to token payload:", dbErr);
        req.user = decodedUser;
        next();
      }
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

    const allowedRoles = (Array.isArray(roles) ? roles : [roles]).map(r => String(r).trim().toLowerCase());
    const userRole = String(req.user.role || "").trim().toLowerCase();
    
    console.log(`[Auth] Path: ${req.path}, Required: ${allowedRoles}, Found: ${userRole}`);

    // Admins and Principals are often the same in this context, 
    // but Superadmin and Admin always have super-access.
    if (userRole === "superadmin" || userRole === "admin" || allowedRoles.includes(userRole)) {
      return next();
    }

    console.warn(`[Auth] Forbidden! User role '${userRole}' does not match required roles: ${allowedRoles}`);
    return res.status(403).json({ 
      error: `Forbidden: Requires ${roles} role`, 
      found: userRole 
    });
  };
}

/**
 * Middleware to enforce granular feature permissions for Admins (Admin Teams).
 * Superadmins (role: "superadmin" or "admin" with full access) bypass this.
 * @param {string} feature The feature key (e.g. 'students', 'teachers')
 * @param {'read'|'write'} requiredLevel The required access level
 */
export function requirePermission(feature, requiredLevel = 'read') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRole = String(req.user.role || "").trim().toLowerCase();

    // Superadmin bypass
    if (userRole === "superadmin") {
      return next();
    }

    // For regular Admins (Admin Teams)
    if (userRole === "admin" || userRole === "team") {
      const perms = req.user.permissions || {};
      let userLevel = perms[feature] || 'none';

      if (userLevel === 'none') {
        return res.status(403).json({ error: `Forbidden: No access to ${feature}` });
      }

      if (requiredLevel === 'write' && userLevel !== 'write') {
        return res.status(403).json({ error: `Forbidden: Write access required for ${feature}` });
      }

      // If requiredLevel is 'read', 'read' or 'write' userLevel is sufficient
      return next();
    }

    // If not superadmin or admin/team, allow them through.
    // The preceding authorizeRole middleware is responsible for blocking unauthorized non-admin roles.
    return next();
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

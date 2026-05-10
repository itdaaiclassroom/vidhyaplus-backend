/**
 * VidhyaPlus LMS — Global Audit Logger
 * ──────────────────────────────────────────────────────────────────────────
 * Industry-standard centralized audit logging utility.
 *
 * Usage (in any controller, after a successful mutating operation):
 *
 *   import { auditLog, actorFromReq } from "../utils/auditLogger.js";
 *
 *   await auditLog(db, {
 *     ...actorFromReq(req),
 *     action:    "CREATE",           // "CREATE" | "UPDATE" | "DELETE"
 *     entity:    "teacher",          // resource type: teacher, school, admin, team, subject, section, student ...
 *     entity_id: String(newId),      // PK of the affected row
 *     meta:      { full_name, email }, // sanitized payload — passwords are auto-stripped
 *     req,                           // pass the Express request for IP/user-agent
 *   });
 *
 * Design principles:
 *   • Non-blocking  — never throws; a failed log write NEVER breaks the parent request.
 *   • Auto-sanitize — strips password / token fields from `meta` before persisting.
 *   • Zero-overhead — fire-and-forget; the caller does NOT need to await it in most cases,
 *     but awaiting is safe and recommended so logs are written before tests assert.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Sensitive field names to strip from meta before saving. */
const SENSITIVE_KEYS = new Set([
  "password", "password_hash", "hashed_password",
  "new_password", "old_password", "confirm_password",
  "token", "access_token", "refresh_token", "secret",
]);

/**
 * Recursively strips sensitive keys from an object so they are never
 * persisted to the audit log.
 * @param {Record<string, any>} obj
 * @returns {Record<string, any>}
 */
function sanitizeMeta(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMeta);

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
      clean[k] = "[REDACTED]";
    } else if (v && typeof v === "object") {
      clean[k] = sanitizeMeta(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Extract actor information (id, role, name) from an Express request's
 * JWT payload. Falls back to safe defaults when called from unauthenticated
 * routes (e.g., school routes that have no auth middleware).
 *
 * @param {import("express").Request} req
 * @returns {{ actor_id: string, actor_role: string, actor_name: string }}
 */
export function actorFromReq(req) {
  const user = req?.user ?? {};
  return {
    actor_id:   String(user.id   || "system"),
    actor_role: String(user.role || "unknown"),
    actor_name: String(user.full_name || user.name || user.email || "system"),
  };
}

/**
 * Write a single audit log entry to the `audit_logs` table.
 *
 * @param {import("mysql2/promise").Pool} db   - Active mysql2 pool/connection
 * @param {object} opts
 * @param {string}  opts.actor_id    - ID of the user performing the action
 * @param {string}  opts.actor_role  - Role of the user (admin|principal|teacher|team|system)
 * @param {string}  [opts.actor_name] - Display name (optional)
 * @param {"CREATE"|"UPDATE"|"DELETE"} opts.action - CRUD verb
 * @param {string}  opts.entity      - Resource type (e.g. "teacher", "school")
 * @param {string}  [opts.entity_id] - PK of the affected record
 * @param {object}  [opts.meta={}]   - Additional context / payload diff (passwords auto-stripped)
 * @param {import("express").Request} [opts.req] - Express request (used for IP + user-agent)
 * @param {"success"|"failure"} [opts.status="success"]
 * @param {string|null} [opts.error_msg=null] - Error message when status = "failure"
 * @returns {Promise<void>}
 */
export async function auditLog(db, {
  actor_id   = "system",
  actor_role = "unknown",
  actor_name = null,
  action,
  entity,
  entity_id  = null,
  meta       = {},
  req        = null,
  status     = "success",
  error_msg  = null,
} = {}) {
  // ── Validate required fields ────────────────────────────────────────────
  if (!action || !entity) {
    console.warn("[AuditLog] Skipped: 'action' and 'entity' are required.");
    return;
  }

  // ── Derive IP and User-Agent from the Express request ───────────────────
  let ip_address = null;
  let user_agent = null;
  if (req) {
    ip_address =
      req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    user_agent = req.headers?.["user-agent"] || null;
  }

  // ── Sanitize meta — strip any sensitive fields ───────────────────────────
  const safeMeta = sanitizeMeta(meta);

  // ── Persist to DB — fire-and-forget with full error protection ──────────
  try {
    await db.query(
      `INSERT INTO audit_logs
         (actor_id, actor_role, actor_name, action, entity, entity_id,
          meta, ip_address, user_agent, status, error_msg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(actor_id),
        String(actor_role),
        actor_name ? String(actor_name) : null,
        String(action).toUpperCase(),
        String(entity).toLowerCase(),
        entity_id != null ? String(entity_id) : null,
        safeMeta && Object.keys(safeMeta).length > 0
          ? JSON.stringify(safeMeta)
          : null,
        ip_address,
        user_agent,
        status,
        error_msg,
      ]
    );
  } catch (err) {
    // Logging failures must NEVER bubble up to the caller.
    console.error(
      `[AuditLog] DB write failed for action=${action} entity=${entity}:`,
      err.message
    );
  }
}

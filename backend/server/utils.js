/**
 * Shared utilities for the API server (testable without starting the app).
 */

export function toId(n) {
  return n != null ? String(n) : null;
}

export function isConnectionError(err) {
  const msg = err && (err.message || err.code || "");
  return /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET|connect/i.test(String(msg));
}

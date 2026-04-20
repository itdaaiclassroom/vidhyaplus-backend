/**
 * Run when API is up: confirms health + DB + env hints for live quiz.
 * Usage: npm run verify:live-quiz
 * Or:    node scripts/verify-live-quiz-stack.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/\s+$/, "");
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv();

const apiBase = (process.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

async function fetchJson(path) {
  const r = await fetch(`${apiBase}${path}`, { signal: AbortSignal.timeout(8000) });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { ok: r.ok, status: r.status, body };
}

console.log("\n=== Live quiz stack verification ===\n");
console.log(`API base: ${apiBase}\n`);

let failed = false;

const health = await fetchJson("/api/health").catch((e) => ({ ok: false, status: 0, body: { error: e.message } }));
if (health.ok && health.body?.ok) {
  console.log("[OK] GET /api/health");
} else {
  failed = true;
  console.log("[FAIL] GET /api/health — is the API running?  npm run server");
  console.log("       ", health.body?.error || health.body);
}

const db = await fetchJson("/api/db-check").catch((e) => ({ ok: false, status: 0, body: { error: e.message } }));
if (db.ok && db.body?.ok) {
  console.log("[OK] GET /api/db-check — MySQL reachable");
} else {
  failed = true;
  console.log("[FAIL] GET /api/db-check — fix MYSQL_* in .env or start MySQL");
  console.log("       ", db.body?.error || db.body);
}

const readiness = await fetchJson("/api/live-quiz-readiness").catch((e) => ({ ok: false, status: 0, body: { error: e.message } }));
if (readiness.ok && readiness.body?.ready) {
  console.log("[OK] GET /api/live-quiz-readiness — required schema/migrations present");
} else {
  failed = true;
  console.log("[FAIL] GET /api/live-quiz-readiness — live-quiz schema incomplete");
  if (readiness.status === 404) {
    console.log("       Endpoint not found. Restart backend server so latest API routes are loaded.");
  } else {
    console.log("       ", readiness.body?.error || readiness.body);
  }
}

const qrBase = (process.env.QR_BASE_URL || "").trim();
if (qrBase) {
  console.log(`[OK] QR_BASE_URL is set (phone off-LAN can open scanner URL)`);
} else {
  console.log(`[--] QR_BASE_URL empty — same WiFi: OK; other network: set to ngrok URL + restart API`);
}

console.log(`
=== Your runbook (do in order) ===
1) Terminal A: npm run server   (keep running)
2) Terminal B: npm run dev      (teacher browser)
3) Teacher: Start session → Submit attendance → Launch quiz
4) Teacher: Click "Start quiz capture"
5) Phone: Scan session QR (use tunnel URL if not on LAN)
6) Phone: Scan student QRs (format ROLLNO_B) per question; final submit on phone
7) Teacher: End quiz after "Final submit" shows Done

Filter logs: LIVE_QUIZ_CHECK  (browser + API terminal + phone DevTools remote)

MySQL sanity (optional): run db_quick_health_check.sql in Workbench
`);
console.log(failed ? "\nResult: FIX ITEMS MARKED [FAIL], then run this script again.\n" : "\nResult: Stack ready — run the teacher flow above.\n");

process.exit(failed ? 1 : 0);

/**
 * Unified stack preflight check.
 * Usage: npm run verify:system
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
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 400) }; }
  return { ok: r.ok, status: r.status, body };
}

loadEnv();
const apiBase = (process.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");
console.log("\n=== Unified preflight ===\n");
console.log(`API base: ${apiBase}`);

let failed = false;
try {
  const r = await fetchJson(`${apiBase}/api/preflight`);
  const rep = r.body?.report || {};
  if (r.ok && r.body?.ok) {
    console.log("[OK] API, DB, and live-quiz schema are ready (AI features disabled in this build).");
  } else {
    failed = true;
    if (r.status === 404) {
      console.log("[FAIL] /api/preflight not found. Restart backend server to load latest routes.");
      console.log("\nResult: not ready.\n");
      process.exit(1);
    }
    console.log("[FAIL] Preflight failed:");
    console.log(`       api=${!!rep.api?.ok}, db=${!!rep.db?.ok}, liveQuiz=${!!rep.liveQuiz?.ok}, ai=${!!rep.ai?.ok}`);
    if (rep.db?.error) console.log(`       db error: ${rep.db.error}`);
    if (rep.ai?.error) console.log(`       ai error: ${rep.ai.error} (${rep.ai.base || "n/a"})`);
    if (rep.liveQuiz?.checks) {
      console.log(`       checks: ${JSON.stringify(rep.liveQuiz.checks)}`);
    }
  }
} catch (e) {
  failed = true;
  console.log("[FAIL] Could not call /api/preflight");
  console.log("       ", e instanceof Error ? e.message : String(e));
}

console.log(failed ? "\nResult: not ready.\n" : "\nResult: system ready.\n");
process.exit(failed ? 1 : 0);

/**
 * Demo build: AI chat and Python AI service are disabled.
 * Verifies the main Node API preflight (DB + live-quiz schema) and stub /recommend.
 * Usage: npm run verify:ai
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

async function tryFetch(url, options) {
  try {
    const r = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
  }
}

loadEnv();
const port = (process.env.PORT || "3001").trim();
const bases = Array.from(
  new Set(
    [
      (process.env.VITE_API_URL || "").trim().replace(/\/$/, ""),
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ].filter(Boolean)
  )
);

console.log("\n=== API verification (AI features disabled in this build) ===\n");

let apiBase = "";
for (const b of bases) {
  const pre = await tryFetch(`${b}/api/preflight`);
  if (pre.ok && pre.body?.ok) {
    apiBase = b;
    break;
  }
}

if (!apiBase) {
  console.log("[FAIL] /api/preflight not OK. Start the backend (npm run server) and ensure DB + migrations.");
  process.exit(1);
}
console.log(`[OK] /api/preflight at ${apiBase}`);

const reco = await tryFetch(`${apiBase}/recommend`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ topic: "demo", subject: "demo", grade: 10 }),
});
if (!reco.ok) {
  console.log("[FAIL] POST /recommend failed");
  process.exit(1);
}
if (!reco.body?.disabled) {
  console.log("[WARN] /recommend did not return disabled:true (expected for demo build)");
}
console.log("[OK] POST /recommend stub reachable");
console.log("\nResult: main API ready (no external AI service required).\n");

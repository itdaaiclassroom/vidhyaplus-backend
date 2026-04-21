/**
 * Sets `topics.status` from chapter `macro_month_label` (grade 10):
 * - June–December → completed (demo / “syllabus done so far”)
 * - January / February → not_started (“yet to complete”)
 * Unknown month → completed (same as UI default: treat as in-scope).
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const SYLLABUS_MONTH_ORDER = {
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  january: 13,
  february: 14,
};

function chapterMonthOrder(monthLabel) {
  if (monthLabel == null || String(monthLabel).trim() === "") return null;
  const raw = String(monthLabel).trim().toLowerCase();
  const tokens = raw.split(/[-/\s]+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  return SYLLABUS_MONTH_ORDER[last] ?? null;
}

function isThroughDecember(monthLabel) {
  const ord = chapterMonthOrder(monthLabel);
  if (ord === null) return true;
  return ord <= SYLLABUS_MONTH_ORDER.december;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
  });

  const [rows] = await db.query(
    "SELECT id, chapter_name, macro_month_label FROM chapters WHERE grade_id = 10"
  );

  let done = 0;
  let pending = 0;

  for (const ch of rows) {
    const status = isThroughDecember(ch.macro_month_label) ? "completed" : "not_started";
    const [r] = await db.query("UPDATE topics SET status = ? WHERE chapter_id = ?", [status, ch.id]);
    const n = r.affectedRows || 0;
    if (status === "completed") done += n;
    else pending += n;
  }

  await db.end();
  console.log(`Updated grade-10 topic rows: ~${done} set completed (June–Dec), ~${pending} set not_started (Jan/Feb).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

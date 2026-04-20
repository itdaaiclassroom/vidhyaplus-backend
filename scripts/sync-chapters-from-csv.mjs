import "dotenv/config";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => (v === "NULL" ? null : v));
}

function normMonth(m) {
  return String(m || "").trim().toLowerCase();
}

const MONTH_ORDER = {
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

function isWithinCutoff(monthLabel, cutoffMonth) {
  const m = normMonth(monthLabel);
  const c = normMonth(cutoffMonth);
  const normalized = m.replace(/\s+/g, "");
  const monthParts = normalized.split("-").filter(Boolean);
  const resolvedMonth = monthParts.length > 1 ? monthParts[monthParts.length - 1] : normalized;
  const mv = MONTH_ORDER[resolvedMonth];
  const cv = MONTH_ORDER[c];
  if (!mv || !cv) return false;
  return mv <= cv;
}

async function main() {
  const csvPath = process.argv[2];
  const cutoffMonth = process.argv[3] || "january";
  if (!csvPath) {
    throw new Error("Usage: node scripts/sync-chapters-from-csv.mjs <absolute_csv_path> [cutoffMonth]");
  }

  const csv = await fs.readFile(csvPath, "utf8");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const header = parseCsvLine(lines[0]).map((h) => String(h || "").trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const needed = [
    "subject_id",
    "grade_id",
    "chapter_no",
    "chapter_name",
    "macro_month_label",
    "macro_week_range",
    "planned_periods",
    "teaching_plan_summary",
  ];
  for (const col of needed) {
    if (!(col in idx)) throw new Error(`Missing required CSV column: ${col}`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const gradeId = Number(cols[idx.grade_id]);
    if (gradeId !== 10) continue;
    const month = cols[idx.macro_month_label];
    if (!isWithinCutoff(month, cutoffMonth)) continue;
    rows.push({
      subject_id: Number(cols[idx.subject_id]),
      grade_id: gradeId,
      chapter_no: Number(cols[idx.chapter_no]),
      chapter_name: String(cols[idx.chapter_name] || "").trim(),
      macro_month_label: String(cols[idx.macro_month_label] || "").trim(),
      macro_week_range: String(cols[idx.macro_week_range] || "").trim(),
      planned_periods: Number(cols[idx.planned_periods] || 0),
      teaching_plan_summary: cols[idx.teaching_plan_summary] == null ? null : String(cols[idx.teaching_plan_summary]).trim(),
    });
  }

  if (rows.length === 0) throw new Error("No grade 10 rows up to January found in CSV");

  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
  });

  await db.beginTransaction();
  try {
    // 1) Remove lessons beyond cutoff month from grade 10.
    const [grade10Rows] = await db.query(
      `SELECT id, macro_month_label
       FROM chapters
       WHERE grade_id = 10`
    );
    for (const r of grade10Rows) {
      if (!isWithinCutoff(r.macro_month_label, cutoffMonth)) {
        await db.query("DELETE FROM chapters WHERE id = ?", [Number(r.id)]);
      }
    }

    // 2) Upsert all CSV rows up to January by natural key (subject+grade+chapter_no).
    for (const r of rows) {
      const [exist] = await db.query(
        `SELECT id FROM chapters
         WHERE subject_id = ? AND grade_id = ? AND chapter_no = ?
         LIMIT 1`,
        [r.subject_id, r.grade_id, r.chapter_no]
      );
      const id = Array.isArray(exist) && exist[0] ? Number(exist[0].id) : null;
      if (id) {
        await db.query(
          `UPDATE chapters
           SET chapter_name = ?,
               macro_month_label = ?,
               macro_week_range = ?,
               planned_periods = ?,
               teaching_plan_summary = ?
           WHERE id = ?`,
          [
            r.chapter_name,
            r.macro_month_label,
            r.macro_week_range,
            r.planned_periods,
            r.teaching_plan_summary,
            id,
          ]
        );
      } else {
        await db.query(
          `INSERT INTO chapters
           (subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.subject_id,
            r.grade_id,
            r.chapter_no,
            r.chapter_name,
            r.macro_month_label,
            r.macro_week_range,
            r.planned_periods,
            r.teaching_plan_summary,
          ]
        );
      }
    }

    await db.commit();

    const [counts] = await db.query(
      `SELECT subject_id, COUNT(*) AS total
       FROM chapters
       WHERE grade_id = 10
       GROUP BY subject_id
       ORDER BY subject_id`
    );
    console.log(`Chapter sync complete (up to ${cutoffMonth}).`);
    console.log(counts);
  } catch (err) {
    await db.rollback();
    throw err;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

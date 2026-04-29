import fs from 'fs';

const filePath = 'c:/Users/bhara/Desktop/Projects/Ims-Project/vidhyaplus-backend/backend/server/controllers/principal.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldFunction = `export async function getSchoolTeachers(req, res) {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) return res.status(400).json({ error: "school id required" });
  const db = getPool();
  try {
    const [rows] = await db.query(\`
      SELECT t.id, t.full_name, t.email, t.role,
             GROUP_CONCAT(ts.subject_id SEPARATOR ',') as subject_ids
      FROM teachers t
      LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
      WHERE t.school_id = ?
      GROUP BY t.id
      ORDER BY t.id DESC
    \`, [schoolId]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/principals/teachers error:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
}`;

const newFunction = `export async function getSchoolTeachers(req, res) {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) return res.status(400).json({ error: "school id required" });
  const db = getPool();
  try {
    const [rows] = await db.query(\`
      SELECT t.id, t.full_name, t.email, t.role,
             t.assigned_subject_ids, t.assigned_class_ids, t.assigned_section_ids,
             GROUP_CONCAT(ts.subject_id SEPARATOR ',') as subject_ids
      FROM teachers t
      LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
      WHERE t.school_id = ?
      GROUP BY t.id
      ORDER BY t.id DESC
    \`, [schoolId]);

    // Fetch all subjects for name resolution
    const [allSubjects] = await db.query("SELECT id, subject_name FROM subjects");
    const subjectMap = {};
    (allSubjects || []).forEach(s => { subjectMap[s.id] = s.subject_name; });

    const teachers = rows.map(r => {
      // Merge subjects from both teacher_subjects table AND assigned_subject_ids JSON column
      const subjectIdSet = new Set();
      // From teacher_subjects table
      if (r.subject_ids) {
        r.subject_ids.split(',').filter(Boolean).forEach(id => subjectIdSet.add(Number(id)));
      }
      // From JSON column
      let jsonSubjectIds = r.assigned_subject_ids;
      if (typeof jsonSubjectIds === 'string') {
        try { jsonSubjectIds = JSON.parse(jsonSubjectIds); } catch (_) { jsonSubjectIds = []; }
      }
      if (Array.isArray(jsonSubjectIds)) {
        jsonSubjectIds.forEach(id => subjectIdSet.add(Number(id)));
      }

      const subjects = Array.from(subjectIdSet).map(id => subjectMap[id]).filter(Boolean);

      return {
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        role: r.role,
        subject_ids: r.subject_ids,
        assigned_subject_ids: jsonSubjectIds || [],
        assigned_class_ids: r.assigned_class_ids || [],
        assigned_section_ids: r.assigned_section_ids || [],
        subjects
      };
    });

    res.json(teachers);
  } catch (err) {
    console.error("GET /api/principals/teachers error:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
}`;

// Normalize line endings for matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOld = oldFunction.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOld)) {
  const result = normalizedContent.replace(normalizedOld, newFunction.replace(/\r\n/g, '\n'));
  // Restore original line endings
  fs.writeFileSync(filePath, result.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✅ Successfully replaced getSchoolTeachers function');
} else {
  console.log('❌ Could not find the old function text');
  // Debug: find the function start
  const idx = normalizedContent.indexOf('export async function getSchoolTeachers');
  console.log('Function starts at char index:', idx);
  if (idx >= 0) {
    console.log('Found text (first 500 chars):');
    console.log(JSON.stringify(normalizedContent.substring(idx, idx + 500)));
  }
}

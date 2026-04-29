import fs from 'fs';

const filePath = 'c:/Users/bhara/Desktop/Projects/Ims-Project/vidhyaplus-backend/backend/server/controllers/principal.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

// I'll replace the whole getSchoolTeachers function again with class resolution
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

    // Fetch all sections for class name resolution
    const [allSections] = await db.query("SELECT id, grade_id, section_code FROM sections WHERE school_id = ?", [schoolId]);
    const sectionMap = {};
    (allSections || []).forEach(sec => { 
      sectionMap[sec.id] = \`Class \${sec.grade_id}-\${sec.section_code}\`; 
    });

    const teachers = rows.map(r => {
      // Merge subjects from both sources
      const subjectIdSet = new Set();
      if (r.subject_ids) {
        r.subject_ids.split(',').filter(Boolean).forEach(id => subjectIdSet.add(Number(id)));
      }
      let jsonSubjectIds = r.assigned_subject_ids;
      if (typeof jsonSubjectIds === 'string') {
        try { jsonSubjectIds = JSON.parse(jsonSubjectIds); } catch (_) { jsonSubjectIds = []; }
      }
      if (Array.isArray(jsonSubjectIds)) {
        jsonSubjectIds.forEach(id => subjectIdSet.add(Number(id)));
      }
      const subjects = Array.from(subjectIdSet).map(id => subjectMap[id]).filter(Boolean);

      // Resolve class names from assigned_section_ids (or assigned_class_ids)
      let sectionIds = r.assigned_section_ids;
      if (typeof sectionIds === 'string') {
        try { sectionIds = JSON.parse(sectionIds); } catch (_) { sectionIds = []; }
      }
      if (!Array.isArray(sectionIds)) sectionIds = [];
      
      const classNames = sectionIds.map(id => sectionMap[id]).filter(Boolean);

      return {
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        role: r.role,
        subject_ids: r.subject_ids,
        assigned_subject_ids: jsonSubjectIds || [],
        assigned_class_ids: r.assigned_class_ids || [],
        assigned_section_ids: sectionIds || [],
        subjects,
        class_names: classNames
      };
    });

    res.json(teachers);
  } catch (err) {
    console.error("GET /api/principals/teachers error:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
}`;

// Use a regex to find the existing getSchoolTeachers function and replace it
// Since I just updated it, I'll match the start and end of it.
const funcStart = 'export async function getSchoolTeachers';
const startIdx = content.indexOf(funcStart);
if (startIdx >= 0) {
  // Find the closing brace of the function. It ends before "// ── Subjects CRUD"
  const endIdx = content.indexOf('// ── Subjects CRUD');
  if (endIdx > startIdx) {
    const head = content.substring(0, startIdx);
    const tail = content.substring(endIdx);
    const result = head + newFunction + '\n\n' + tail;
    fs.writeFileSync(filePath, result.replace(/\n/g, '\r\n'), 'utf8');
    console.log('✅ Successfully updated getSchoolTeachers with class resolution');
  } else {
    console.log('❌ Could not find end of function');
  }
} else {
  console.log('❌ Could not find start of function');
}

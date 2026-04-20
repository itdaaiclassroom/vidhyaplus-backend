import "dotenv/config";
import mysql from "mysql2/promise";

function localDateYmd(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateYmd(d);
}

function dayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getDay(); // 0 Sun .. 6 Sat
}

async function main() {
  const db = await mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
    waitForConnections: true,
    connectionLimit: 10,
  });

  // 1) Timetable table
  await db.query(`
    CREATE TABLE IF NOT EXISTS class_timetables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT UNSIGNED NOT NULL,
      week_day TINYINT NOT NULL,
      period_no TINYINT NOT NULL,
      subject_name VARCHAR(64) NOT NULL,
      subject_id INT UNSIGNED NULL,
      teacher_id INT UNSIGNED NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_class_day_period (class_id, week_day, period_no),
      CONSTRAINT fk_timetable_class FOREIGN KEY (class_id) REFERENCES sections(id) ON DELETE CASCADE,
      CONSTRAINT fk_timetable_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      CONSTRAINT fk_timetable_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    )
  `);

  // 2) Ensure Grade 10 sections A/B/C/D exist per school that already has grade 10
  const [grade10Schools] = await db.query(`
    SELECT DISTINCT school_id
    FROM sections
    WHERE grade_id = 10
  `);
  for (const row of grade10Schools) {
    for (const sec of ["A", "B", "C", "D"]) {
      await db.query(
        `INSERT INTO sections (school_id, grade_id, section_code)
         SELECT ?, 10, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM sections WHERE school_id = ? AND grade_id = 10 AND section_code = ?
         )`,
        [row.school_id, sec, row.school_id, sec]
      );
    }
  }

  // 3) Build teacher map by school + subject (teacher of 10-A subject handles B/C/D too)
  const [teachers] = await db.query("SELECT id, school_id, subject_id FROM teachers WHERE subject_id IS NOT NULL");
  const teacherBySchoolSubject = new Map();
  for (const t of teachers) {
    teacherBySchoolSubject.set(`${t.school_id}:${t.subject_id}`, t.id);
  }
  const [subjects] = await db.query("SELECT id, subject_name FROM subjects");
  const subjectIdByName = new Map(subjects.map((s) => [String(s.subject_name).toLowerCase(), s.id]));

  // 4) Seed class_timetables for all grade-10 sections
  const [classes] = await db.query("SELECT id, school_id, section_code FROM sections WHERE grade_id = 10 ORDER BY school_id, section_code");
  const periodTimes = [
    ["09:00:00", "09:40:00"],
    ["09:40:00", "10:20:00"],
    ["10:35:00", "11:15:00"],
    ["11:15:00", "11:55:00"],
    ["13:00:00", "13:40:00"],
    ["13:40:00", "14:20:00"],
    ["14:35:00", "15:15:00"],
    ["15:15:00", "15:55:00"],
  ];
  const orderedSubjects = ["Telugu", "Hindi", "English", "Mathematics", "Physics", "Biology", "Social Studies", "Games"];
  for (const cls of classes) {
    for (let wd = 1; wd <= 6; wd++) {
      const shift = (wd - 1) % orderedSubjects.length;
      const daySubjects = orderedSubjects.map((_, idx) => orderedSubjects[(idx + shift) % orderedSubjects.length]);
      for (let p = 1; p <= 8; p++) {
        const subjName = daySubjects[p - 1];
        const subjectId = subjectIdByName.get(subjName.toLowerCase()) || null;
        const teacherId = subjectId ? (teacherBySchoolSubject.get(`${cls.school_id}:${subjectId}`) || null) : null;
        const [st, et] = periodTimes[p - 1];
        await db.query(
          `INSERT INTO class_timetables (class_id, week_day, period_no, subject_name, subject_id, teacher_id, start_time, end_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             subject_name = VALUES(subject_name),
             subject_id = VALUES(subject_id),
             teacher_id = VALUES(teacher_id),
             start_time = VALUES(start_time),
             end_time = VALUES(end_time)`,
          [cls.id, wd, p, subjName, subjectId, teacherId, st, et]
        );
      }
    }
  }

  // 5) Seed attendance/live sessions/marks up to Feb (idempotent scoped data)
  // SEED_FEB_RESET_ATTENDANCE=1 — delete all grade-10 attendance in Jan–Feb then re-insert (destructive).
  // Without it — keep existing rows; attendance uses INSERT IGNORE (respects uq_attendance_student_class_date).
  const start = "2026-01-01";
  const end = "2026-02-28";
  const resetFebAttendance = process.env.SEED_FEB_RESET_ATTENDANCE === "1";
  const [grade10ClassRows] = await db.query("SELECT id, school_id FROM sections WHERE grade_id = 10");
  const classIds = grade10ClassRows.map((c) => c.id);
  if (classIds.length) {
    if (resetFebAttendance) {
      await db.query(
        `DELETE a FROM attendance a
         JOIN sections s ON s.id = a.class_id
         WHERE s.grade_id = 10 AND a.date BETWEEN ? AND ?`,
        [start, end]
      );
    }
    await db.query(
      `DELETE FROM live_sessions
       WHERE topic_name LIKE '[SEEDED] %' AND session_date BETWEEN ? AND ?`,
      [start, end]
    );
    await db.query(
      `DELETE FROM student_marks
       WHERE assessment_type = 'seeded_feb' AND assessed_on BETWEEN ? AND ?`,
      [start, end]
    );
  }

  const [students] = await db.query("SELECT id, section_id FROM students WHERE section_id IN (SELECT id FROM sections WHERE grade_id = 10)");
  const studentsByClass = new Map();
  for (const s of students) {
    const arr = studentsByClass.get(s.section_id) || [];
    arr.push(s.id);
    studentsByClass.set(s.section_id, arr);
  }
  const [chapters] = await db.query("SELECT id, grade_id, subject_id FROM chapters WHERE grade_id = 10");
  const chaptersBySubject = new Map();
  for (const ch of chapters) {
    const arr = chaptersBySubject.get(ch.subject_id) || [];
    arr.push(ch.id);
    chaptersBySubject.set(ch.subject_id, arr);
  }

  let d = start;
  while (d <= end) {
    const dow = dayOfWeek(d);
    if (dow !== 0) {
      for (const cls of grade10ClassRows) {
        const studentIds = studentsByClass.get(cls.id) || [];
        if (!studentIds.length) continue;
        // attendance 90% present
        for (const sid of studentIds) {
          const present = (sid + dow) % 10 !== 0;
          const status = present ? "present" : "absent";
          if (resetFebAttendance) {
            await db.query("INSERT INTO attendance (student_id, class_id, date, status) VALUES (?, ?, ?, ?)", [
              sid,
              cls.id,
              d,
              status,
            ]);
          } else {
            await db.query(
              "INSERT IGNORE INTO attendance (student_id, class_id, date, status) VALUES (?, ?, ?, ?)",
              [sid, cls.id, d, status]
            );
          }
        }
        // one seeded live session per weekday
        const subCycle = ["telugu", "hindi", "english", "mathematics", "physics", "biology", "social studies"];
        const subName = subCycle[(dow - 1) % subCycle.length];
        const subjectId = subjectIdByName.get(subName) || null;
        const teacherId = subjectId ? (teacherBySchoolSubject.get(`${cls.school_id}:${subjectId}`) || null) : null;
        let chapterId = null;
        if (subjectId) {
          const chs = chaptersBySubject.get(subjectId) || [];
          chapterId = chs.length ? chs[(new Date(`${d}T00:00:00`).getDate() - 1) % chs.length] : null;
        }
        await db.query(
          `INSERT INTO live_sessions
            (teacher_id, class_id, subject_id, chapter_id, topic_id, topic_name, start_time, session_date, status, attendance_marked, quiz_submitted)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'ended', 1, 1)`,
          [teacherId || 1, cls.id, subjectId, chapterId, `[SEEDED] ${subName} class`, `${d} 09:00:00`, d]
        );
      }
    }
    d = addDays(d, 1);
  }

  // seeded marks once per student/chapter up to Feb
  for (const s of students) {
    for (const ch of chapters) {
      const score = 4 + ((s.id + ch.id) % 7); // 4..10
      const total = 10;
      const day = String(((s.id + ch.id) % 27) + 1).padStart(2, "0");
      const date = `2026-02-${day}`;
      await db.query(
        "INSERT INTO student_marks (student_id, chapter_id, assessment_type, score, total, assessed_on) VALUES (?, ?, 'seeded_feb', ?, ?, ?)",
        [s.id, ch.id, score, total, date]
      );
    }
  }

  // 5b) Mark grade-10 syllabus progression as completed (up to Feb backfill target).
  await db.query(
    `UPDATE topics t
     JOIN chapters c ON c.id = t.chapter_id
     SET t.status = 'completed'
     WHERE c.grade_id = 10`
  ).catch(() => {});

  // 6) Co-curricular activity seed (Feb)
  await db.query("DELETE ap FROM activity_participation ap JOIN activity_assignments aa ON aa.id = ap.activity_assignment_id JOIN activities a ON a.id = aa.activity_id WHERE a.title LIKE '[SEEDED] %'").catch(() => {});
  await db.query("DELETE aa FROM activity_assignments aa JOIN activities a ON a.id = aa.activity_id WHERE a.title LIKE '[SEEDED] %'").catch(() => {});
  await db.query("DELETE FROM activities WHERE title LIKE '[SEEDED] %'").catch(() => {});
  const [admins] = await db.query("SELECT id FROM admins ORDER BY id LIMIT 1");
  const adminId = admins?.[0]?.id || 1;
  const [insAct] = await db.query(
    "INSERT INTO activities (admin_id, title, description) VALUES (?, ?, ?)",
    [adminId, "[SEEDED] Sports Meet", "Inter-section games and sports events (seeded up to February)"]
  );
  const activityId = insAct.insertId;
  for (const cls of grade10ClassRows) {
    const anyTeacher = teachers.find((t) => Number(t.school_id) === Number(cls.school_id));
    if (!anyTeacher) continue;
    const [insAsg] = await db.query(
      "INSERT INTO activity_assignments (activity_id, teacher_id, class_id, assigned_by_admin_id, activity_date, status, assigned_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)",
      [activityId, anyTeacher.id, cls.id, adminId, "2026-02-21", "completed", "2026-02-21 11:30:00"]
    );
    const assignId = insAsg.insertId;
    const studentIds = studentsByClass.get(cls.id) || [];
    for (const sid of studentIds.slice(0, Math.min(studentIds.length, 15))) {
      await db.query(
        "INSERT INTO activity_participation (activity_assignment_id, student_id, status) VALUES (?, ?, 'participated')",
        [assignId, sid]
      );
    }
  }

  await db.end();
  console.log("Seed complete: timetables + Jan-Feb attendance/marks/sessions + co-curricular.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

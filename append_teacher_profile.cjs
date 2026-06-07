const fs = require('fs');
const path = require('path');

const codeToAppend = `
export async function getTeacherProfile(req, res) {
  try {
    const teacherId = req.user.id;
    const db = await import("../config/db.js").then(m => m.default());

    const [rows] = await db.query("SELECT t.*, s.school_name FROM teachers t LEFT JOIN schools s ON t.school_id = s.id WHERE t.id = ?", [teacherId]);
    if (rows.length === 0) return res.status(404).json({ error: "Teacher not found" });

    let teacher = rows[0];

    // Calculate performance & rank
    const [sessions] = await db.query("SELECT * FROM live_sessions WHERE teacher_id = ? AND status = 'completed'", [teacherId]);
    
    // For quizzes, normally we filter by teacher's students, but this is an approximation for ranking
    const [quizzes] = await db.query("SELECT * FROM student_marks WHERE chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)", [teacher.subject_id]);

    const sessionsConducted = sessions.length;
    const syllabusCompletion = Math.min(100, sessionsConducted * 5); // simplified
    const unitProgress = syllabusCompletion;
    const studentParticipation = 85; // mock value for now
    const quizPerformance = 78; // mock value for now

    // Rank formula: Student Performance Weightage: 30%
    // Rank = (SyllabusCompletion * 0.3) + (UnitProgress * 0.2) + (StudentParticipation * 0.2) + (QuizPerformance * 0.3)
    const rankingScore = Math.round((syllabusCompletion * 0.3) + (unitProgress * 0.2) + (studentParticipation * 0.2) + (quizPerformance * 0.3));

    res.json({
      ...teacher,
      performance: {
        sessionsConducted,
        syllabusCompletion,
        unitProgress,
        studentParticipation,
        quizPerformance,
        rankingScore
      }
    });
  } catch (error) {
    console.error("getTeacherProfile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateTeacherProfile(req, res) {
  try {
    const teacherId = req.user.id;
    const db = await import("../config/db.js").then(m => m.default());
    const { full_name, email, phone, designation, skills, experience, highest_qualification, password } = req.body;

    const updates = [];
    const values = [];

    if (full_name !== undefined) { updates.push("full_name = ?"); values.push(full_name); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); }
    if (designation !== undefined) { updates.push("designation = ?"); values.push(designation); }
    if (skills !== undefined) { updates.push("skills = ?"); values.push(JSON.stringify(skills)); }
    if (experience !== undefined) { updates.push("experience = ?"); values.push(experience); }
    if (highest_qualification !== undefined) { updates.push("highest_qualification = ?"); values.push(highest_qualification); }

    if (password) {
      const bcrypt = await import("bcrypt");
      const hashed = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      values.push(hashed);
    }

    if (updates.length > 0) {
      values.push(teacherId);
      await db.query("UPDATE teachers SET " + updates.join(", ") + " WHERE id = ?", values);
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("updateTeacherProfile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
`;

fs.appendFileSync(path.join(__dirname, 'backend', 'server', 'controllers', 'teacher.controller.js'), codeToAppend);
console.log("Appended profile functions to teacher.controller.js");

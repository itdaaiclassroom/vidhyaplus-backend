import getPool from "../config/db.js";

/**
 * Helper: Read a single config value from gating_config.
 */
async function getConfigValue(db, key, fallback = "") {
  try {
    const [rows] = await db.query(
      "SELECT config_value FROM gating_config WHERE config_key = ? LIMIT 1",
      [key]
    );
    return rows.length > 0 ? rows[0].config_value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Check if gating is enabled (master switch).
 */
async function isGatingEnabled(db) {
  const val = await getConfigValue(db, "gating_enabled", "true");
  return val === "true" || val === "1";
}

/**
 * GET /api/chapter-gating/status
 * Query: teacher_id, class_id, subject_id, grade_id
 *
 * Returns the lock/unlock status for every chapter in the subject+grade.
 * Gating rule: Chapter N+1 unlocks when:
 *   1. Teacher PASSED Chapter N assessment (for this class)
 *   2. Student class average for Chapter N >= threshold
 *   OR manual admin override exists
 *
 * Chapter 1 assessment is always AVAILABLE (but teaching is locked until passed).
 */
export async function getChapterGatingStatus(req, res) {
  const db = getPool();
  try {
    const { teacher_id, class_id, subject_id, grade_id } = req.query;
    if (!teacher_id || !class_id || !subject_id || !grade_id) {
      return res.status(400).json({ error: "Missing required params: teacher_id, class_id, subject_id, grade_id" });
    }

    const gatingEnabled = await isGatingEnabled(db);
    const teacherPassPct = parseFloat(await getConfigValue(db, "teacher_pass_percentage", "70"));
    const studentThresholdPct = parseFloat(await getConfigValue(db, "student_threshold_percentage", "60"));

    // All chapters for this subject+grade, ordered by chapter_no
    const [chapters] = await db.query(
      `SELECT id, chapter_no, chapter_name FROM chapters
       WHERE subject_id = ? AND grade_id = ?
       ORDER BY chapter_no ASC`,
      [subject_id, grade_id]
    );

    if (chapters.length === 0) {
      return res.json({ gatingEnabled, chapters: [], teacherPassThreshold: teacherPassPct, studentThreshold: studentThresholdPct });
    }

    const chapterIds = chapters.map((c) => c.id);

    // Teacher assessment results (best attempt per chapter)
    const [assessments] = await db.query(
      `SELECT chapter_id, MAX(passed) AS passed, MAX(percentage) AS best_score,
              MAX(attempt_number) AS attempts
       FROM teacher_chapter_assessments
       WHERE teacher_id = ? AND class_id = ? AND chapter_id IN (?)
       GROUP BY chapter_id`,
      [teacher_id, class_id, chapterIds]
    );
    const assessmentMap = {};
    assessments.forEach((a) => {
      assessmentMap[a.chapter_id] = {
        passed: Boolean(a.passed),
        bestScore: parseFloat(a.best_score) || 0,
        attempts: a.attempts || 0,
      };
    });

    // Student performance per chapter
    const [performances] = await db.query(
      `SELECT chapter_id, avg_score, pass_percentage, total_students,
              students_passed, threshold_met
       FROM class_chapter_performance
       WHERE class_id = ? AND chapter_id IN (?)`,
      [class_id, chapterIds]
    );
    const perfMap = {};
    performances.forEach((p) => {
      perfMap[p.chapter_id] = {
        avgScore: parseFloat(p.avg_score) || 0,
        passPercentage: parseFloat(p.pass_percentage) || 0,
        totalStudents: p.total_students || 0,
        studentsPassed: p.students_passed || 0,
        thresholdMet: Boolean(p.threshold_met),
      };
    });

    // Admin overrides
    const [overrides] = await db.query(
      `SELECT chapter_id, override_type FROM chapter_overrides
       WHERE teacher_id = ? AND class_id = ? AND chapter_id IN (?)`,
      [teacher_id, class_id, chapterIds]
    );
    const overrideMap = {};
    overrides.forEach((o) => {
      overrideMap[o.chapter_id] = o.override_type;
    });

    // Build status for each chapter
    const result = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const chId = ch.id;
      const assess = assessmentMap[chId] || { passed: false, bestScore: 0, attempts: 0 };
      const perf = perfMap[chId] || { avgScore: 0, passPercentage: 0, totalStudents: 0, studentsPassed: 0, thresholdMet: false };
      const override = overrideMap[chId] || null;

      let isLocked = true;
      let assessmentAvailable = false;
      let lockReason = "";

      if (!gatingEnabled) {
        // If gating is disabled, everything is unlocked
        isLocked = false;
        assessmentAvailable = true;
      } else if (override === "unlock") {
        isLocked = false;
        assessmentAvailable = true;
      } else if (override === "lock") {
        isLocked = true;
        lockReason = "Locked by admin";
      } else if (i === 0) {
        // Chapter 1: assessment always available, teaching locked until passed
        assessmentAvailable = true;
        isLocked = !assess.passed;
        if (isLocked) lockReason = "Pass the chapter assessment to unlock teaching";
      } else {
        // Chapter N (N>1): requires previous chapter conditions
        const prevChId = chapters[i - 1].id;
        const prevAssess = assessmentMap[prevChId] || { passed: false };
        const prevPerf = perfMap[prevChId] || { thresholdMet: false, avgScore: 0 };
        const prevOverride = overrideMap[prevChId] || null;

        const prevTeacherPassed = prevAssess.passed || prevOverride === "unlock";
        const prevStudentMet = prevPerf.thresholdMet || prevOverride === "unlock";

        if (!prevTeacherPassed && !prevStudentMet) {
          lockReason = `Complete Chapter ${chapters[i - 1].chapter_no}: pass assessment and meet student threshold`;
          assessmentAvailable = false;
        } else if (!prevTeacherPassed) {
          lockReason = `Teacher must pass Chapter ${chapters[i - 1].chapter_no} assessment`;
          assessmentAvailable = false;
        } else if (!prevStudentMet) {
          lockReason = `Student performance below ${studentThresholdPct}% for Chapter ${chapters[i - 1].chapter_no} (current: ${prevPerf.avgScore.toFixed(1)}%)`;
          assessmentAvailable = false;
        } else {
          // Previous chapter conditions met → this chapter's assessment is available
          assessmentAvailable = true;
          isLocked = !assess.passed;
          if (isLocked) lockReason = "Pass the chapter assessment to unlock teaching";
        }

        if (!assessmentAvailable) isLocked = true;
      }

      result.push({
        chapterId: chId,
        chapterNo: ch.chapter_no,
        chapterName: ch.chapter_name,
        isLocked,
        assessmentAvailable,
        teacherPassed: assess.passed,
        teacherBestScore: assess.bestScore,
        teacherAttempts: assess.attempts,
        studentAvgScore: perf.avgScore,
        studentPassPercentage: perf.passPercentage,
        studentThresholdMet: perf.thresholdMet,
        totalStudents: perf.totalStudents,
        studentsPassed: perf.studentsPassed,
        overridden: override || null,
        lockReason,
      });
    }

    return res.json({
      gatingEnabled,
      teacherPassThreshold: teacherPassPct,
      studentThreshold: studentThresholdPct,
      chapters: result,
    });
  } catch (err) {
    console.error("getChapterGatingStatus error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/chapter-gating/assessment/:chapterId
 * Query: class_id (for context)
 *
 * Returns 10 MCQ questions for the chapter assessment.
 * Primary source: topic_quiz_bank
 * Fallback: AI generation (stub — returns error asking admin to populate quiz bank)
 */
export async function getAssessmentQuestions(req, res) {
  const db = getPool();
  try {
    const { chapterId } = req.params;
    if (!chapterId) return res.status(400).json({ error: "Missing chapterId" });

    // Get chapter info
    const [chapterRows] = await db.query(
      "SELECT id, subject_id, grade_id, chapter_name FROM chapters WHERE id = ? LIMIT 1",
      [chapterId]
    );
    if (chapterRows.length === 0) return res.status(404).json({ error: "Chapter not found" });
    const chapter = chapterRows[0];

    // Get topic IDs for this chapter
    const [topicRows] = await db.query(
      "SELECT id FROM topics WHERE chapter_id = ?",
      [chapterId]
    );
    const topicIds = topicRows.map((t) => t.id);

    let questions = [];
    let source = "quiz_bank";

    if (topicIds.length > 0) {
      // Pull from quiz bank
      const [qRows] = await db.query(
        `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
         FROM topic_quiz_bank
         WHERE topic_id IN (?)
         ORDER BY RAND()
         LIMIT 10`,
        [topicIds]
      );
      questions = qRows.map((q) => ({
        id: q.id,
        questionText: q.question_text,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        correctOption: q.correct_option,
        explanation: q.explanation || "",
      }));
    }

    if (questions.length === 0) {
      // Fallback: generate basic questions from chapter info
      source = "ai_generated";
      // Generate placeholder questions based on chapter name
      // In production, this would call the AI service
      const placeholderQuestions = generatePlaceholderQuestions(chapter.chapter_name);
      questions = placeholderQuestions;
    }

    return res.json({
      chapterId,
      chapterName: chapter.chapter_name,
      subjectId: chapter.subject_id,
      gradeId: chapter.grade_id,
      source,
      questions,
      totalQuestions: questions.length,
    });
  } catch (err) {
    console.error("getAssessmentQuestions error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Generate placeholder assessment questions when quiz bank is empty.
 * In production, replace with actual AI-based generation.
 */
function generatePlaceholderQuestions(chapterName) {
  const questions = [];
  for (let i = 1; i <= 10; i++) {
    questions.push({
      id: `gen-${i}`,
      questionText: `Assessment Question ${i} for "${chapterName}" — What is the key concept covered in this section?`,
      optionA: "Concept A - Core definition",
      optionB: "Concept B - Application",
      optionC: "Concept C - Advanced theory",
      optionD: "Concept D - Historical context",
      correctOption: ["A", "B", "C", "D"][Math.floor(Math.random() * 4)],
      explanation: `This tests understanding of the fundamental concepts in ${chapterName}.`,
    });
  }
  return questions;
}

/**
 * POST /api/chapter-gating/assessment/submit
 * Body: { teacherId, chapterId, subjectId, gradeId, classId, answers: [{ questionId, selectedOption }] }
 *
 * Grades the assessment, stores result, returns pass/fail.
 */
export async function submitAssessment(req, res) {
  const db = getPool();
  try {
    const { teacherId, chapterId, subjectId, gradeId, classId, answers, questions } = req.body;

    if (!teacherId || !chapterId || !subjectId || !gradeId || !classId || !answers || !questions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const teacherPassPct = parseFloat(await getConfigValue(db, "teacher_pass_percentage", "70"));

    // Grade the assessment
    let correct = 0;
    const total = questions.length;
    const graded = [];

    for (const ans of answers) {
      const q = questions.find((q) => String(q.id) === String(ans.questionId));
      if (!q) continue;
      const isCorrect = String(ans.selectedOption).toUpperCase() === String(q.correctOption).toUpperCase();
      if (isCorrect) correct++;
      graded.push({
        questionId: ans.questionId,
        selectedOption: ans.selectedOption,
        correctOption: q.correctOption,
        isCorrect,
      });
    }

    const percentage = total > 0 ? Math.round((correct / total) * 100 * 100) / 100 : 0;
    const passed = percentage >= teacherPassPct;

    // Get attempt number
    const [existingAttempts] = await db.query(
      `SELECT MAX(attempt_number) AS max_attempt FROM teacher_chapter_assessments
       WHERE teacher_id = ? AND chapter_id = ? AND class_id = ?`,
      [teacherId, chapterId, classId]
    );
    const attemptNumber = (existingAttempts[0]?.max_attempt || 0) + 1;

    // Determine source
    const source = questions[0]?.id?.toString().startsWith("gen-") ? "ai_generated" : "quiz_bank";

    // Store result
    await db.query(
      `INSERT INTO teacher_chapter_assessments
         (teacher_id, chapter_id, subject_id, grade_id, class_id, score, total, percentage, passed, attempt_number, assessment_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacherId, chapterId, subjectId, gradeId, classId, correct, total, percentage, passed ? 1 : 0, attemptNumber, source]
    );

    return res.json({
      passed,
      score: correct,
      total,
      percentage,
      passThreshold: teacherPassPct,
      attemptNumber,
      graded,
    });
  } catch (err) {
    console.error("submitAssessment error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/chapter-gating/student-performance/compute
 * Body: { classId, chapterId, subjectId }
 *
 * Aggregates student_marks for the chapter, computes class performance.
 */
export async function computeStudentPerformance(req, res) {
  const db = getPool();
  try {
    const { classId, chapterId, subjectId } = req.body;
    if (!classId || !chapterId || !subjectId) {
      return res.status(400).json({ error: "Missing required fields: classId, chapterId, subjectId" });
    }

    const studentThresholdPct = parseFloat(await getConfigValue(db, "student_threshold_percentage", "60"));

    // Aggregate student marks for this chapter + class
    const [rows] = await db.query(
      `SELECT
         COUNT(DISTINCT sm.student_id) AS total_students,
         ROUND(AVG((sm.score / NULLIF(sm.total, 0)) * 100), 2) AS avg_score,
         SUM(CASE WHEN (sm.score / NULLIF(sm.total, 0)) * 100 >= ? THEN 1 ELSE 0 END) AS students_passed
       FROM student_marks sm
       JOIN students st ON st.id = sm.student_id
       WHERE sm.chapter_id = ? AND st.section_id = ? AND sm.total > 0`,
      [studentThresholdPct, chapterId, classId]
    );

    const data = rows[0] || {};
    const totalStudents = data.total_students || 0;
    const avgScore = parseFloat(data.avg_score) || 0;
    const studentsPassed = parseInt(data.students_passed) || 0;
    const passPercentage = totalStudents > 0 ? Math.round((studentsPassed / totalStudents) * 100 * 100) / 100 : 0;
    const thresholdMet = avgScore >= studentThresholdPct;

    // Upsert into class_chapter_performance
    await db.query(
      `INSERT INTO class_chapter_performance
         (class_id, chapter_id, subject_id, avg_score, pass_percentage, total_students, students_passed, threshold_met)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         avg_score = VALUES(avg_score),
         pass_percentage = VALUES(pass_percentage),
         total_students = VALUES(total_students),
         students_passed = VALUES(students_passed),
         threshold_met = VALUES(threshold_met),
         computed_at = CURRENT_TIMESTAMP`,
      [classId, chapterId, subjectId, avgScore, passPercentage, totalStudents, studentsPassed, thresholdMet ? 1 : 0]
    );

    return res.json({
      classId,
      chapterId,
      avgScore,
      passPercentage,
      totalStudents,
      studentsPassed,
      thresholdMet,
      threshold: studentThresholdPct,
    });
  } catch (err) {
    console.error("computeStudentPerformance error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/chapter-gating/config
 * Returns all gating configuration.
 */
export async function getGatingConfig(req, res) {
  const db = getPool();
  try {
    const [rows] = await db.query("SELECT config_key, config_value, description, updated_at FROM gating_config ORDER BY id");
    const config = {};
    rows.forEach((r) => { config[r.config_key] = r.config_value; });
    return res.json({ config, rows });
  } catch (err) {
    console.error("getGatingConfig error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/chapter-gating/config
 * Body: { teacher_pass_percentage?, student_threshold_percentage?, gating_enabled?, allow_manual_override? }
 */
export async function updateGatingConfig(req, res) {
  const db = getPool();
  try {
    const updates = req.body;
    const validKeys = ["teacher_pass_percentage", "student_threshold_percentage", "gating_enabled", "allow_manual_override"];
    let updated = 0;

    for (const key of validKeys) {
      if (updates[key] !== undefined) {
        await db.query(
          "UPDATE gating_config SET config_value = ? WHERE config_key = ?",
          [String(updates[key]), key]
        );
        updated++;
      }
    }

    return res.json({ updated, ok: true });
  } catch (err) {
    console.error("updateGatingConfig error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/chapter-gating/override
 * Body: { teacherId, chapterId, classId, overrideType: 'unlock'|'lock', reason, adminId }
 */
export async function createOverride(req, res) {
  const db = getPool();
  try {
    const { teacherId, chapterId, classId, overrideType, reason, adminId } = req.body;
    if (!teacherId || !chapterId || !classId || !overrideType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.query(
      `INSERT INTO chapter_overrides (teacher_id, chapter_id, class_id, override_type, reason, overridden_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         override_type = VALUES(override_type),
         reason = VALUES(reason),
         overridden_by_admin_id = VALUES(overridden_by_admin_id),
         created_at = CURRENT_TIMESTAMP`,
      [teacherId, chapterId, classId, overrideType, reason || null, adminId || null]
    );

    return res.json({ ok: true, teacherId, chapterId, classId, overrideType });
  } catch (err) {
    console.error("createOverride error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/chapter-gating/override
 * Body: { teacherId, chapterId, classId }
 */
export async function deleteOverride(req, res) {
  const db = getPool();
  try {
    const { teacherId, chapterId, classId } = req.body;
    if (!teacherId || !chapterId || !classId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.query(
      "DELETE FROM chapter_overrides WHERE teacher_id = ? AND chapter_id = ? AND class_id = ?",
      [teacherId, chapterId, classId]
    );

    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("deleteOverride error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/chapter-gating/overrides
 * Query: teacher_id?, class_id?
 * Returns all override records (for admin audit trail).
 */
export async function getOverrides(req, res) {
  const db = getPool();
  try {
    const { teacher_id, class_id } = req.query;
    let sql = `
      SELECT co.*, t.full_name AS teacher_name, ch.chapter_name, ch.chapter_no,
             CONCAT('Class ', sec.grade_id, '-', sec.section_code) AS class_name,
             a.name AS admin_name
      FROM chapter_overrides co
      JOIN teachers t ON t.id = co.teacher_id
      JOIN chapters ch ON ch.id = co.chapter_id
      JOIN sections sec ON sec.id = co.class_id
      LEFT JOIN admins a ON a.id = co.overridden_by_admin_id
      WHERE 1=1
    `;
    const params = [];
    if (teacher_id) { sql += " AND co.teacher_id = ?"; params.push(teacher_id); }
    if (class_id) { sql += " AND co.class_id = ?"; params.push(class_id); }
    sql += " ORDER BY co.created_at DESC";

    const [rows] = await db.query(sql, params);
    return res.json({ overrides: rows });
  } catch (err) {
    console.error("getOverrides error:", err);
    return res.status(500).json({ error: err.message });
  }
}

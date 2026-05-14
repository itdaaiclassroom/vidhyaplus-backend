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

    // Teacher assessment results (best attempt per chapter across all their classes)
    const [assessments] = await db.query(
      `SELECT chapter_id, MAX(passed) AS passed, MAX(percentage) AS best_score,
              MAX(attempt_number) AS attempts
       FROM teacher_chapter_assessments
       WHERE teacher_id = ? AND chapter_id IN (?)
       GROUP BY chapter_id`,
      [teacher_id, chapterIds]
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

    // Read per-chapter assessment settings first, then fall back to global config
    let questionCount, totalMarks, passingMarks;
    try {
      const [chapterCfg] = await db.query(
        "SELECT question_count, total_marks, passing_marks FROM chapter_assessment_config WHERE chapter_id = ? LIMIT 1",
        [chapterId]
      );
      if (chapterCfg.length > 0) {
        questionCount = chapterCfg[0].question_count;
        totalMarks = chapterCfg[0].total_marks;
        passingMarks = chapterCfg[0].passing_marks;
      }
    } catch (_) { /* table may not exist yet */ }
    // Fall back to global config
    if (!questionCount) questionCount = parseInt(await getConfigValue(db, "assessment_question_count", "10")) || 10;
    if (!totalMarks) totalMarks = parseInt(await getConfigValue(db, "assessment_total_marks", "100")) || 100;
    
    const teacherPassPct = parseFloat(await getConfigValue(db, "teacher_pass_percentage", "70"));
    if (!passingMarks) {
      passingMarks = (teacherPassPct / 100) * totalMarks;
    }

    // Get chapter info
    const [chapterRows] = await db.query(
      "SELECT id, subject_id, grade_id, chapter_name FROM chapters WHERE id = ? LIMIT 1",
      [chapterId]
    );
    if (chapterRows.length === 0) return res.status(404).json({ error: "Chapter not found" });
    const chapter = chapterRows[0];

    // Get topic names for this chapter for better placeholder questions
    const [topicRows] = await db.query(
      "SELECT id, name FROM topics WHERE chapter_id = ?",
      [chapterId]
    );
    const topics = topicRows.map((t) => ({ id: t.id, name: t.name }));
    const topicIds = topics.map(t => t.id);

    let questions = [];
    let source = "quiz_bank";

    if (topicIds.length > 0) {
      // Pull from quiz bank — use admin-configured question count
      const [qRows] = await db.query(
        `SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
         FROM topic_quiz_bank
         WHERE topic_id IN (?)
         ORDER BY RAND()
         LIMIT ?`,
        [topicIds, questionCount]
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
      // Fallback: generate questions from topic names
      source = "ai_generated";
      questions = generatePlaceholderQuestions(chapter.chapter_name, topics.map(t => t.name), questionCount);
    }

    return res.json({
      chapterId,
      chapterName: chapter.chapter_name,
      subjectId: chapter.subject_id,
      gradeId: chapter.grade_id,
      source,
      questions,
      totalQuestions: questions.length,
      totalMarks,
      passingMarks,
      questionCount,
    });
  } catch (err) {
    console.error("getAssessmentQuestions error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Generate smarter placeholder assessment questions using topic names.
 */
function generatePlaceholderQuestions(chapterName, topicNames = [], count = 10) {
  const questions = [];
  
  for (let i = 1; i <= count; i++) {
    // Pick a topic to focus on for this question if available
    const topic = topicNames.length > 0 ? topicNames[(i - 1) % topicNames.length] : null;
    
    const questionText = topic 
      ? `Regarding the topic "${topic}" in ${chapterName}, which of these statements best describes its primary significance?`
      : `Assessment Question ${i} for "${chapterName}" — Which fundamental principle is most essential to this chapter?`;

    // Vary the options a bit based on the index
    const options = [
      { text: topic ? `It defines the core characteristics of ${topic}.` : "Fundamental theory and basic definitions.", key: "A" },
      { text: topic ? `It explains the relationship between ${topic} and the wider ecosystem.` : "Practical application in real-world scenarios.", key: "B" },
      { text: topic ? `It identifies the historical development of ${topic} concepts.` : "Advanced theoretical frameworks and analysis.", key: "C" },
      { text: topic ? `It compares ${topic} with other related features in the chapter.` : "Historical context and evolutionary changes.", key: "D" }
    ];

    questions.push({
      id: `gen-${i}`,
      questionText,
      optionA: options[0].text,
      optionB: options[1].text,
      optionC: options[2].text,
      optionD: options[3].text,
      correctOption: ["A", "B", "C", "D"][Math.floor(Math.random() * 4)],
      explanation: `This question evaluates your understanding of the essential details in ${topic || chapterName}.`,
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

    // Read per-chapter assessment settings first, then fall back to global config
    let totalMarks, passingMarks;
    try {
      const [chapterCfg] = await db.query(
        "SELECT total_marks, passing_marks FROM chapter_assessment_config WHERE chapter_id = ? LIMIT 1",
        [chapterId]
      );
      if (chapterCfg.length > 0) {
        totalMarks = chapterCfg[0].total_marks;
        passingMarks = chapterCfg[0].passing_marks;
      }
    } catch (_) { /* table may not exist yet */ }
    // Fall back to global config
    if (!totalMarks) totalMarks = parseInt(await getConfigValue(db, "assessment_total_marks", "100")) || 100;
    
    // Prioritize teacher_pass_percentage (calculated against totalMarks) over the static assessment_passing_marks
    const teacherPassPct = parseFloat(await getConfigValue(db, "teacher_pass_percentage", "70"));
    if (!passingMarks) {
      passingMarks = (teacherPassPct / 100) * totalMarks;
    }

    // Grade the assessment
    let correct = 0;
    const totalQuestions = questions.length;
    const graded = [];

    for (const ans of answers) {
      const q = questions.find((q) => String(q.id) === String(ans.questionId));
      if (!q) continue;
      const isCorrect = String(ans.selectedOption).toUpperCase() === String(q.correctOption).toUpperCase();
      if (isCorrect) correct++;
      graded.push({
        questionId: ans.questionId,
        questionText: q.questionText,
        selectedOption: ans.selectedOption,
        correctOption: q.correctOption,
        isCorrect,
      });
    }

    // Calculate scored marks proportional to totalMarks
    const marksPerQuestion = totalQuestions > 0 ? totalMarks / totalQuestions : 0;
    const scoredMarks = Math.round(correct * marksPerQuestion * 100) / 100;
    const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100 * 100) / 100 : 0;
    const passed = scoredMarks >= passingMarks;

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
         (teacher_id, chapter_id, subject_id, grade_id, class_id, score, total, passing_marks, percentage, passed, attempt_number, assessment_source, graded_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacherId, chapterId, subjectId, gradeId, classId, correct, totalQuestions, Math.round(passingMarks), percentage, passed ? 1 : 0, attemptNumber, source, JSON.stringify(graded)]
    );

    return res.json({
      passed,
      score: correct,
      total: totalQuestions,
      scoredMarks,
      totalMarks,
      passingMarks,
      percentage,
      passThreshold: passingMarks,
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
    // We group by student first to get their individual chapter average,
    // then aggregate those averages to get class performance.
    const [rows] = await db.query(
      `SELECT 
         COUNT(*) as total_students,
         AVG(student_avg) as avg_score,
         SUM(CASE WHEN student_avg >= ? THEN 1 ELSE 0 END) as students_passed
       FROM (
         SELECT 
           sm.student_id,
           AVG((sm.score / NULLIF(sm.total, 0)) * 100) as student_avg
         FROM student_marks sm
         JOIN students st ON st.id = sm.student_id
         WHERE sm.chapter_id = ? AND st.section_id = ? AND sm.total > 0
         GROUP BY sm.student_id
       ) AS student_summaries`,
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
    const validKeys = ["teacher_pass_percentage", "student_threshold_percentage", "gating_enabled", "allow_manual_override", "assessment_question_count", "assessment_total_marks", "assessment_passing_marks"];
    let updated = 0;

    for (const key of validKeys) {
      if (updates[key] !== undefined) {
        let value = String(updates[key]);
        
        await db.query(
          "UPDATE gating_config SET config_value = ? WHERE config_key = ?",
          [value, key]
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
 * GET /api/chapter-gating/chapter-config/:subjectId
 * Returns per-chapter assessment config for all chapters in a subject.
 */
export async function getChapterAssessmentConfig(req, res) {
  const db = getPool();
  try {
    const { subjectId } = req.params;
    if (!subjectId) return res.status(400).json({ error: "Missing subjectId" });

    // Get global defaults
    const globalQuestionCount = parseInt(await getConfigValue(db, "assessment_question_count", "10")) || 10;
    const globalTotalMarks = parseInt(await getConfigValue(db, "assessment_total_marks", "100")) || 100;
    const globalPassingMarks = parseInt(await getConfigValue(db, "assessment_passing_marks", "70")) || 70;

    // Get all chapters for this subject
    const [chapters] = await db.query(
      "SELECT id, chapter_name, chapter_no, grade_id FROM chapters WHERE subject_id = ? ORDER BY grade_id, chapter_no",
      [subjectId]
    );

    // Get per-chapter configs
    const chapterIds = chapters.map(c => c.id);
    let configMap = {};
    if (chapterIds.length > 0) {
      try {
        const [configs] = await db.query(
          "SELECT chapter_id, question_count, total_marks, passing_marks FROM chapter_assessment_config WHERE chapter_id IN (?)",
          [chapterIds]
        );
        for (const cfg of configs) {
          configMap[cfg.chapter_id] = cfg;
        }
      } catch (_) { /* table may not exist yet */ }
    }

    const result = chapters.map(ch => ({
      chapterId: ch.id,
      chapterName: ch.chapter_name,
      chapterOrder: ch.chapter_no,
      gradeId: ch.grade_id,
      questionCount: configMap[ch.id]?.question_count ?? globalQuestionCount,
      totalMarks: configMap[ch.id]?.total_marks ?? globalTotalMarks,
      passingMarks: configMap[ch.id]?.passing_marks ?? globalPassingMarks,
      isCustom: !!configMap[ch.id],
    }));

    return res.json({
      subjectId,
      globalDefaults: { questionCount: globalQuestionCount, totalMarks: globalTotalMarks, passingMarks: globalPassingMarks },
      chapters: result,
    });
  } catch (err) {
    console.error("getChapterAssessmentConfig error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/chapter-gating/chapter-config/:chapterId
 * Body: { questionCount, totalMarks, passingMarks }
 * Upserts per-chapter assessment config.
 */
export async function upsertChapterAssessmentConfig(req, res) {
  const db = getPool();
  try {
    const { chapterId } = req.params;
    const { questionCount, totalMarks, passingMarks } = req.body;

    if (!chapterId) return res.status(400).json({ error: "Missing chapterId" });

    const qCount = parseInt(questionCount);
    const tMarks = parseInt(totalMarks);
    const pMarks = parseInt(passingMarks);

    if (!qCount || qCount < 1 || qCount > 50) return res.status(400).json({ error: "questionCount must be 1-50" });
    if (!tMarks || tMarks < 1) return res.status(400).json({ error: "totalMarks must be > 0" });
    if (!pMarks || pMarks < 1) return res.status(400).json({ error: "passingMarks must be > 0" });

    await db.query(
      `INSERT INTO chapter_assessment_config (chapter_id, question_count, total_marks, passing_marks)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE question_count = VALUES(question_count), total_marks = VALUES(total_marks), passing_marks = VALUES(passing_marks)`,
      [chapterId, qCount, tMarks, pMarks]
    );

    return res.json({ ok: true, chapterId, questionCount: qCount, totalMarks: tMarks, passingMarks: pMarks });
  } catch (err) {
    console.error("upsertChapterAssessmentConfig error:", err);
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

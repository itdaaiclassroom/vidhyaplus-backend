import getPool from "../config/db.js";

export async function getStudentBaseDetails(studentId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT s.id, s.first_name, s.last_name, s.roll_no, s.school_id, 
            sec.section_code, sec.grade_id, sch.school_name
     FROM students s
     LEFT JOIN sections sec ON s.section_id = sec.id
     LEFT JOIN schools sch ON s.school_id = sch.id
     WHERE s.id = ? LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

export async function getAcademicPerformance(studentId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT m.*, sub.subject_name
     FROM student_exam_marks m
     LEFT JOIN subjects sub ON m.subject_id = sub.id
     WHERE m.student_id = ?`,
    [studentId]
  );
  return rows;
}

export async function getAttendanceSummary(studentId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT 
       COUNT(*) as total_days,
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as total_present
     FROM attendance WHERE student_id = ?`,
    [studentId]
  );

  const total = rows[0]?.total_days || 0;
  const present = rows[0]?.total_present || 0;
  const percentage = total > 0 ? (present / total) * 100 : 0;

  return {
    totalDays: total,
    totalPresent: present,
    percentage: parseFloat(percentage.toFixed(2))
  };
}

export async function getBehaviorAssessment(studentId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT * FROM student_behavior_assessments 
     WHERE student_id = ? 
     ORDER BY created_at DESC LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

export async function getPerformanceSummary(studentId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT * FROM student_performance_summary WHERE student_id = ? LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

export async function saveBehaviorAssessment(studentId, data) {
  const db = getPool();
  const { teacher_id, academic_year, communication_score, leadership_score, teamwork_score, participation_score, creativity_score, confidence_score, discipline_score, remarks } = data;

  await db.query(
    `INSERT INTO student_behavior_assessments 
      (student_id, teacher_id, academic_year, communication_score, leadership_score, teamwork_score, participation_score, creativity_score, confidence_score, discipline_score, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, teacher_id, academic_year || '2024-25', communication_score, leadership_score, teamwork_score, participation_score, creativity_score, confidence_score, discipline_score, remarks || '']
  );
}

export async function generateRuleBasedFindings(studentId) {
  const attendance = await getAttendanceSummary(studentId);
  const performance = await getAcademicPerformance(studentId);
  const behavior = await getBehaviorAssessment(studentId);

  let rulesFindings = [];

  if (attendance.percentage < 75) rulesFindings.push("Low Attendance (<75%)");
  else if (attendance.percentage > 95) rulesFindings.push("Excellent Attendance (>95%)");

  // Calculate average performance
  let totalObtained = 0, totalMax = 0;
  performance.forEach(m => {
    totalObtained += m.marks_obtained;
    totalMax += m.max_marks;
  });

  if (totalMax > 0) {
    const avgScore = (totalObtained / totalMax) * 100;
    if (avgScore > 85) rulesFindings.push("Strong Academic Performance");
    else if (avgScore < 50) rulesFindings.push("Needs significant academic improvement");
  }

  if (behavior) {
    const avgBehavior = (behavior.communication_score + behavior.leadership_score + behavior.teamwork_score + behavior.participation_score + behavior.creativity_score + behavior.confidence_score + behavior.discipline_score) / 7;
    if (avgBehavior < 3) rulesFindings.push("Needs improvement in behavior and class participation");
    if (behavior.leadership_score >= 4) rulesFindings.push("Shows strong leadership skills");
  }

  return {
    attendance: attendance.percentage,
    academic_metrics: { totalObtained, totalMax },
    behavior_metrics: behavior,
    rule_engine_findings: rulesFindings
  };
}

export async function updatePerformanceSummary(studentId) {
  const db = getPool();

  const academic = await getAcademicPerformance(studentId);
  const attendance = await getAttendanceSummary(studentId);
  const behavior = await getBehaviorAssessment(studentId);

  let totalObtained = 0, totalMax = 0;
  academic.forEach(m => {
    totalObtained += m.marks_obtained;
    totalMax += m.max_marks;
  });

  const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

  let totalWeights = 0;
  let earnedScore = 0;

  if (totalMax > 0) {
    totalWeights += 70;
    earnedScore += (overallPercentage / 100) * 70;
  }

  if (attendance && attendance.totalDays > 0) {
    totalWeights += 20;
    earnedScore += (attendance.percentage / 100) * 20;
  }

  let behaviorScore = 0;
  if (behavior) {
    const avgBehavior = (behavior.communication_score + behavior.leadership_score + behavior.teamwork_score + behavior.participation_score + behavior.creativity_score + behavior.confidence_score + behavior.discipline_score) / 7;
    behaviorScore = (avgBehavior / 5) * 10;
    totalWeights += 10;
    earnedScore += behaviorScore;
  }

  const performanceIndex = totalWeights > 0 ? (earnedScore / totalWeights) * 100 : 0;

  // Basic Grade Logic
  let grade = 'F';
  if (overallPercentage >= 90) grade = 'A+';
  else if (overallPercentage >= 80) grade = 'A';
  else if (overallPercentage >= 70) grade = 'B+';
  else if (overallPercentage >= 60) grade = 'B';
  else if (overallPercentage >= 50) grade = 'C';

  const [existing] = await db.query(
    "SELECT id FROM student_performance_summary WHERE student_id = ? LIMIT 1",
    [studentId]
  );
  if (existing && existing[0]) {
    await db.query(
      `UPDATE student_performance_summary 
       SET overall_percentage = ?, overall_grade = ?, attendance_percentage = ?, performance_index = ? 
       WHERE id = ?`,
      [overallPercentage, grade, attendance.percentage, performanceIndex, existing[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO student_performance_summary 
       (student_id, overall_percentage, overall_grade, attendance_percentage, performance_index) 
       VALUES (?, ?, ?, ?, ?)`,
      [studentId, overallPercentage, grade, attendance.percentage, performanceIndex]
    );
  }

  return true;
}

export async function recalculateClassRanks(classId) {
  // This function will fetch all students in the class, 
  // sort them by overall_percentage or performance_index,
  // and update their class_rank in student_performance_summary.
  const db = getPool();
  // Implementation for class rank recalculation
  // For now, it's a placeholder structure that can be expanded
}

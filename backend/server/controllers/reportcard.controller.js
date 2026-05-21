import * as reportCardService from "../services/reportcard.service.js";
import { generateAIInsights } from "../services/aiInsights.service.js";

export async function getStudentReportCard(req, res) {
  const studentId = Number(req.params.studentId);
  if (!studentId) return res.status(400).json({ error: "studentId is required" });

  try {
    // 1. Fetch all required data
    const baseDetails = await reportCardService.getStudentBaseDetails(studentId);
    if (!baseDetails) return res.status(404).json({ error: "Student not found" });

    const academic = await reportCardService.getAcademicPerformance(studentId);
    const attendance = await reportCardService.getAttendanceSummary(studentId);
    const behavior = await reportCardService.getBehaviorAssessment(studentId);
    
    // Ensure performance summary is updated
    await reportCardService.updatePerformanceSummary(studentId);
    const performanceSummary = await reportCardService.getPerformanceSummary(studentId);

    res.json({
      studentDetails: baseDetails,
      academicPerformance: academic,
      attendance: attendance,
      behavior: behavior,
      performanceSummary: performanceSummary
    });
  } catch (err) {
    console.error("Error in getStudentReportCard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function submitBehaviorAssessment(req, res) {
  const studentId = Number(req.params.studentId);
  const data = req.body;
  if (!studentId) return res.status(400).json({ error: "studentId is required" });
  
  // Basic validation (ideally you check if teacher is authorized to assess this student)
  if (!data.teacher_id) return res.status(400).json({ error: "teacher_id is required" });

  try {
    await reportCardService.saveBehaviorAssessment(studentId, data);
    await reportCardService.updatePerformanceSummary(studentId);
    res.json({ success: true, message: "Behavior assessment saved successfully" });
  } catch (err) {
    console.error("Error in submitBehaviorAssessment:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function generateInsights(req, res) {
  const studentId = Number(req.params.studentId);
  if (!studentId) return res.status(400).json({ error: "studentId is required" });

  try {
    // Step 1: Backend Rule Engine
    const structuredFindings = await reportCardService.generateRuleBasedFindings(studentId);
    
    // Step 2: Send structured findings to AI
    const aiInsights = await generateAIInsights(structuredFindings);
    
    res.json({ success: true, insights: aiInsights });
  } catch (err) {
    console.error("Error in generateInsights:", err);
    res.status(500).json({ error: "Failed to generate AI insights" });
  }
}

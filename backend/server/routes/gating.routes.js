import express from "express";
import {
  getChapterGatingStatus,
  getAssessmentQuestions,
  submitAssessment,
  computeStudentPerformance,
  getGatingConfig,
  updateGatingConfig,
  createOverride,
  deleteOverride,
  getOverrides,
} from "../controllers/gating.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// All gating routes require authentication
router.use(authenticateJWT);

// --- Teacher-facing routes ---
// Get lock/unlock status for all chapters
router.get("/status", getChapterGatingStatus);

// Get assessment questions for a chapter
router.get("/assessment/:chapterId", getAssessmentQuestions);

// Submit teacher assessment answers
router.post("/assessment/submit", submitAssessment);

// Compute student performance for a chapter (called after quiz ends)
router.post("/student-performance/compute", computeStudentPerformance);

// --- Admin-facing routes ---
// Get gating configuration
router.get("/config", getGatingConfig);

// Update gating configuration (admin only)
router.put("/config", authorizeRole(["admin"]), updateGatingConfig);

// Create/update manual override (admin only)
router.post("/override", authorizeRole(["admin"]), createOverride);

// Delete override (admin only)
router.delete("/override", authorizeRole(["admin"]), deleteOverride);

// Get all overrides (admin audit trail)
router.get("/overrides", getOverrides);

export default router;

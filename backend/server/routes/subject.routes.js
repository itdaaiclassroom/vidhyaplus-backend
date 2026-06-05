import express from "express";
import {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectMaterials,
  uploadSubjectMaterial,
  deleteSubjectMaterial,
  // Question Bank
  getQuestionBank,
  getSubjectQuestionBank,
  createSubjectQuestion,
  bulkUploadQuestions,
  updateSubjectQuestion,
  deleteSubjectQuestion,
  getSubjectTopics,
  getQuestionBankMetadata,
  bulkDeleteQuestionsHandler,
  // Curriculum Structure
  bulkUploadCurriculum,
  getCurriculumStructure,
  deleteCurriculumEntry,
  bulkDeleteCurriculumHandler as bulkDeleteCurriculumRoute,
} from "../controllers/subject.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// ── Service-to-Service Auth Middleware ────────────────────────────────────
// Used by the AI Python service to call the question bank without a user JWT.
const serviceKeyAuth = (req, res, next) => {
  const key = req.headers["x-service-key"] || "";
  const expected = process.env.AI_SERVICE_KEY || "";
  if (expected && key === expected) {
    // Attach a synthetic service identity so downstream code doesn't break
    req.user = { id: "ai-service", role: "service" };
    return next();
  }
  return next(); // Fall through to regular JWT auth
};

// ── Question Bank (Static Routes) ─────────────────────────────────────────
// ⚠️ Static paths MUST be registered BEFORE the dynamic /:id routes

// System-wide list (admin/principal can query across all subjects)
// Also accessible by AI service using x-service-key header
router.get(
  "/question-bank",
  serviceKeyAuth,
  (req, res, next) => {
    // If service-key auth passed (req.user set as service), skip JWT
    if (req.user && req.user.role === "service") return next();
    return authenticateJWT(req, res, next);
  },
  (req, res, next) => {
    if (req.user && req.user.role === "service") return next();
    return authorizeRole(["admin", "principal", "teacher", "material_management"])(req, res, next);
  },
  getQuestionBank
);

// Metadata for filters (unique chapters/topics)
router.get(
  "/question-bank/metadata",
  authenticateJWT,
  getQuestionBankMetadata
);

// Global bulk upload (.xlsx / .xls / .csv)
router.post(
  "/question-bank/bulk",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  bulkUploadQuestions
);

// Bulk delete multiple questions or delete all based on filters
router.delete(
  "/question-bank/bulk",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  bulkDeleteQuestionsHandler
);

// Edit a single question
router.put(
  "/question-bank/:qid",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  updateSubjectQuestion
);

// Delete a single question
router.delete(
  "/question-bank/:qid",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  deleteSubjectQuestion
);

// ── Curriculum Structure (static paths BEFORE dynamic /:id routes) ───────

// Excel bulk upload
router.post(
  "/curriculum/bulk",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  bulkUploadCurriculum
);

// Bulk delete (by id list or filters)
router.delete(
  "/curriculum/bulk",
  authenticateJWT,
  authorizeRole(["admin", "material_management"]),
  bulkDeleteCurriculumRoute
);

// Get curriculum list (grouped by chapter)
router.get(
  "/curriculum",
  authenticateJWT,
  authorizeRole(["admin", "principal", "teacher", "material_management"]),
  getCurriculumStructure
);

// Delete single curriculum entry
router.delete(
  "/curriculum/:id",
  authenticateJWT,
  authorizeRole(["admin", "material_management"]),
  deleteCurriculumEntry
);

// ── Subject CRUD ────────────────────────────────────────────────────────
router.get("/", authenticateJWT, getSubjects);
router.post("/", authenticateJWT, authorizeRole(["admin", "principal"]), createSubject);
router.get("/:id", authenticateJWT, getSubject);
router.put("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), updateSubject);
router.delete("/:id", authenticateJWT, authorizeRole(["admin"]), deleteSubject);

// Subject Materials
// GET  — accessible by everyone with a valid JWT (admin, principal, teacher, student, material_management team)
router.get(
  "/:id/materials",
  authenticateJWT,
  authorizeRole(["admin", "principal", "teacher", "student", "material_management"]),
  getSubjectMaterials
);

// POST — admin, principal, and material_management team can upload
router.post(
  "/:id/materials",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  uploadSubjectMaterial
);

// DELETE — admin and material_management team can delete
router.delete(
  "/materials/:id",
  authenticateJWT,
  authorizeRole(["admin", "material_management"]),
  deleteSubjectMaterial
);

// ── Question Bank (Dynamic Routes) ───────────────────────────────────────

// Get topics for a subject
router.get(
  "/:id/topics",
  authenticateJWT,
  getSubjectTopics
);

// Per-subject question list (filterable by chapter & grade)
router.get(
  "/:id/question-bank",
  authenticateJWT,
  authorizeRole(["admin", "principal", "teacher", "material_management"]),
  getSubjectQuestionBank
);


// Single question create
router.post(
  "/:id/question-bank",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  createSubjectQuestion
);

export default router;

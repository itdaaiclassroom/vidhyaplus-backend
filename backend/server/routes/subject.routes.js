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
} from "../controllers/subject.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// ── Question Bank (Static Routes) ─────────────────────────────────────────
// ⚠️ Static paths MUST be registered BEFORE the dynamic /:id routes

// System-wide list (admin/principal can query across all subjects)
router.get(
  "/question-bank",
  authenticateJWT,
  authorizeRole(["admin", "principal", "teacher", "material_management"]),
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

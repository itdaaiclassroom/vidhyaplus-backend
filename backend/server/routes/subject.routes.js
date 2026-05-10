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
  bulkUploadSubjectQuestions,
  updateSubjectQuestion,
  deleteSubjectQuestion,
} from "../controllers/subject.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// Subject CRUD (admin / principal only for write)
router.get("/", authenticateJWT, getSubjects);
router.get("/:id", authenticateJWT, getSubject);
router.post("/", authenticateJWT, authorizeRole(["admin", "principal"]), createSubject);
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

// ── Question Bank ──────────────────────────────────────────────────────────
// ⚠️  Static paths (/question-bank, /question-bank/:qid) MUST be registered
//    BEFORE the dynamic /:id routes so Express does not treat the literal
//    string "question-bank" as a subject ID.

// System-wide list (admin/principal can query across all subjects)
router.get(
  "/question-bank",
  authenticateJWT,
  authorizeRole(["admin", "principal", "teacher", "material_management"]),
  getQuestionBank
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

// Per-subject question list (filterable by chapter & grade)
router.get(
  "/:id/question-bank",
  authenticateJWT,
  authorizeRole(["admin", "principal", "teacher", "material_management"]),
  getSubjectQuestionBank
);

// Bulk upload (.xlsx / .xls / .csv)
router.post(
  "/:id/question-bank/bulk",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  bulkUploadSubjectQuestions
);

// Single question create
router.post(
  "/:id/question-bank",
  authenticateJWT,
  authorizeRole(["admin", "principal", "material_management"]),
  createSubjectQuestion
);

export default router;

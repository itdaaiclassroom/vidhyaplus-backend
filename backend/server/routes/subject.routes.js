import express from "express";
import {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectMaterials,
  uploadSubjectMaterial,
  deleteSubjectMaterial
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

export default router;

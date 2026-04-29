import express from "express";
import { getSubjects, getSubject, createSubject, updateSubject, deleteSubject, getSubjectMaterials, uploadSubjectMaterial, deleteSubjectMaterial } from "../controllers/subject.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateJWT, getSubjects);
router.get("/:id/materials", authenticateJWT, getSubjectMaterials);
router.post("/:id/materials", authenticateJWT, authorizeRole(["admin", "principal"]), uploadSubjectMaterial);
router.delete("/materials/:id", authenticateJWT, authorizeRole(["admin"]), deleteSubjectMaterial);

router.get("/:id", authenticateJWT, getSubject);
router.post("/", authenticateJWT, authorizeRole(["admin", "principal"]), createSubject);
router.put("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), updateSubject);
router.delete("/:id", authenticateJWT, authorizeRole(["admin"]), deleteSubject);

export default router;

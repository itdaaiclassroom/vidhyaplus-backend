import express from "express";
import { getSubjects, getSubject, createSubject, updateSubject, deleteSubject } from "../controllers/subject.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateJWT, getSubjects);
router.get("/:id", authenticateJWT, getSubject);
router.post("/", authenticateJWT, authorizeRole(["admin", "principal"]), createSubject);
router.put("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), updateSubject);
router.delete("/:id", authenticateJWT, authorizeRole(["admin"]), deleteSubject);

export default router;

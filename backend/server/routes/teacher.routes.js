import express from "express";
import { createTeacher, updateTeacher, deleteTeacher, bulkCreateTeachers, getTeacherDashboard } from "../controllers/teacher.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticateJWT, authorizeRole(["admin", "principal"]), createTeacher);
router.post("/bulk", authenticateJWT, authorizeRole(["admin", "principal"]), bulkCreateTeachers);
router.get("/dashboard/:id", authenticateJWT, getTeacherDashboard);
router.put("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), updateTeacher);
router.delete("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), deleteTeacher);
import { createTeacher, updateTeacher, deleteTeacher } from "../controllers/teacher.controller.js";

const router = express.Router();

router.post("/", createTeacher);
router.put("/:id", updateTeacher);
router.delete("/:id", deleteTeacher);

export default router;

import express from "express";
import { createStudent, updateStudent, deleteStudent, getStudentQRCodes, bulkCreateStudents, getStudentDashboard } from "../controllers/student.controller.js";
import { createStudent, updateStudent, deleteStudent, getStudentQRCodes } from "../controllers/student.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticateJWT, createStudent);
router.post("/bulk", authenticateJWT, authorizeRole(["admin", "principal"]), bulkCreateStudents);
router.get("/dashboard/:roll_no", authenticateJWT, getStudentDashboard);
router.put("/:id", authenticateJWT, updateStudent);
router.delete("/:id", authenticateJWT, deleteStudent);
router.get("/:id/qrcodes", authenticateJWT, getStudentQRCodes);
router.post("/", createStudent);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);
router.get("/:id/qrcodes", getStudentQRCodes);

export default router;

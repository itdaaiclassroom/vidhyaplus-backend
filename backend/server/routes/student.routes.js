import express from "express";
import { createStudent, updateStudent, deleteStudent, getStudentQRCodes, bulkCreateStudents, getStudentDashboard, markStudentAttendance, getStudentAttendance, updateStudentAttendance } from "../controllers/student.controller.js";

import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/attendance", authenticateJWT, authorizeRole(["admin", "principal", "teacher"]), markStudentAttendance);
router.get("/attendance", authenticateJWT, getStudentAttendance);
router.put("/attendance/:id", authenticateJWT, authorizeRole(["admin", "principal", "teacher"]), updateStudentAttendance);

router.post("/", authenticateJWT, createStudent);
router.post("/bulk", authenticateJWT, authorizeRole(["admin", "principal"]), bulkCreateStudents);
router.get("/dashboard/:roll_no", authenticateJWT, getStudentDashboard);
router.put("/:id", authenticateJWT, updateStudent);
router.delete("/:id", authenticateJWT, deleteStudent);
router.get("/:id/qrcodes", authenticateJWT, getStudentQRCodes);
export default router;

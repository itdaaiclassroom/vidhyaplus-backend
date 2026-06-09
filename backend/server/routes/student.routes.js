import express from "express";
import { 
  createStudent, 
  updateStudent, 
  deleteStudent, 
  getStudentQRCodes, 
  bulkCreateStudents, 
  getStudentDashboard, 
  markStudentAttendance, 
  getStudentAttendance, 
  updateStudentAttendance,
  getStudentQuizQuestions
} from "../controllers/student.controller.js";

import { authenticateJWT, authorizeRole, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/quiz-questions", authenticateJWT, getStudentQuizQuestions);
router.post("/attendance", authenticateJWT, authorizeRole(["admin", "principal", "teacher", "student_management"]), requirePermission("students", "write"), markStudentAttendance);
router.get("/attendance", authenticateJWT, getStudentAttendance);
router.put("/attendance/:id", authenticateJWT, authorizeRole(["admin", "principal", "teacher", "student_management"]), requirePermission("students", "write"), updateStudentAttendance);

router.post("/", authenticateJWT, requirePermission("students", "write"), createStudent);
router.post("/bulk", authenticateJWT, authorizeRole(["admin", "principal", "student_management"]), requirePermission("students", "write"), bulkCreateStudents);
router.get("/dashboard/:roll_no", authenticateJWT, getStudentDashboard);
router.put("/:id", authenticateJWT, requirePermission("students", "write"), updateStudent);
router.delete("/:id", authenticateJWT, requirePermission("students", "write"), deleteStudent);
router.get("/:id/qrcodes", authenticateJWT, getStudentQRCodes);
export default router;


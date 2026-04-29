import express from "express";
import { createTeacher, updateTeacher, deleteTeacher, bulkCreateTeachers, getTeacherDashboard, markTeacherAttendance, getTeacherAttendance, getTeacherAssignments, markSelfAttendance, getTodayAttendance } from "../controllers/teacher.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/attendance", authenticateJWT, authorizeRole(["admin", "principal"]), markTeacherAttendance);
router.get("/attendance", authenticateJWT, authorizeRole(["admin", "principal"]), getTeacherAttendance);
router.get("/:schoolId/students", authenticateJWT, authorizeRole(["teacher", "principal", "admin"]), getSchoolStudentsbyteachers);
router.post("/", authenticateJWT, authorizeRole(["admin", "principal"]), createTeacher);
router.post("/bulk", authenticateJWT, authorizeRole(["admin", "principal"]), bulkCreateTeachers);
router.get("/dashboard/:id", authenticateJWT, getTeacherDashboard);
router.get("/:id/assignments", authenticateJWT, getTeacherAssignments);
router.post("/:id/attendance", authenticateJWT, markSelfAttendance);
router.get("/:id/attendance/today", authenticateJWT, getTodayAttendance);
router.put("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), updateTeacher);
router.delete("/:id", authenticateJWT, authorizeRole(["admin", "principal"]), deleteTeacher);

export default router;

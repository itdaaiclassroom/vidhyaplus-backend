import express from "express";
import { createTeacher, updateTeacher, deleteTeacher, bulkCreateTeachers, getTeacherDashboard, markTeacherAttendance, getTeacherAttendance, getTeacherAssignments, markSelfAttendance, getTodayAttendance, getTeacherAssessments, getTeacherBroadcastMessages, getTeacherProfile, updateTeacherProfile } from "../controllers/teacher.controller.js";
import { getSchoolStudents } from "../controllers/principal.controller.js";
import { authenticateJWT, authorizeRole, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.post("/attendance", authenticateJWT, authorizeRole(["admin", "principal", "teacher_management"]), requirePermission("teachers", "write"), markTeacherAttendance);
router.get("/attendance", authenticateJWT, authorizeRole(["admin", "principal", "teacher_management"]), getTeacherAttendance);
router.get("/:schoolId/students", authenticateJWT, authorizeRole(["teacher", "principal", "admin"]), getSchoolStudents);
router.post("/", authenticateJWT, authorizeRole(["admin", "principal", "teacher_management"]), requirePermission("teachers", "write"), createTeacher);
router.post("/bulk", authenticateJWT, authorizeRole(["admin", "principal", "teacher_management"]), requirePermission("teachers", "write"), bulkCreateTeachers);
router.get("/dashboard/broadcast-messages", authenticateJWT, getTeacherBroadcastMessages);
router.get("/dashboard/:id", authenticateJWT, getTeacherDashboard);
router.get("/profile", authenticateJWT, getTeacherProfile);
router.put("/profile", authenticateJWT, updateTeacherProfile);
router.get("/:id/assignments", authenticateJWT, getTeacherAssignments);
router.post("/:id/attendance", authenticateJWT, markSelfAttendance);
router.get("/:id/attendance/today", authenticateJWT, getTodayAttendance);
router.get("/:id/assessments", authenticateJWT, getTeacherAssessments);
router.put("/:id", authenticateJWT, authorizeRole(["admin", "principal", "teacher_management"]), requirePermission("teachers", "write"), updateTeacher);
router.delete("/:id", authenticateJWT, authorizeRole(["admin", "principal", "teacher_management"]), requirePermission("teachers", "write"), deleteTeacher);

export default router;

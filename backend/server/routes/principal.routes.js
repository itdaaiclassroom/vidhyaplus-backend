import express from "express";
import { 
  getPrincipalProfile, 
  registerTeacherByPrincipal, 
  registerStudentByPrincipal,
  getSchoolStudents,
  getSchoolTeachers,
  getGrades,
  getSchoolSections,
  createSection,
  updateSection,
  deleteSection
} from "../controllers/principal.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all principal routes
router.use(authenticateJWT);
router.use(authorizeRole("principal"));

router.get("/profile", getPrincipalProfile);
router.post("/teachers", registerTeacherByPrincipal);
router.post("/students", registerStudentByPrincipal);
router.get("/schools/:schoolId/students", getSchoolStudents);
router.get("/schools/:schoolId/teachers", getSchoolTeachers);

// Grades & Sections (Classes) management
router.get("/grades", getGrades);
router.get("/sections", getSchoolSections);
router.post("/sections", createSection);
router.put("/sections/:id", updateSection);
router.delete("/sections/:id", deleteSection);

export default router;


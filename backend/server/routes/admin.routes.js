import express from "express";
import { 
  getDashboardOverview, 
  getAnalyticsData, 
  createAnnouncement, 
  getAnnouncements, 
  getTeacherLogs,
  getAdmins,
  createAdmin,
  getSubjectPerformance
} from "../controllers/admin_management.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// All admin routes require admin role
router.use(authenticateJWT);
router.use(authorizeRole("admin"));

router.get("/overview", getDashboardOverview);
router.get("/analytics", getAnalyticsData);
router.post("/announcements", createAnnouncement);
router.get("/announcements", getAnnouncements);
router.get("/logs/teachers", getTeacherLogs);
router.get("/management", getAdmins);
router.post("/management", createAdmin);
router.get("/performance/subjects", getSubjectPerformance);

export default router;

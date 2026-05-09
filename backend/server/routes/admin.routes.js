import express from "express";
import {
  getDashboardOverview,
  getAnalyticsData,
  createAnnouncement,
  getAnnouncements,
  getTeacherLogs,
  // Admin CRUD
  getAdmins,
  getAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  // Team CRUD
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  // Analytics
  getSubjectPerformance
} from "../controllers/admin_management.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// All admin routes require a valid JWT with the "admin" role
router.use(authenticateJWT);
router.use(authorizeRole("admin"));

// ── Dashboard & Analytics ──────────────────────
router.get("/overview", getDashboardOverview);
router.get("/analytics", getAnalyticsData);
router.get("/performance/subjects", getSubjectPerformance);

// ── Announcements ──────────────────────────────
router.post("/announcements", createAnnouncement);
router.get("/announcements", getAnnouncements);

// ── Activity Logs ──────────────────────────────
router.get("/logs/teachers", getTeacherLogs);

// ── Admin Management CRUD ─────────────────────
router.get("/management", getAdmins);
router.get("/management/:id", getAdmin);
router.post("/management", createAdmin);
router.put("/management/:id", updateAdmin);
router.delete("/management/:id", deleteAdmin);

// ── Team Management CRUD ──────────────────────
router.get("/teams", getTeams);
router.get("/teams/:id", getTeam);
router.post("/teams", createTeam);
router.put("/teams/:id", updateTeam);
router.delete("/teams/:id", deleteTeam);

export default router;

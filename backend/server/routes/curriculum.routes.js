import express from "express";
import {
  getGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  createChapter,
  updateChapter,
  deleteChapter,
  createTopic,
  updateTopic,
  deleteTopic
} from "../controllers/curriculum.controller.js";
import { authenticateJWT, authorizeRole, requirePermission } from "../middleware/auth.js";

const router = express.Router();

// Only admin/principal can manage the curriculum
router.use(authenticateJWT);
router.use(authorizeRole(["admin", "principal"]));
router.use(requirePermission("materials", "write"));

// Grades (Classes)
router.get("/grades", getGrades);
router.post("/grades", createGrade);
router.put("/grades/:id", updateGrade);
router.delete("/grades/:id", deleteGrade);

// Chapters
router.post("/chapters", createChapter);
router.put("/chapters/:id", updateChapter);
router.delete("/chapters/:id", deleteChapter);

// Topics
router.post("/topics", createTopic);
router.put("/topics/:id", updateTopic);
router.delete("/topics/:id", deleteTopic);

export default router;

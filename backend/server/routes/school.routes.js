import express from "express";
import { createSchool, updateSchool, deleteSchool, getSchools } from "../controllers/school.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// GET is intentionally unauthenticated — used in dropdowns/lists before login.
router.get("/", getSchools);

// Mutating operations require an admin JWT so audit logs have a proper actor_id.
router.post(  "/",    authenticateJWT, authorizeRole("admin"), createSchool);
router.put(   "/:id", authenticateJWT, authorizeRole("admin"), updateSchool);
router.delete("/:id", authenticateJWT, authorizeRole("admin"), deleteSchool);

export default router;


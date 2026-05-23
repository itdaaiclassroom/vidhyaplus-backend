import express from "express";
import { createSchool, updateSchool, deleteSchool, getSchools } from "../controllers/school.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

// GET is intentionally unauthenticated — used in dropdowns/lists before login.
router.get("/", getSchools);

// Mutating operations require an admin JWT so audit logs have a proper actor_id.
// school_management team role has the same access as admin for school operations.
router.post(  "/",    authenticateJWT, authorizeRole(["admin", "school_management"]), createSchool);
router.put(   "/:id", authenticateJWT, authorizeRole(["admin", "school_management"]), updateSchool);
router.delete("/:id", authenticateJWT, authorizeRole(["admin", "school_management"]), deleteSchool);

export default router;


import express from "express";
import { createStudent, updateStudent, deleteStudent, getStudentQRCodes } from "../controllers/student.controller.js";
import { authenticateJWT, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createStudent);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);
router.get("/:id/qrcodes", getStudentQRCodes);

export default router;

import express from "express";
import { createTeacher, updateTeacher, deleteTeacher } from "../controllers/teacher.controller.js";

const router = express.Router();

router.post("/", createTeacher);
router.put("/:id", updateTeacher);
router.delete("/:id", deleteTeacher);

export default router;

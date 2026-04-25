import express from "express";
import { createSchool, updateSchool, deleteSchool, getSchools } from "../controllers/school.controller.js";

const router = express.Router();

router.post("/", createSchool);
router.get("/", getSchools);
router.put("/:id", updateSchool);
router.delete("/:id", deleteSchool);

export default router;

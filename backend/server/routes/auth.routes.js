import express from "express";
import { principalLogin, teacherLogin, studentLogin, adminLogin, teamLogin } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/principal/login", principalLogin);
router.post("/login/teacher", teacherLogin);
router.post("/login/student", studentLogin);
router.post("/login/team", teamLogin);

export default router;


import express from "express";
import { principalLogin, teacherLogin, studentLogin, adminLogin } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/principal/login", principalLogin);
router.post("/login/teacher", teacherLogin);
router.post("/login/student", studentLogin);

export default router;

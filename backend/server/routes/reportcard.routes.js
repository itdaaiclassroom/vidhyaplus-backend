import express from "express";
import * as reportCardController from "../controllers/reportcard.controller.js";

const router = express.Router();

router.get("/:studentId", reportCardController.getStudentReportCard);
router.post("/:studentId/behavior", reportCardController.submitBehaviorAssessment);
router.post("/:studentId/generate-insights", reportCardController.generateInsights);

export default router;

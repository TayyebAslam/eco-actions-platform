import { Router } from "express";
import {
  getDashboardStats,
  getRecentActivities,
  getTopStudents,
  getSchoolsProgress,
  getGrowthTrends,
  getWeeklyStats,
} from "../../../controller/admin/dashboard.controller";

const router = Router();

router.get("/stats", getDashboardStats);
router.get("/recent-activities", getRecentActivities);
router.get("/top-students", getTopStudents);
router.get("/schools-progress", getSchoolsProgress);
router.get("/growth-trends", getGrowthTrends);
router.get("/weekly-stats", getWeeklyStats);

export default router;

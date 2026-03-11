import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { auditMiddleware } from "../../middlewares/auditMiddleware";
import challengeRoutes from "./challenge.route";
import activityRoutes from "./activity.route";
import articleRoutes from "./article.route";
import leaderboardRoutes from "./leaderboard.route";
import { getStudentDashboard } from "../../controller/student/dashboard.controller";

const router = Router();

// All student routes require authentication
router.use(authMiddleware);

// Log student API requests to activity logs
router.use(auditMiddleware);

// Challenge routes
router.use("/challenges", challengeRoutes);

// Activity routes
router.use("/activities", activityRoutes);

// Article routes
router.use("/articles", articleRoutes);

// Leaderboard routes
router.use("/leaderboard", leaderboardRoutes);

// Student dashboard
router.get("/dashboard", getStudentDashboard);

export default router;

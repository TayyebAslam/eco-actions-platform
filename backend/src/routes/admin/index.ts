import { Router, Request, Response, NextFunction } from "express";
import USERROUTES from "./user.route";
import ADMINROUTES from "./admin.route";
import PERMISSIONROUTES from "./permission.route";
import SCHOOLROUTES from "./school.route";
import SCHOOLREQUESTROUTEFROMADMIN from "./schoolRequest.route";
import SYSTEMUSERROUTES from "./systemUser.route";
import JOBTITLEROUTES from "./jobTitle.route";
import ROLEROUTES from "./role.route";
import CATEGORYROUTES from "./category.route";
import ACTIVITYROUTES from "./activity.route";
import CHALLENGEROUTES from "./challenge.route";
import CHALLENGETYPEROUTES from "./challengeType.route";
import BADGEROUTES from "./badge.route";
import LEVELROUTES from "./level.route";
import ARTICLEROUTES from "./article.route";
import STUDENTROUTES from "./student.route";
import TEACHERROUTES from "./teacher.route";
import CLASSROUTES from "./class.route";
import SECTIONROUTES from "./section.route";
import DASHBOARDROUTES from "./dashboard.route";
import AUDITLOGROUTES from "./auditLog.route";
import NOTIFICATIONROUTES from "./notification.route";
import { requireAdmin } from "../../middlewares/authMiddleware";
import { userLimiter, userWriteLimiter } from "../../middlewares/requestlimit";
import { auditMiddleware } from "../../middlewares/auditMiddleware";
const router = Router();

// Apply rate limiting based on HTTP method
const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (writeMethods.includes(req.method)) {
    return userWriteLimiter(req, res, next);
  } else {
    return userLimiter(req, res, next);
  }
};

// Apply rate limiting to all admin routes
router.use(rateLimitMiddleware);

// Apply audit logging to all admin routes (logs all POST, PUT, PATCH, DELETE)
router.use(auditMiddleware);

router.use("/users", requireAdmin, USERROUTES);
router.use("/admins", requireAdmin, ADMINROUTES);
router.use("/schools", requireAdmin, SCHOOLROUTES);
router.use("/school-requests", requireAdmin, SCHOOLREQUESTROUTEFROMADMIN);
router.use("/system-users", requireAdmin, SYSTEMUSERROUTES);
router.use("/job-titles", requireAdmin, JOBTITLEROUTES);
router.use("/roles", requireAdmin, ROLEROUTES);
router.use("/", requireAdmin, PERMISSIONROUTES);

// New routes for gamification and management
router.use("/categories", requireAdmin, CATEGORYROUTES);
router.use("/activities", requireAdmin, ACTIVITYROUTES);
router.use("/challenges", requireAdmin, CHALLENGEROUTES);
router.use("/challenge-types", requireAdmin, CHALLENGETYPEROUTES);
router.use("/badges", requireAdmin, BADGEROUTES);
router.use("/levels", requireAdmin, LEVELROUTES);
router.use("/articles", requireAdmin, ARTICLEROUTES);
router.use("/students", requireAdmin, STUDENTROUTES);
router.use("/teachers", requireAdmin, TEACHERROUTES);
router.use("/classes", requireAdmin, CLASSROUTES);
router.use("/schools/:schoolId/classes", requireAdmin, CLASSROUTES);
router.use("/classes/:classId/sections", requireAdmin, SECTIONROUTES);
router.use("/dashboard", requireAdmin, DASHBOARDROUTES);
router.use("/audit-logs", requireAdmin, AUDITLOGROUTES);
router.use("/notifications", requireAdmin, NOTIFICATIONROUTES);

export default router;

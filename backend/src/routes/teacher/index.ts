import { Router } from "express";
import {
  exportSchoolUserById,
  exportSchoolUsers,
  flagSchoolUser,
  getSchoolUserStatsById,
  getSchoolUserById,
  getSchoolUsers,
} from "../../controller/teacher/user.controller";
import {
  getActivities,
  getReportedActivityDetail,
  moderateReportedActivity,
  getReportedActivities,
  reviewActivity,
} from "../../controller/teacher/activity.controller";
import { getTeacherAnalyticsDashboard } from "../../controller/teacher/analytics.controller";

import {
  createArticle,
  getAllArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
} from "../../controller/admin/article.controller";
import {
  uploadEditorImage,
  uploadArticleThumbnail,
} from "../../controller/admin/article.controller";
import { storageData } from "../../utils/services/multer";
import { requireTeacher } from "../../middlewares/authMiddleware";
import { auditMiddleware } from "../../middlewares/auditMiddleware";

const router = Router();

router.use(requireTeacher);

// Log teacher API requests to activity logs
router.use(auditMiddleware);

const upload = storageData("articles");

// Users
router.get("/users", getSchoolUsers);
router.get("/users/export", exportSchoolUsers);
router.get("/users/:id/export", exportSchoolUserById);
router.post("/users/:id/flag", upload.none(), flagSchoolUser);
router.get("/users/:id/stats", getSchoolUserStatsById);
router.get("/users/:id", getSchoolUserById);
// Activities
router.get("/activities", getActivities);
router.get("/analytics/dashboard", getTeacherAnalyticsDashboard);
router.get("/reported-activities", getReportedActivities);
router.get("/reported-activities/:activityId", getReportedActivityDetail);
router.post("/reported-activities/:activityId/action", upload.none(), moderateReportedActivity);
router.post("/activities/:activityId/review", upload.none(), reviewActivity);
// Articles
router.post("/articles/upload-editor-image", upload.single("image"), uploadEditorImage);
router.post("/articles/upload-thumbnail", upload.single("thumbnail"), uploadArticleThumbnail);
router.post("/articles", upload.single("cover_image"), createArticle);
router.get("/articles", getAllArticles);
router.get("/articles/:id", getArticleById);
router.put("/articles/:id", upload.single("cover_image"), updateArticle);
router.delete("/articles/:id", deleteArticle);

export default router;

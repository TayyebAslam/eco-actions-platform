import { Router } from "express";
import multer from "multer";
import {
  createActivity,
  addFeedComment,
  getFeedActivities,
  getBookmarkedFeedActivities,
  getFeedComments,
  getActivityById,
  getActivities,
  reportFeedActivity,
  toggleBookmarkFeedActivity,
  toggleLikeFeedActivity,
  shareActivity,
} from "../../../controller/student/activity.controller";
import { storageData } from "../../../utils/services/multer";
import { authMiddleware } from "../../../middlewares/authMiddleware";

const router = Router();

const upload = storageData("activities");
const formDataUpload = multer();

router.post("/", authMiddleware, upload.array("photos"), createActivity);

router.get("/", authMiddleware, getActivities);

router.post("/:id/like", authMiddleware, toggleLikeFeedActivity);
router.post("/:id/bookmark", authMiddleware, toggleBookmarkFeedActivity);
router.post("/:id/report", authMiddleware, upload.none(), reportFeedActivity);
router.get("/bookmarks", authMiddleware, getBookmarkedFeedActivities);
router.get("/feed", authMiddleware, getFeedActivities);

router.post("/:id/comments", authMiddleware, upload.none(), addFeedComment);
router.get("/:id/comments", authMiddleware, getFeedComments);
router.get("/:id", authMiddleware, getActivityById);




router.post("/:id/share", authMiddleware, upload.none(), shareActivity);


export default router;

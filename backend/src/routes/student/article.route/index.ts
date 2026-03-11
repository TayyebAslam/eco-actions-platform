import { Router } from "express";
import {
  addArticleView,
  getArticle,
  getAllArticles,
  getBookmarkedArticles,
  getArticleDashboard,
  getRecommendedArticles,
  getReadArticlesHistory,
  markReadArticle,
  toggleArticleBookmark,
} from "../../../controller/student/article.controller";

const router = Router();

router.post("/:id/view", addArticleView);
router.post("/:id/read", markReadArticle);
router.get("/", getAllArticles);
router.get("/dashboard", getArticleDashboard);
router.get("/recommended", getRecommendedArticles);
router.get("/history/reads", getReadArticlesHistory);
router.get("/bookmarks", getBookmarkedArticles);
router.get("/:id", getArticle);
router.post("/:id/bookmark", toggleArticleBookmark);

export default router;

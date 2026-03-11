import { Request, Response } from "express";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { parsePagination } from "../../../utils/helperFunctions/paginationHelper";
import { ArticleError, articleService } from "../../../services/article.service";
import { requireStudentUser } from "../../../utils/helperFunctions/requireStudentUser";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

export const toggleArticleBookmark = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const articleId = Number(req.params.id);

    if (Number.isNaN(articleId)) {
      sendResponse(res, 400, "Invalid article ID", false);
      return;
    }

    const result = await articleService.toggleBookmark({
      articleId,
      userId: user.id,
      schoolId: user.school_id,
    });

    const message = result.bookmarked
      ? "Article bookmarked successfully"
      : "Article bookmark removed successfully";
    sendResponse(res, 200, message, true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error bookmarking article:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const addArticleView = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const articleId = Number(req.params.id);

    if (Number.isNaN(articleId)) {
      sendResponse(res, 400, "Invalid article ID", false);
      return;
    }

    const article = await articleService.addViewAndGetArticle({
      articleId,
      userId: user.id,
      schoolId: user.school_id,
    });

    sendResponse(res, 200, "Article fetched successfully", true, article);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error recording article view:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const articleId = Number(req.params.id);

    if (Number.isNaN(articleId)) {
      sendResponse(res, 400, "Invalid article ID", false);
      return;
    }

    const article = await articleService.getArticleForStudent({
      articleId,
      schoolId: user.school_id,
    });

    sendResponse(res, 200, "Article fetched successfully", true, article);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching article:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const markReadArticle = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const articleId = Number(req.params.id);

    if (Number.isNaN(articleId)) {
      sendResponse(res, 400, "Invalid article ID", false);
      return;
    }

    const result = await articleService.markReadAndAwardPoints({
      articleId,
      userId: user.id,
      schoolId: user.school_id,
    });

    const message = result.alreadyRead
      ? "Article already marked as read"
      : `Article marked as read. You earned ${result.pointsAwarded} points`;

    sendResponse(res, 200, message, true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error marking article as read:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getBookmarkedArticles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);

    const result = await articleService.getBookmarkedArticles({
      userId: user.id,
      schoolId: user.school_id,
      page,
      limit,
    });

    sendResponse(res, 200, "Bookmarked articles fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching bookmarked articles:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getAllArticles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit: rawLimit } = parsePagination(req.query as Record<string, unknown>);
    const limit = req.query.limit ? rawLimit : 4;
    const searchRaw = req.query.search ? String(req.query.search) : "";
    const search = searchRaw.trim() ? searchRaw.trim() : undefined;
    const categoryIdValue = Number(req.query.category_id);
    const category_id = Number.isFinite(categoryIdValue)
      ? categoryIdValue
      : undefined;

    const result = await articleService.getAllArticlesForStudent({
      schoolId: user.school_id,
      page,
      limit,
      search,
      category_id,
    });

    sendResponse(res, 200, "Articles fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching articles:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getReadArticlesHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);

    const result = await articleService.getReadHistoryForStudent({
      userId: user.id,
      schoolId: user.school_id,
      page,
      limit,
    });

    sendResponse(res, 200, "Read articles fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching read articles:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getRecommendedArticles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);

    const result = await articleService.getRecommendedArticlesForStudent({
      userId: user.id,
      schoolId: user.school_id,
      page,
      limit,
    });

    sendResponse(res, 200, "Recommended articles fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching recommended articles:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getArticleDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const result = await articleService.getArticleDashboardForStudent({
      userId: user.id,
      schoolId: user.school_id,
    });

    sendResponse(res, 200, "Article dashboard fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof ArticleError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching article dashboard:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

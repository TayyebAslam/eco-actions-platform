import { Request, Response } from "express";
import fs from "fs";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createArticleSchema,
  updateArticleSchema,
} from "../../../validations/article.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { notificationService } from "../../../services/notification.service";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";

export const createArticle = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const authorId = req.user?.id;
      const requesterSchoolId = req.user?.school_id;

      const validated = validateRequest(createArticleSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { title, content, points, school_id, category_id, thumbnail_image } = validated;

      // Determine the school_id for the article
      let articleSchoolId: number | null = null;
      
      if (requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.SUPER_SUB_ADMIN) {
        // Super admins can specify any school_id or create global articles
        // Convert 0 to null for global articles
        articleSchoolId = school_id === 0 ? null : (school_id || null);
      } else {
        // Teachers, admins, and sub-admins must have a school_id
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Your account is not associated with a school", false);
          return;
        }
        
        // If school_id is provided, it must match their own school
        if (school_id !== undefined && school_id !== null && school_id !== requesterSchoolId) {
          sendResponse(res, 403, "You can only create articles for your own school", false);
          return;
        }
        
        // Use requester's school_id
        articleSchoolId = requesterSchoolId;
      }

      // Handle cover image upload (if using file upload)
      let coverImage = null;
      if (req.file) {
        coverImage = "/articles/" + req.file.filename;
      }

      const [newArticle] = await db(TABLE.ARTICLES)
        .insert({
          title,
          content,
          cover_image: coverImage,
          thumbnail_image: thumbnail_image || null,
          points: points ?? 10,
          category_id,
          school_id: articleSchoolId,
          author_id: authorId,
        })
        .returning("*");

      if (newArticle.cover_image) {
        newArticle.cover_image = process.env.BASE_URL + newArticle.cover_image;
      }
      if (newArticle.thumbnail_image && !newArticle.thumbnail_image.startsWith('http')) {
        newArticle.thumbnail_image = process.env.BASE_URL + newArticle.thumbnail_image;
      }

      sendResponse(res, 201, "Article created successfully", true, newArticle);

      // Fire-and-forget: notify students about new article
      notificationService.notifyArticlePublished({
        articleId: newArticle.id,
        articleTitle: newArticle.title || "New Article",
        schoolId: articleSchoolId,
      }).catch((err) => console.error("Notification error (article published):", err));

      return;
    } catch (error: unknown) {
      console.error("Error creating article:", error);
      sendResponse(res, 500, "An internal error occurred", false);
      return;
    }
  }
);

export const getAllArticles = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, school_id, search } = req.query;
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;

      let query = db(TABLE.ARTICLES)
        .select(
          `${TABLE.ARTICLES}.*`,
          `${TABLE.USERS}.email as author_email`,
          `${TABLE.USERS}.first_name as author_first_name`,
          `${TABLE.USERS}.last_name as author_last_name`,
          `${TABLE.SCHOOLS}.name as school_name`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
        .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
        .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`);

      // Apply school scoping based on user role
      if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
        // For teachers, admins, sub-admins, and students: show articles from their school or global articles
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Your account is not associated with a school", false);
          return;
        }
        query = query.where((builder) => {
          builder
            .where(`${TABLE.ARTICLES}.school_id`, requesterSchoolId)
            .orWhereNull(`${TABLE.ARTICLES}.school_id`);
        });
      } else {
        // Super admin can optionally filter by school_id via query param
        if (school_id) {
          query = query.where(`${TABLE.ARTICLES}.school_id`, parseInt(school_id as string));
        }
      }

      if (search) {
        const safeTerm = buildSearchTerm(search as string);
        query = query.where((builder) => {
          builder
            .where(`${TABLE.ARTICLES}.title`, "ilike", safeTerm)
            .orWhere(`${TABLE.ARTICLES}.content`, "ilike", safeTerm);
        });
      }

      const articles = await query
        .clone()
        .offset(skip)
        .limit(pageLimit)
        .orderBy(`${TABLE.ARTICLES}.id`, "desc");

      // Add base URL to cover image, thumbnail and get view/bookmark counts
      for (const article of articles) {
        if (article.cover_image) {
          article.cover_image = process.env.BASE_URL + article.cover_image;
        }
        if (article.thumbnail_image && !article.thumbnail_image.startsWith('http')) {
          article.thumbnail_image = process.env.BASE_URL + article.thumbnail_image;
        }

        const viewsCount = await db(TABLE.ARTICLE_VIEWS)
          .where("article_id", article.id)
          .count({ count: "*" });
        article.views_count = parseInt(viewsCount[0]?.count as string) || 0;

        const bookmarksCount = await db(TABLE.ARTICLE_BOOKMARKS)
          .where("article_id", article.id)
          .count({ count: "*" });
        article.bookmarks_count = parseInt(bookmarksCount[0]?.count as string) || 0;
      }

      // Get total count
      let countQuery = db(TABLE.ARTICLES);
      
      // Apply school scoping for count query
      if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
        countQuery = countQuery.where((builder) => {
          builder
            .where("school_id", requesterSchoolId!)
            .orWhereNull("school_id");
        });
      } else {
        if (school_id) {
          countQuery = countQuery.where("school_id", parseInt(school_id as string));
        }
      }
      
      if (search) {
        const safeTerm = buildSearchTerm(search as string);
        countQuery = countQuery.where((builder) => {
          builder
            .where("title", "ilike", safeTerm)
            .orWhere("content", "ilike", safeTerm);
        });
      }
      const totalCountResult = await countQuery.count({ count: "*" });
      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: articles,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "Articles fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching articles:", error);
      sendResponse(res, 500, "An internal error occurred", false);
      return;
    }
  }
);

export const getArticleById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;

      const article = await db(TABLE.ARTICLES)
        .select(
          `${TABLE.ARTICLES}.*`,
          `${TABLE.USERS}.email as author_email`,
          `${TABLE.USERS}.first_name as author_first_name`,
          `${TABLE.USERS}.last_name as author_last_name`,
          `${TABLE.SCHOOLS}.name as school_name`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
        .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
        .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`)
        .where(`${TABLE.ARTICLES}.id`, id)
        .first();

      if (!article) {
        sendResponse(res, 404, "Article not found", false);
        return;
      }

      // Apply school scoping - check if user has access to this article
      if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Your account is not associated with a school", false);
          return;
        }
        // User can only access articles from their school or global articles (school_id is null)
        if (article.school_id !== null && article.school_id !== requesterSchoolId) {
          sendResponse(res, 403, "You don't have permission to access this article", false);
          return;
        }
      }

      if (article.cover_image) {
        article.cover_image = process.env.BASE_URL + article.cover_image;
      }
      if (article.thumbnail_image && !article.thumbnail_image.startsWith('http')) {
        article.thumbnail_image = process.env.BASE_URL + article.thumbnail_image;
      }

      // Get views and bookmarks count
      const viewsCount = await db(TABLE.ARTICLE_VIEWS)
        .where("article_id", id)
        .count({ count: "*" });

      const bookmarksCount = await db(TABLE.ARTICLE_BOOKMARKS)
        .where("article_id", id)
        .count({ count: "*" });

      const responseData = {
        ...article,
        views_count: parseInt(viewsCount[0]?.count as string) || 0,
        bookmarks_count: parseInt(bookmarksCount[0]?.count as string) || 0,
      };

      sendResponse(res, 200, "Article fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching article:", error);
      sendResponse(res, 500, "An internal error occurred", false);
      return;
    }
  }
);

export const updateArticle = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterId = req.user?.id;

      const { id } = req.params;

      const validated = validateRequest(updateArticleSchema, req.body, res);
      if (!validated) {
        return;
      }

      const existingArticle = await db(TABLE.ARTICLES).where("id", id).first();

      if (!existingArticle) {
        sendResponse(res, 404, "Article not found", false);
        return;
      }

      // Apply school scoping - check if user has access to this article
      const requesterSchoolId = req.user?.school_id;
      if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Your account is not associated with a school", false);
          return;
        }
        // User can only update articles from their school or global articles (school_id is null)
        if (existingArticle.school_id !== null && existingArticle.school_id !== requesterSchoolId) {
          sendResponse(res, 403, "You don't have permission to update this article", false);
          return;
        }
      }

      // Check if user can update (author or admin)
      if (
        requesterRole === UserRole.TEACHER &&
        existingArticle.author_id !== requesterId
      ) {
        sendResponse(res, 403, "You can only update your own articles", false);
        return;
      }

      const { title, content, points, school_id, category_id, thumbnail_image } = validated;

      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (points !== undefined) updateData.points = points;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (school_id !== undefined) updateData.school_id = school_id === 0 ? null : school_id;
      if (thumbnail_image !== undefined) updateData.thumbnail_image = thumbnail_image;

      // Handle cover image upload (if using file upload)
      if (req.file) {
        if (existingArticle.cover_image) {
          try {
            fs.unlinkSync(`public${existingArticle.cover_image}`);
          } catch (e) {
            /* ignore */
          }
        }
        updateData.cover_image = "/articles/" + req.file.filename;
      }

      const [updatedArticle] = await db(TABLE.ARTICLES)
        .where("id", id)
        .update(updateData)
        .returning("*");

      if (updatedArticle.cover_image) {
        updatedArticle.cover_image = process.env.BASE_URL + updatedArticle.cover_image;
      }
      if (updatedArticle.thumbnail_image && !updatedArticle.thumbnail_image.startsWith('http')) {
        updatedArticle.thumbnail_image = process.env.BASE_URL + updatedArticle.thumbnail_image;
      }

      sendResponse(res, 200, "Article updated successfully", true, updatedArticle);
      return;
    } catch (error: unknown) {
      console.error("Error updating article:", error);
      sendResponse(res, 500, "An internal error occurred", false);
      return;
    }
  }
);

export const deleteArticle = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterId = req.user?.id;

      const { id } = req.params;

      const article = await db(TABLE.ARTICLES).where("id", id).first();

      if (!article) {
        sendResponse(res, 404, "Article not found", false);
        return;
      }

      // Apply school scoping - check if user has access to this article
      const requesterSchoolId = req.user?.school_id;
      if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Your account is not associated with a school", false);
          return;
        }
        // User can only delete articles from their school or global articles (school_id is null)
        if (article.school_id !== null && article.school_id !== requesterSchoolId) {
          sendResponse(res, 403, "You don't have permission to delete this article", false);
          return;
        }
      }

      // Check if user can delete (author or admin)
      if (
        requesterRole === UserRole.TEACHER &&
        article.author_id !== requesterId
      ) {
        sendResponse(res, 403, "You can only delete your own articles", false);
        return;
      }

      // Delete cover image if exists
      if (article.cover_image) {
        try {
          fs.unlinkSync(`public${article.cover_image}`);
        } catch (e) {
          /* ignore */
        }
      }

      await db(TABLE.ARTICLES).where("id", id).del();

      sendResponse(res, 200, "Article deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting article:", error);
      sendResponse(res, 500, "An internal error occurred", false);
      return;
    }
  }
);
export const uploadEditorImage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        sendResponse(res, 400, "No image file uploaded", false);
        return;
      }

      // Image is stored in /public/articles/ directory by multer
      const imageUrl = process.env.BASE_URL + "/articles/" + req.file.filename;

      // Return URL in formats compatible with popular editors
      sendResponse(res, 200, "Image uploaded successfully", true, {
        url: imageUrl,
        location: imageUrl, // TinyMCE uses 'location'
        link: imageUrl, // Some editors use 'link'
        filename: req.file.filename,
      });
    } catch (error: unknown) {
      console.error("Error uploading editor image:", error);
      sendResponse(res, 500, "Failed to upload image", false);
    }
  }
);

/**
 * Upload article thumbnail
 * Separate endpoint for uploading article thumbnail image
 */
export const uploadArticleThumbnail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        sendResponse(res, 400, "No thumbnail file uploaded", false);
        return;
      }

      const thumbnailUrl = process.env.BASE_URL + "/articles/" + req.file.filename;

      sendResponse(res, 200, "Thumbnail uploaded successfully", true, {
        url: thumbnailUrl,
        filename: req.file.filename,
      });
    } catch (error: unknown) {
      console.error("Error uploading thumbnail:", error);
      sendResponse(res, 500, "Failed to upload thumbnail", false);
    }
  }
);

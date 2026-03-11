import { Request, Response } from "express";
import { activityService } from "../../../services/activity.service";
import { notificationService } from "../../../services/notification.service";
import { extractAndValidateBio } from "../../../utils/helperFunctions/parsers";
import {
  createActivitySchema,
  shareActivitySchema,
  addFeedCommentSchema,
  reportFeedActivitySchema,
} from "../../../validations/activity.validation";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { extractPhotos } from "../../../utils/helperFunctions/photosHelper";
import { requireStudentUser } from "../../../utils/helperFunctions/requireStudentUser";
import db from "../../../config/db";
import { TABLE } from "../../../utils/Database/table";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { ActivityError } from "../../../utils/errors";



/**
 * Create a new activity (student submission)
 */
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    // Build payload for validation when using multipart/form-data
    const files = (req.files as Express.Multer.File[] | undefined) || undefined;
    const photosFromFiles = extractPhotos({ files, bodyPhotos: req.body?.photos });

    const parsedBody: Record<string, unknown> = {
      title: req.body?.title,
      description: req.body?.description,
      category_id: req.body?.category_id ? Number(req.body.category_id) : undefined,
      photos: photosFromFiles,
    };

    const validationResult = createActivitySchema.safeParse(parsedBody);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      sendResponse(res, 400, "Validation failed", false, { errors });
      return;
    }

    const activity = await activityService.createActivity(
      validationResult.data,
      user.id,
      user.school_id
    );

    sendResponse(res, 201, "Activity created successfully", true, activity);

    // Fire-and-forget: notify admins about pending activities
    if (user.school_id) {
      notificationService.notifyAdminsPendingActivities(user.school_id)
        .catch((err) => console.error("Notification error (pending activities):", err));
    }
  } catch (error) {
    console.error("Error creating activity:", error);
    if (error instanceof Error) {
      if (error.message.includes("Invalid category")) {
        sendResponse(res, 400, error.message, false);
      } else {
        sendResponse(res, 500, error.message, false);
      }
    } else {
      sendResponse(res, 500, "Internal server error", false);
    }
  }
};

/**
 * Get activities for the logged-in student
 */
export const getActivities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit, category_id, status, search } = req.query;

    const result = await activityService.getAllActivities(
      {
        status: status ? String(status) : undefined,
        category_id: category_id ? Number(category_id) : undefined,
        search: search ? String(search) : undefined,
        user_id: user.id,
      },
      {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      }
    );

    const activities = result.data.map((activity) => {
      const { challenge_title, challenge_description, ...rest } = activity;

      // ✅ Handle challenge activity title/description override
      if (rest.challenge_activity) {
        return {
          ...rest,
          title: challenge_title ?? rest.title,
          description: challenge_description ?? rest.description,
        };
      }

      return {
        ...rest,
      };
    });

    sendResponse(res, 200, "Activities fetched successfully", true, {
      data: activities,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    sendResponse(res, 500, "Internal server error", false);
  }
};
  

/**
 * Get activity by ID for the logged-in student
 */
export const getActivityById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    if (Number.isNaN(activityId)) {
      sendResponse(res, 400, "Invalid activity ID", false);
      return;
    }

    const activity = await activityService.getActivityById(activityId);

    if (activity.user_id !== user.id) {
      sendResponse(res, 403, "You can only access your own activities", false);
      return;
    }

    // Normalize challenge activity title/description like list endpoint
    if (activity.challenge_activity) {
      activity.title = activity.challenge_title ?? activity.title;
      activity.description = activity.challenge_description ?? activity.description;
    }

    sendResponse(res, 200, "Activity fetched successfully", true, activity);
  } catch (error: unknown) {
    console.error("Error fetching activity:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Share an approved activity to the school feed
 * POST /student/activities/:id/share
 */
export const shareActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    // Validate activityId - must be positive integer
    if (Number.isNaN(activityId) || activityId <= 0) {
      sendResponse(res, 400, "Invalid activity ID format", false);
      return;
    }

    // Validate user has school context (critical for school feed)
    if (!user.school_id) {
      sendResponse(res, 403, "User must belong to a school to share activities", false);
      return;
    }

    // Parse FormData safely: Extract and sanitize bio
    const parsedBody = {
      bio: extractAndValidateBio(req.body?.bio),
    };

    // Validate against schema
    const shareValidation = shareActivitySchema.safeParse(parsedBody);

    if (!shareValidation.success) {
      const errors = shareValidation.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      sendResponse(res, 400, "Validation failed", false, { errors });
      return;
    }

    // Share activity to school feed with validated data
    const result = await activityService.shareActivityToFeed({
      activityId,
      userId: user.id,
      schoolId: user.school_id,
      bio: shareValidation.data.bio,
    });

    sendResponse(res, 201, "Activity shared to feed successfully", true, result);
  } catch (error: unknown) {
    console.error("Error sharing activity:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Like a shared feed activity
 */
export const toggleLikeFeedActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    if (Number.isNaN(activityId)) {
      sendResponse(res, 400, "Invalid activity ID", false);
      return;
    }

    const result = await activityService.toggleLikeFeedActivity({
      activityId,
      userId: user.id,
      schoolId: user.school_id,
    });

    const message = result.liked ? "Activity liked successfully" : "Activity unliked successfully";
    sendResponse(res, 200, message, true, result);
  } catch (error: unknown) {
    console.error("Error liking activity:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Add comment on a shared feed activity
 */
export const addFeedComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    if (Number.isNaN(activityId)) {
      sendResponse(res, 400, "Invalid activity ID", false);
      return;
    }

    const commentValidation = addFeedCommentSchema.safeParse({
      content: req.body?.content,
    });

    if (!commentValidation.success) {
      const errors = commentValidation.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      sendResponse(res, 400, "Validation failed", false, { errors });
      return;
    }

    const comment = await activityService.addFeedComment({
      activityId,
      userId: user.id,
      schoolId: user.school_id,
      content: commentValidation.data.content.trim(),
    });

    sendResponse(res, 201, "Comment added successfully", true, comment);

    // Fire-and-forget: notify activity owner about the comment
    db(TABLE.ACTIVITIES).where("id", activityId).first().then((activity) => {
      if (activity && activity.user_id !== user.id) {
        const commenterName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Someone";
        notificationService.notifyCommentReceived({
          activityOwnerId: activity.user_id,
          commenterId: user.id,
          commenterName,
          activityId,
          activityTitle: activity.title || "an activity",
        }).catch((err) => console.error("Notification error (comment):", err));
      }
    }).catch((err) => console.error("Notification error (comment lookup):", err));
  } catch (error: unknown) {
    console.error("Error adding comment:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Get comments for a shared feed activity
 */
export const getFeedComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    if (Number.isNaN(activityId)) {
      sendResponse(res, 400, "Invalid activity ID", false);
      return;
    }

    const { page, limit } = req.query;

    const result = await activityService.getFeedComments({
      activityId,
      schoolId: user.school_id,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });

    sendResponse(res, 200, "Comments fetched successfully", true, {
      data: result.data,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error: unknown) {
    console.error("Error fetching comments:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Bookmark a shared feed activity
 */
export const toggleBookmarkFeedActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    if (Number.isNaN(activityId)) {
      sendResponse(res, 400, "Invalid activity ID", false);
      return;
    }

    const result = await activityService.toggleBookmarkFeedActivity({
      activityId,
      userId: user.id,
      schoolId: user.school_id,
    });

    const message = result.bookmarked
      ? "Activity bookmarked successfully"
      : "Activity bookmark removed successfully";
    sendResponse(res, 200, message, true, result);
  } catch (error: unknown) {
    console.error("Error bookmarking activity:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Report a shared feed activity
 */
export const reportFeedActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { id } = req.params;
    const activityId = parseInt(id as string);

    if (Number.isNaN(activityId)) {
      sendResponse(res, 400, "Invalid activity ID", false);
      return;
    }

    const reportValidation = reportFeedActivitySchema.safeParse({
      reason: req.body?.reason,
      description: req.body?.description,
    });

    if (!reportValidation.success) {
      const errors = reportValidation.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      sendResponse(res, 400, "Validation failed", false, { errors });
      return;
    }

    const result = await activityService.reportFeedActivity({
      activityId,
      userId: user.id,
      schoolId: user.school_id,
      reason: reportValidation.data.reason,
      description: reportValidation.data.description,
    });

    sendResponse(res, 201, "Activity reported successfully", true, result);
  } catch (error: any) {
    console.error("Error reporting activity:", error);
    if (error?.name === "ActivityError") {
      sendResponse(res, error.statusCode || 400, error.message, false);
      return;
    }
    sendResponse(res, 500, "Internal server error", false);
  }
};

/**
 * Get shared feed activities for student's school
 */
export const getFeedActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit, category_id, search } = req.query;

    const result = await activityService.getFeedActivities({
      schoolId: user.school_id,
      userId: user.id,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      category_id: category_id ? Number(category_id) : undefined,
      search: search ? String(search) : undefined,
    });

    const activities = result.data.map((activity) => {
      const { challenge_title, challenge_description, ...rest } = activity;

      if (rest.challenge_activity) {
        return {
          ...rest,
          title: challenge_title ?? rest.title,
          description: challenge_description ?? rest.description,
        };
      }

      return {
        ...rest,
      };
    });

    sendResponse(res, 200, "Feed activities fetched successfully", true, {
      data: activities,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error: unknown) {
    console.error("Error fetching feed activities:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

/**
 * Get bookmarked shared feed activities for student
 */
export const getBookmarkedFeedActivities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit, category_id, search } = req.query;

    const result = await activityService.getBookmarkedFeedActivities({
      userId: user.id,
      schoolId: user.school_id,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      category_id: category_id ? Number(category_id) : undefined,
      search: search ? String(search) : undefined,
    });

    const activities = result.data.map((activity) => {
      const { challenge_title, challenge_description, ...rest } = activity;

      if (rest.challenge_activity) {
        return {
          ...rest,
          title: challenge_title ?? rest.title,
          description: challenge_description ?? rest.description,
        };
      }

      return {
        ...rest,
      };
    });

    sendResponse(res, 200, "Bookmarked activities fetched successfully", true, {
      data: activities,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error: unknown) {
    console.error("Error fetching bookmarks:", error);
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

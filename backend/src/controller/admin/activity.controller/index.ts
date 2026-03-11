import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";

import { activityService, ActivityError, notificationService } from "../../../services";
import { reviewActivitySchema } from "../../../validations/activity.validation";
import { toFullPhotoUrls } from "../../../utils/helperFunctions/photosHelper";
import db from "../../../config/db";
import { TABLE } from "../../../utils/Database/table";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Get All Activities
 */
export const getAllActivities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, status, school_id, category_id, search } = req.query;

  try {
    const result = await activityService.getAllActivities(
      {
        status: status as string,
        school_id: school_id ? parseInt(school_id as string) : undefined,
        category_id: category_id ? parseInt(category_id as string) : undefined,
        search: search as string,
      },
      {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
      }
    );

    const activities = result.data.map((activity) => ({
      ...activity,
      photos: toFullPhotoUrls(activity.photos),
    }));

    sendResponse(res, 200, "Activities fetched successfully", true, {
      data: activities,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error: unknown) {
    console.error("Error fetching activities:", error);
    sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Get Activity By ID
 */
export const getActivityById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const activity = await activityService.getActivityById(parseInt(id as string));

    sendResponse(res, 200, "Activity fetched successfully", true, {
      ...activity,
      photos: toFullPhotoUrls(activity.photos),
    });
  } catch (error: unknown) {
    if (error instanceof ActivityError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error fetching activity:", error);
    sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Approve Activity
 */
export const reviewActivity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id: activityId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role || "";

    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    // Validate input using reviewActivitySchema
    const parsed = reviewActivitySchema.safeParse(req.body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]!;
      sendResponse(res, 400, firstError.message, false);
      return;
    }

    const { status, points, rejection_reason } = parsed.data;

    try {
      let result: { points?: number } = {};

      if (status === "approved") {
        if (points === undefined) {
          sendResponse(res, 400, "Points are required for approval", false);
          return;
        }

        result = await activityService.reviewActivity(
          Number(activityId),
          { status, points },
          userId,
          userRole
        );
      } else {
        if (!rejection_reason) {
          sendResponse(res, 400, "Rejection reason is required", false);
          return;
        }

        await activityService.reviewActivity(
          Number(activityId),
          { status, rejection_reason },
          userId,
          userRole
        );
      }

      sendResponse(res, 200, `Activity ${status} successfully`, true, result);

      // Fire-and-forget notification triggers
      const activity = await db(TABLE.ACTIVITIES).where("id", Number(activityId)).first();
      if (activity) {
        if (status === "approved") {
          notificationService.notifyActivityApproved({
            studentUserId: activity.user_id,
            activityTitle: activity.title || "Untitled",
            activityId: activity.id,
            points: result.points || 0,
          }).catch((err) => console.error("Notification error (activity approved):", err));
        } else {
          notificationService.notifyActivityRejected({
            studentUserId: activity.user_id,
            activityTitle: activity.title || "Untitled",
            activityId: activity.id,
            rejectionReason: rejection_reason || "No reason provided",
          }).catch((err) => console.error("Notification error (activity rejected):", err));
        }

        if (activity.school_id) {
          notificationService.notifyAdminsPendingActivities(activity.school_id)
            .catch((err) => console.error("Notification error (pending activities):", err));
        }
      }
    } catch (error: unknown) {
      if (error instanceof ActivityError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error reviewing activity:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

/**
 * Delete Activity
 */

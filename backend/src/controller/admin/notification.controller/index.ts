import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { notificationService, NotificationError } from "../../../services";
import {
  getNotificationsSchema,
  markAsReadSchema,
} from "../../../validations/notification.validation";

/**
 * Get notifications for the authenticated user
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    try {
      const parsed = getNotificationsSchema.safeParse(req.query);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]!;
        sendResponse(res, 400, firstError.message, false);
        return;
      }

      const { page, limit, is_read, type } = parsed.data;

      const result = await notificationService.getByUserId(
        userId,
        { is_read, type },
        { page, limit }
      );

      sendResponse(res, 200, "Notifications fetched successfully", true, {
        data: result.data,
        unreadCount: result.unreadCount,
        page: result.pagination.currentPage,
        limit: result.pagination.limit,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
      });
    } catch (error: unknown) {
      console.error("Error fetching notifications:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

/**
 * Mark a single notification as read
 */
export const markAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    try {
      const parsed = markAsReadSchema.safeParse(req.params);
      if (!parsed.success) {
        sendResponse(res, 400, "Invalid notification ID", false);
        return;
      }

      const notification = await notificationService.markAsRead(
        parsed.data.id,
        userId
      );
      sendResponse(res, 200, "Notification marked as read", true, notification);
    } catch (error: unknown) {
      if (error instanceof NotificationError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error marking notification as read:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

/**
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    try {
      await notificationService.markAllAsRead(userId);
      sendResponse(res, 200, "All notifications marked as read", true);
    } catch (error: unknown) {
      console.error("Error marking all notifications as read:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

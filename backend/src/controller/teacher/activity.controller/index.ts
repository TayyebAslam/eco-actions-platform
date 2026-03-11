import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { activityService, ActivityError } from "../../../services";
import { moderateReportedActivitySchema, reviewActivitySchema } from "../../../validations/activity.validation";
import { GetReportedActivitiesForTeacherParams } from "../../../dto/activity.dto";

type ReportStatus = NonNullable<GetReportedActivitiesForTeacherParams["status"]>;
type ReportType = NonNullable<GetReportedActivitiesForTeacherParams["type"]>;
type ReportPriority = NonNullable<GetReportedActivitiesForTeacherParams["priority"]>;


export const getActivities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, category_id, status } = req.query;
    const schoolId = req.user?.school_id;

    if (!schoolId) {
      sendResponse(res, 400, "Teacher must belong to a school", false);
      return;
    }

    try {
      const result = await activityService.getAllActivities(
        {
          status: status ? (status as string) : undefined,
          school_id: schoolId,
          category_id: category_id ? parseInt(category_id as string) : undefined,
        },
        {
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 10,
        }
      );


      const activities = result.data.map((activity) => {
        const { challenge_title, challenge_description, ...rest } = activity;
        if (rest.challenge_activity) {
          return {
            ...rest,
            title: challenge_title ?? rest.title,
            description: challenge_description ?? rest.description,
          };
        }
        return rest;
      });



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
  }
);

export const getReportedActivities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, status, type, priority } = req.query;
    const schoolId = req.user?.school_id;

    if (!schoolId) {
      sendResponse(res, 400, "Teacher must belong to a school", false);
      return;
    }

    const allowedStatuses: ReportStatus[] = ["pending", "reviewed", "all"];
    const normalizedStatus = String(status || "pending").toLowerCase();
    if (!allowedStatuses.includes(normalizedStatus as ReportStatus)) {
      sendResponse(res, 400, "Invalid status. Use pending, reviewed, or all", false);
      return;
    }

    const allowedTypes: ReportType[] = ["all", "activity", "comment", "post"];
    const normalizedType = String(type || "all").toLowerCase();
    if (!allowedTypes.includes(normalizedType as ReportType)) {
      sendResponse(res, 400, "Invalid type. Use all, activity, comment, or post", false);
      return;
    }

    const allowedPriorities: ReportPriority[] = ["low", "medium", "high"];
    const normalizedPriority = priority ? String(priority).toLowerCase() : undefined;
    if (
      normalizedPriority &&
      !allowedPriorities.includes(normalizedPriority as ReportPriority)
    ) {
      sendResponse(res, 400, "Invalid priority. Use low, medium, or high", false);
      return;
    }

    try {
      const params: GetReportedActivitiesForTeacherParams = {
        schoolId,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        status: normalizedStatus as ReportStatus,
        type: normalizedType as ReportType,
        priority: normalizedPriority as ReportPriority | undefined,
      };

      const result = await activityService.getReportedActivitiesForTeacher(params);

      sendResponse(res, 200, "Reported activities fetched successfully", true, {
        stats: result.stats,
        data: result.data,
        page: result.pagination.currentPage,
        limit: result.pagination.limit,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
      });
    } catch (error: any) {
      if (error instanceof ActivityError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching reported activities:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const moderateReportedActivity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { activityId } = req.params;
    const schoolId = req.user?.school_id;
    const reviewerId = req.user?.id;

    if (!schoolId) {
      sendResponse(res, 400, "Teacher must belong to a school", false);
      return;
    }

    if (!reviewerId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    const activityIdNumber = Number(activityId);
    if (!Number.isFinite(activityIdNumber) || activityIdNumber <= 0) {
      sendResponse(res, 400, "Invalid activityId", false);
      return;
    }

    const parsed = moderateReportedActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]!;
      sendResponse(res, 400, firstError.message, false);
      return;
    }

    try {
      const result = await activityService.moderateReportedActivityForTeacher({
        activityId: activityIdNumber,
        schoolId,
        reviewerId,
        action: parsed.data.action,
        note: parsed.data.note,
      });

      sendResponse(
        res,
        200,
        parsed.data.action === "approve"
          ? "Reported activity approved successfully"
          : "Reported activity removed successfully",
        true,
        result
      );
    } catch (error: any) {
      if (error instanceof ActivityError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error moderating reported activity:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const getReportedActivityDetail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { activityId } = req.params;
    const schoolId = req.user?.school_id;

    if (!schoolId) {
      sendResponse(res, 400, "Teacher must belong to a school", false);
      return;
    }

    const activityIdNumber = Number(activityId);
    if (!Number.isFinite(activityIdNumber) || activityIdNumber <= 0) {
      sendResponse(res, 400, "Invalid activityId", false);
      return;
    }

    try {
      const result = await activityService.getReportedActivityDetailForTeacher({
        activityId: activityIdNumber,
        schoolId,
      });

      sendResponse(res, 200, "Reported activity detail fetched successfully", true, result);
    } catch (error: any) {
      if (error instanceof ActivityError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching reported activity detail:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);


export const reviewActivity = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { activityId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    // Merge query + body for Zod validation
    const parsed = reviewActivitySchema.safeParse({
      ...req.query,
      ...req.body,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]!;
      sendResponse(res, 400, firstError.message, false);
      return;
    }

    const { status, points, rejection_reason } = parsed.data;

    try {
      let result: { points?: number } = {};

      if (status === "approved") {
        result = await activityService.reviewActivity(
          Number(activityId),
          { status, points },
          userId,
          userRole || ""
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
          userRole || ""
        );
      }

      sendResponse(res, 200, `Activity ${status} successfully`, true, result);
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

import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { teacherAnalyticsService, TeacherAnalyticsRange } from "../../../services";

const ALLOWED_RANGES: TeacherAnalyticsRange[] = [
  "today",
  "this_week",
  "this_month",
  "all_time",
];

export const getTeacherAnalyticsDashboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const schoolId = req.user?.school_id;

    if (!schoolId) {
      sendResponse(res, 400, "Teacher must belong to a school", false);
      return;
    }

    const requestedRange = String(req.query.range || "this_week").toLowerCase();
    if (!ALLOWED_RANGES.includes(requestedRange as TeacherAnalyticsRange)) {
      sendResponse(
        res,
        400,
        "Invalid range. Use today, this_week, this_month, or all_time",
        false
      );
      return;
    }

    const data = await teacherAnalyticsService.getDashboard(
      schoolId,
      requestedRange as TeacherAnalyticsRange
    );

    sendResponse(res, 200, "Teacher analytics fetched successfully", true, data);
  }
);

import { Request, Response } from "express";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { requireStudentUser } from "../../../utils/helperFunctions/requireStudentUser";
import { parsePagination } from "../../../utils/helperFunctions/paginationHelper";
import { StudentError, studentService } from "../../../services/student.service";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

export const getStudentLeaderboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const rawPeriod = String(req.query.time_period || req.query.period || "semester").toLowerCase();
    const rawCategoryId = req.query.category_id;
    let parsedCategoryId: number | undefined;

    if (rawCategoryId !== undefined) {
      const categoryIdNumber = Number(rawCategoryId);
      if (!Number.isFinite(categoryIdNumber) || categoryIdNumber <= 0) {
        sendResponse(res, 400, "Invalid category_id", false);
        return;
      }
      parsedCategoryId = categoryIdNumber;
    }

    if (!["week", "month", "semester", "all_time"].includes(rawPeriod)) {
      sendResponse(
        res,
        400,
        "Invalid time_period. Use 'week', 'month', 'semester', or 'all_time'",
        false
      );
      return;
    }

    const result = await studentService.getStudentLeaderboard({
      schoolId: user.school_id,
      userId: user.id,
      page,
      limit,
      period: rawPeriod as "week" | "month" | "semester" | "all_time",
      categoryId: parsedCategoryId,
    });

    sendResponse(res, 200, "Leaderboard fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof StudentError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching student leaderboard:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

export const getSchoolsLeaderboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const rawPeriod = String(req.query.time_period || req.query.period || "semester").toLowerCase();
    const rawCategoryId = req.query.category_id;
    let parsedCategoryId: number | undefined;

    if (rawCategoryId !== undefined) {
      const categoryIdNumber = Number(rawCategoryId);
      if (!Number.isFinite(categoryIdNumber) || categoryIdNumber <= 0) {
        sendResponse(res, 400, "Invalid category_id", false);
        return;
      }
      parsedCategoryId = categoryIdNumber;
    }

    if (!["week", "month", "semester", "all_time"].includes(rawPeriod)) {
      sendResponse(
        res,
        400,
        "Invalid time_period. Use 'week', 'month', 'semester', or 'all_time'",
        false
      );
      return;
    }

    const result = await studentService.getSchoolsLeaderboard({
      userSchoolId: user.school_id,
      page,
      limit,
      period: rawPeriod as "week" | "month" | "semester" | "all_time",
      categoryId: parsedCategoryId,
    });

    sendResponse(res, 200, "Schools leaderboard fetched successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof StudentError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching schools leaderboard:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
};

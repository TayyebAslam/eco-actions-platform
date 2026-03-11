import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { userService, UserError } from "../../../services";
import { UserRole } from "../../../utils/enums/users.enum";
import { flagSchoolUserSchema } from "../../../validations/teacher.validation";


export const getSchoolUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, search, is_active, class_id, section_id, sort_by, sort_order } = req.query;
    const userRole = req.user?.role;
    const schoolId = req.user?.school_id;

    if (userRole !== UserRole.TEACHER) {
      sendResponse(res, 403, "Only teacher role can access this endpoint", false);
      return;
    }

    if (!schoolId) {
      sendResponse(
        res,
        400,
        "Teacher must belong to a school to view students",
        false
      );
      return;
    }

    try {
      const result = await userService.getSchoolUsers(
        schoolId,
        {
          search: search as string,
          role: "student",
          is_active:
            is_active === "true" ? true : is_active === "false" ? false : undefined,
          ...(class_id ? { class_id: Number(class_id) } : {}),
          ...(section_id ? { section_id: Number(section_id) } : {}),
          ...(sort_by ? { sort_by: String(sort_by) } : {}),
          ...(sort_order ? { sort_order: String(sort_order) } : {}),
        },
        {
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 10,
        }
      );

      sendResponse(res, 200, "School students fetched successfully", true, {
        stats: result.stats || {
          total_students: result.pagination.totalCount,
          active_students: 0,
          inactive_students: 0,
          avg_points: 0,
        },
        data: result.data,
        page: result.pagination.currentPage,
        limit: result.pagination.limit,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
      });
    } catch (error: unknown) {
      console.error("Error fetching school students:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const getSchoolUserById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const schoolId = req.user?.school_id;

    if (userRole !== UserRole.TEACHER) {
      sendResponse(res, 403, "Only teacher role can access this endpoint", false);
      return;
    }

    if (!schoolId) {
      sendResponse(
        res,
        400,
        "Teacher must belong to a school to view students",
        false
      );
      return;
    }

    const studentId = Number(id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      sendResponse(res, 400, "Invalid student id", false);
      return;
    }

    try {
      const student = await userService.getSchoolUserById(schoolId, studentId);
      sendResponse(res, 200, "Student fetched successfully", true, student);
    } catch (error: any) {
      if (error instanceof UserError) {
        sendResponse(res, error.statusCode, error.message, false, error.data);
        return;
      }
      console.error("Error fetching school student:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const exportSchoolUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userRole = req.user?.role;
    const schoolId = req.user?.school_id;
    const {
      mode,
      search,
      is_active,
      class_id,
      section_id,
      sort_by,
      sort_order,
    } = req.query;

    if (userRole !== UserRole.TEACHER) {
      sendResponse(res, 403, "Only teacher role can access this endpoint", false);
      return;
    }

    if (!schoolId) {
      sendResponse(
        res,
        400,
        "Teacher must belong to a school to export students",
        false
      );
      return;
    }

    try {
      const { fileName, csv } = await userService.exportSchoolUsersCsv(schoolId, {
        mode: mode as string,
        search: search as string,
        is_active: is_active as string,
        class_id: class_id as string,
        section_id: section_id as string,
        sort_by: sort_by as string,
        sort_order: sort_order as string,
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      res.status(200).send(csv);
    } catch (error: any) {
      if (error instanceof UserError) {
        sendResponse(res, error.statusCode, error.message, false, error.data);
        return;
      }
      console.error("Error exporting school students:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const exportSchoolUserById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const schoolId = req.user?.school_id;

    if (userRole !== UserRole.TEACHER) {
      sendResponse(res, 403, "Only teacher role can access this endpoint", false);
      return;
    }

    if (!schoolId) {
      sendResponse(
        res,
        400,
        "Teacher must belong to a school to export students",
        false
      );
      return;
    }

    const studentId = Number(id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      sendResponse(res, 400, "Invalid student id", false);
      return;
    }

    try {
      const { fileName, csv } = await userService.exportSchoolUserByIdCsv(schoolId, studentId);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      res.status(200).send(csv);
    } catch (error: any) {
      if (error instanceof UserError) {
        sendResponse(res, error.statusCode, error.message, false, error.data);
        return;
      }
      console.error("Error exporting school student:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const getSchoolUserStatsById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const schoolId = req.user?.school_id;

    if (userRole !== UserRole.TEACHER) {
      sendResponse(res, 403, "Only teacher role can access this endpoint", false);
      return;
    }

    if (!schoolId) {
      sendResponse(
        res,
        400,
        "Teacher must belong to a school to view students",
        false
      );
      return;
    }

    const studentId = Number(id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      sendResponse(res, 400, "Invalid student id", false);
      return;
    }

    try {
      const studentStats = await userService.getSchoolUserStatsById(schoolId, studentId);
      sendResponse(res, 200, "Student stats fetched successfully", true, studentStats);
    } catch (error: any) {
      if (error instanceof UserError) {
        sendResponse(res, error.statusCode, error.message, false, error.data);
        return;
      }
      console.error("Error fetching school student stats:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const flagSchoolUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const schoolId = req.user?.school_id;
    const teacherUserId = req.user?.id;

    if (userRole !== UserRole.TEACHER) {
      sendResponse(res, 403, "Only teacher role can access this endpoint", false);
      return;
    }

    if (!schoolId) {
      sendResponse(
        res,
        400,
        "Teacher must belong to a school to flag students",
        false
      );
      return;
    }

    if (!teacherUserId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    const studentId = Number(id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      sendResponse(res, 400, "Invalid student id", false);
      return;
    }

    const parsed = flagSchoolUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]!;
      sendResponse(res, 400, firstError.message, false);
      return;
    }

    try {
      const result = await userService.flagSchoolUserByTeacher({
        schoolId,
        teacherUserId,
        studentUserId: studentId,
        reason: parsed.data.reason,
        note: parsed.data.note,
      });

      sendResponse(
        res,
        result.is_new ? 201 : 200,
        result.is_new
          ? "Student flagged successfully"
          : "Student flag updated successfully",
        true,
        result
      );
    } catch (error: any) {
      if (error instanceof UserError) {
        sendResponse(res, error.statusCode, error.message, false, error.data);
        return;
      }
      console.error("Error flagging school student:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

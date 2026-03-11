import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  createTeacherSchema,
  updateTeacherSchema,
  bulkUploadTeacherSchema,
} from "../../../validations/teacher.validation";
import { teacherService, TeacherError } from "../../../services";
import { activityLogger } from "../../../utils/services/activityLogger";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Create Teacher
 */
export const createTeacher = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = validateRequest(createTeacherSchema, req.body, res);
  if (!data) return;

  try {
    const teacher = await teacherService.createTeacher(data);
    sendResponse(res, 201, "Teacher created successfully", true, teacher);
  } catch (error: unknown) {
    if (error instanceof TeacherError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error creating teacher:", error);
    sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Get All Teachers
 */
export const getAllTeachers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, school_id, search, is_active } = req.query;

  try {
    const result = await teacherService.getAllTeachers(
      {
        search: search as string,
        school_id: school_id ? parseInt(school_id as string) : undefined,
        is_active: is_active === "true" ? true : is_active === "false" ? false : undefined,
      },
      {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
      },
      req.user?.role || "",
      req.user?.school_id ?? undefined
    );

    sendResponse(res, 200, "Teachers fetched successfully", true, {
      data: result.data,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error: unknown) {
    console.error("Error fetching teachers:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Get Teacher By ID
 */
export const getTeacherById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const teacher = await teacherService.getTeacherById(parseInt(id as string));
    sendResponse(res, 200, "Teacher fetched successfully", true, teacher);
  } catch (error: unknown) {
    if (error instanceof TeacherError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error fetching teacher:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Update Teacher
 */
export const updateTeacher = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const data = validateRequest(updateTeacherSchema, req.body, res);
  if (!data) return;

  try {
    const teacher = await teacherService.updateTeacher(
      parseInt(id as string),
      data
    );
    sendResponse(res, 200, "Teacher updated successfully", true, teacher);
  } catch (error: unknown) {
    if (error instanceof TeacherError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error updating teacher:", error);
    sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Delete Teacher
 */
export const deleteTeacher = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    await teacherService.deleteTeacher(parseInt(id as string));
    sendResponse(res, 200, "Teacher deleted successfully", true);
  } catch (error: unknown) {
    if (error instanceof TeacherError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error deleting teacher:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Bulk Upload Teachers
 */
export const bulkUploadTeachers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if file is uploaded
      if (!req.file) {
        sendResponse(res, 400, "No file uploaded", false);
        return;
      }

      const file = req.file;
      const fileName = file.originalname;

      // Validate file extension
      const validExtensions = [".csv", ".xlsx", ".xls"];
      const fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        sendResponse(
          res,
          400,
          "Invalid file format. Only CSV and XLSX files are allowed",
          false
        );
        return;
      }

      // Parse school_id from string to number if provided (form-data sends strings)
      const requestData = {
        school_id: req.body.school_id ? parseInt(req.body.school_id, 10) : undefined,
      };

      // Validate request body for school_id (optional, required for super admin)
      const data = validateRequest(bulkUploadTeacherSchema, requestData, res);
      if (!data) return;

      const schoolId = data.school_id || (req.user?.school_id ?? undefined);

      // Call bulk upload service
      const result = await teacherService.bulkUploadTeachers(
        file.buffer,
        fileName,
        req.user?.role || "",
        schoolId
      );

      await activityLogger.log(req, "CREATE", "teachers", {
        details: {
          fileName,
          successCount: result.success,
          errorCount: result.errors.length,
        },
      });

      sendResponse(
        res,
        201,
        `Bulk upload completed. ${result.success} teachers created successfully`,
        true,
        {
          success: result.success,
          errors: result.errors,
        }
      );
    } catch (error: unknown) {
      if (error instanceof TeacherError) {
        sendResponse(
          res,
          error.statusCode,
          error.message,
          false,
          error.data
        );
        return;
      }
      console.error("Error in bulk upload:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

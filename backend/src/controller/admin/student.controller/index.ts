import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { parseBoolean, parsePositiveInteger } from "../../../utils/helperFunctions/parsers";
import { validateRequest } from "../../../validations";
import {
  createStudentSchema,
  updateStudentSchema,
  bulkUploadStudentSchema,
} from "../../../validations/student.validation";
import { studentService, StudentError } from "../../../services";
import { activityLogger } from "../../../utils/services/activityLogger";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";


export const createStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Parse FormData: Convert string values to appropriate types
    const parsedBody = {
      email: typeof req.body?.email === "string" ? req.body.email.trim() : req.body?.email,
      name: typeof req.body?.name === "string" ? req.body.name.trim() : req.body?.name,
      school_id: parsePositiveInteger(req.body?.school_id),
      class_id: parsePositiveInteger(req.body?.class_id),
      section_id: req.body?.section_id ? parsePositiveInteger(req.body.section_id) : undefined,
    };

    const validated = validateRequest(createStudentSchema, parsedBody, res);
    if (!validated) {
      return;
    }

    try {
      const student = await studentService.createStudent(validated);

      await activityLogger.log(req, "CREATE", "students", {
        resourceId: student.id,
        resourceName: student.name || student.email,
        details: { email: student.email },
      });

      sendResponse(res, 201, "Student created successfully. Password has been sent to their email.", true, student);
    } catch (error: unknown) {
      if (error instanceof StudentError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error creating student:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

export const getAllStudents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, school_id, class_id, search, is_active } = req.query;

    try {
      const result = await studentService.getAllStudents(
        {
          search: search as string,
          school_id: school_id ? parseInt(school_id as string) : undefined,
          class_id: class_id ? parseInt(class_id as string) : undefined,
          is_active: is_active !== undefined ? is_active === "true" : undefined,
        },
        {
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 10,
        },
        req.user ? { id: req.user.id, role: req.user.role, school_id: req.user.school_id ?? undefined } : undefined
      );

      sendResponse(res, 200, "Students fetched successfully", true, {
        data: result.data,
        page: result.pagination.currentPage,
        limit: result.pagination.limit,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
      });
    } catch (error: unknown) {
      console.error("Error fetching students:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

export const getStudentById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const student = await studentService.getStudentWithDetails(parseInt(id as string));
      sendResponse(res, 200, "Student fetched successfully", true, student);
    } catch (error: unknown) {
      if (error instanceof StudentError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching student:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

export const updateStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    // Parse FormData: Convert string values to appropriate types
    const parsedBody = {
      name: typeof req.body?.name === "string" ? req.body.name.trim() : req.body?.name,
      class_id: req.body?.class_id ? parsePositiveInteger(req.body.class_id) : undefined,
      section_id: req.body?.section_id ? parsePositiveInteger(req.body.section_id) : undefined,
      // parseBoolean always returns boolean, so only pass if is_active is provided
      ...(req.body?.is_active !== undefined ? { is_active: parseBoolean(req.body.is_active) } : {}),
    };

    const validated = validateRequest(updateStudentSchema, parsedBody, res);
    if (!validated) {
      return;
    }

    try {
      const student = await studentService.updateStudent(
        parseInt(id as string),
        validated
      );

      await activityLogger.log(req, "UPDATE", "students", {
        resourceId: student.id,
        resourceName: student.name || student.email,
        details: validated,
      });

      sendResponse(res, 200, "Student updated successfully", true, student);
    } catch (error: unknown) {
      if (error instanceof StudentError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error updating student:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

export const deleteStudent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const studentId = parseInt(id as string);

    try {
      await studentService.deleteStudent(studentId);

      await activityLogger.log(req, "DELETE", "students", {
        resourceId: studentId,
      });

      sendResponse(res, 200, "Student deleted successfully", true);
    } catch (error: unknown) {
      if (error instanceof StudentError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error deleting student:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

export const bulkUploadStudents = asyncHandler(
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
      const validated = validateRequest(bulkUploadStudentSchema, requestData, res);
      if (!validated) {
        return;
      }

      const schoolId = validated.school_id || (req.user?.school_id ?? undefined);

      // Call bulk upload service
      const result = await studentService.bulkUploadStudents(
        file.buffer,
        fileName,
        req.user?.role || "",
        schoolId
      );

      await activityLogger.log(req, "CREATE", "students", {
        details: {
          fileName,
          successCount: result.success,
          errorCount: result.errors.length,
        },
      });

      sendResponse(
        res,
        201,
        `Bulk upload completed. ${result.success} students created successfully`,
        true,
        {
          success: result.success,
          errors: result.errors,
        }
      );
    } catch (error: unknown) {
      if (error instanceof StudentError) {
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

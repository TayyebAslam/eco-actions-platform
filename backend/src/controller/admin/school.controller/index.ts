import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createSchoolSchema,
  updateSchoolSchema,
} from "../../../validations/school.validation";
import { schoolService, SchoolError } from "../../../services";
import db from "../../../config/db";
import { TABLE } from "../../../utils/Database/table";
import { activityLogger } from "../../../utils/services/activityLogger";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Create School
 */
export const createSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = validateRequest(createSchoolSchema, req.body, res);
  if (!data) return;

  try {
    // Add logo path if uploaded
    const logoUrl = req.file ? "/schools/" + req.file.filename : undefined;
    const schoolData = { ...data, logo_url: logoUrl };

    const school = await schoolService.createSchool(schoolData, req.user?.role || "");

    await activityLogger.log(req, "CREATE", "schools", {
      resourceId: school.id,
      resourceName: school.name,
    });

    sendResponse(res, 201, "School created successfully", true, school);
  } catch (error: unknown) {
    if (error instanceof SchoolError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error creating school:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Get All Schools
 */
export const getAllSchools = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, search, subscription_status } = req.query;

  try {
    const result = await schoolService.getAllSchools(
      {
        search: search as string,
        subscription_status: subscription_status as string,
      },
      {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
      }
    );

    sendResponse(res, 200, "Schools fetched successfully", true, {
      data: result.data,
      page: result.pagination.currentPage,
      limit: result.pagination.limit,
      totalCount: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
    });
  } catch (error: unknown) {
    console.error("Error fetching schools:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Get School By ID
 */
export const getSchoolById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const school = await schoolService.getSchoolById(parseInt(id as string));
    sendResponse(res, 200, "School fetched successfully", true, school);
  } catch (error: unknown) {
    if (error instanceof SchoolError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error fetching school:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Update School
 */
export const updateSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const data = validateRequest(updateSchoolSchema, req.body, res);
  if (!data) return;

  try {
    const newLogoPath = req.file ? "/schools/" + req.file.filename : undefined;
    const school = await schoolService.updateSchool(
      parseInt(id as string),
      data,
      req.user?.role || "",
      newLogoPath
    );

    await activityLogger.log(req, "UPDATE", "schools", {
      resourceId: school.id,
      resourceName: school.name,
      details: data,
    });

    sendResponse(res, 200, "School updated successfully", true, school);
  } catch (error: unknown) {
    if (error instanceof SchoolError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error updating school:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Delete School
 */
export const deleteSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const schoolId = parseInt(id as string);

  try {
    await schoolService.deleteSchool(schoolId, req.user?.role || "");

    await activityLogger.log(req, "DELETE", "schools", {
      resourceId: schoolId,
    });

    sendResponse(res, 200, "School deleted successfully", true);
  } catch (error: unknown) {
    if (error instanceof SchoolError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error deleting school:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Toggle School Status
 */
export const toggleSchoolStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const schoolId = parseInt(id as string);

  try {
    const result = await schoolService.toggleStatus(schoolId, req.user?.role || "");
    const statusText = result.subscription_status === "active" ? "activated" : "deactivated";

    await activityLogger.log(req, "TOGGLE_STATUS", "schools", {
      resourceId: schoolId,
      details: { new_status: result.subscription_status },
    });

    sendResponse(res, 200, `School ${statusText} successfully`, true, result);
  } catch (error: unknown) {
    if (error instanceof SchoolError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error toggling school status:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Complete School Setup (Admin signup flow)
 */
export const completeSchoolSetup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Only admins can use this endpoint
  if (req.user?.role !== UserRole.ADMIN) {
    sendResponse(res, 403, "Only admins can complete school setup", false);
    return;
  }

  const data = validateRequest(createSchoolSchema, req.body, res);
  if (!data) return;

  try {
    // Get full user data with password_hash
    const fullUser = await db(TABLE.USERS).where("id", req.user.id).first();

    const logoPath = req.file ? "/schools/" + req.file.filename : undefined;
    const result = await schoolService.submitSchoolRequest(
      data,
      {
        id: req.user.id,
        email: req.user.email,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        password_hash: fullUser?.password_hash || "",
        school_id: req.user.school_id ?? undefined,
      },
      logoPath
    );
    sendResponse(
      res,
      201,
      "School registration request submitted successfully. Please wait for admin approval.",
      true,
      result
    );
  } catch (error: unknown) {
    if (error instanceof SchoolError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error("Error submitting school setup request:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});
export const getAllSchoolsids = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await schoolService.getAllSchoolswithName();
    sendResponse(res, 200, "School IDs fetched successfully", true, result);
  } catch (error: unknown) {
    console.error("Error fetching school IDs:", error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});
import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  createJobTitleSchema,
  updateJobTitleSchema,
} from "../../../validations/jobTitle.validation";
import jobTitleService from "../../../services/jobTitle.service";

/**
 * Create a new Job Title
 * Only SuperAdmin/SuperSubAdmin can create job titles
 */
export const createJobTitle = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validated = validateRequest(createJobTitleSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { name, description, scope } = validated;

      // Get requester info
      const requesterRole = req.user?.role;
      const requesterId = req.user?.id;

      // Create job title
      const newJobTitle = await jobTitleService.createJobTitle(
        name,
        description,
        scope,
        requesterRole!,
        requesterId!
      );

      sendResponse(res, 201, "Job title created successfully", true, newJobTitle);
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message: string };
      const statusCode = err.statusCode || 500;
      sendResponse(res, statusCode, err.message, false);
      return;
    }
  }
);

/**
 * Get all Job Titles with pagination
 * SuperAdmin: Can see all job titles
 * Admin: Can see all job titles (read-only)
 */
export const getAllJobTitles = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, search, scope } = req.query;

      // Get requester info
      const requesterRole = req.user?.role;

      const filters = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        search: search as string,
        scope: scope as "global" | "school" | "all",
      };

      const result = await jobTitleService.getAllJobTitles(
        filters,
        requesterRole!
      );

      sendResponse(res, 200, "Job titles fetched successfully", true, result);
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message: string };
      const statusCode = err.statusCode || 500;
      sendResponse(res, statusCode, err.message, false);
      return;
    }
  }
);

/**
 * Get Job Title by ID
 */
export const getJobTitleById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        sendResponse(res, 400, "Job title ID is required", false);
        return;
      }

      const jobTitleId = parseInt(id, 10);
      if (isNaN(jobTitleId)) {
        sendResponse(res, 400, "Invalid job title ID", false);
        return;
      }

      // Get requester info
      const requesterRole = req.user?.role;

      const jobTitle = await jobTitleService.getJobTitleById(
        jobTitleId,
        requesterRole!
      );

      sendResponse(res, 200, "Job title fetched successfully", true, jobTitle);
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message: string };
      const statusCode = err.statusCode || 500;
      sendResponse(res, statusCode, err.message, false);
      return;
    }
  }
);

/**
 * Update Job Title
 * Only SuperAdmin/SuperSubAdmin can update
 */
export const updateJobTitle = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        sendResponse(res, 400, "Job title ID is required", false);
        return;
      }

      const jobTitleId = parseInt(id, 10);
      if (isNaN(jobTitleId)) {
        sendResponse(res, 400, "Invalid job title ID", false);
        return;
      }

      // Validate request body
      const validated = validateRequest(updateJobTitleSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { name, description, scope } = validated;

      // Get requester info
      const requesterRole = req.user?.role;

      const updatedJobTitle = await jobTitleService.updateJobTitle(
        jobTitleId,
        { name, description, scope },
        requesterRole!
      );

      sendResponse(res, 200, "Job title updated successfully", true, updatedJobTitle);
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message: string };
      const statusCode = err.statusCode || 500;
      sendResponse(res, statusCode, err.message, false);
      return;
    }
  }
);

/**
 * Delete Job Title
 * Only SuperAdmin/SuperSubAdmin can delete
 */
export const deleteJobTitle = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        sendResponse(res, 400, "Job title ID is required", false);
        return;
      }

      const jobTitleId = parseInt(id, 10);
      if (isNaN(jobTitleId)) {
        sendResponse(res, 400, "Invalid job title ID", false);
        return;
      }

      // Get requester info
      const requesterRole = req.user?.role;
      const force = req.query.force === "true";

      await jobTitleService.deleteJobTitle(jobTitleId, requesterRole!, force);

      sendResponse(res, 200, "Job title deleted successfully", true);
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message: string };
      const statusCode = err.statusCode || 500;
      sendResponse(res, statusCode, err.message, false);
      return;
    }
  }
);

/**
 * Get Job Titles for Dropdown
 * Returns simplified list of job titles visible to the requester
 */
export const getJobTitlesForDropdown = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Get requester info
      const requesterRole = req.user?.role;

      const jobTitles = await jobTitleService.getJobTitlesForDropdown(
        requesterRole!
      );

      sendResponse(res, 200, "Job titles for dropdown fetched successfully", true, jobTitles);
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message: string };
      const statusCode = err.statusCode || 500;
      sendResponse(res, statusCode, err.message, false);
      return;
    }
  }
);

import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  getAuditLogsSchema,
  getAuditLogByIdSchema,
} from "../../../validations/auditLog.validation";
import { auditLogService, AuditLogError } from "../../../services";
import { AuditLogFilters } from "../../../services/auditLog.service";
import { UserRole } from "../../../utils/enums/users.enum";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

export const getAuditLogs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(getAuditLogsSchema, req.query, res);
    if (!data) return;

    const {
      page,
      limit,
      search,
      user_id,
      action,
      module,
      status,
      start_date,
      end_date,
    } = data;

    try {
      const user = req.user;

      // Access control: Admin can only see their school's logs
      // Super Admin can see all logs
      if (user?.role !== UserRole.SUPER_ADMIN && user?.role !== UserRole.SUPER_SUB_ADMIN) {
        if (!user?.school_id) {
          sendResponse(res, 403, "Access denied: No school associated with user", false);
          return;
        }
      }

      const filters: AuditLogFilters = {
        search,
        user_id,
        action,
        module,
        status,
        start_date,
        end_date,
        exclude_user_id: user?.id, // Exclude current user's own actions
      };

      // Apply school filter for non-super-admin users
      if (user?.role !== UserRole.SUPER_ADMIN && user?.role !== UserRole.SUPER_SUB_ADMIN) {
        filters.school_id = user?.school_id ?? undefined;
      }

      const result = await auditLogService.getAll(filters, {
        page: page || 1,
        limit: limit || 10,
      });

      sendResponse(res, 200, "Audit logs fetched successfully", true, {
        data: result.data,
        page: result.pagination.currentPage,
        limit: result.pagination.limit,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
      });
    } catch (error: unknown) {
      if (error instanceof AuditLogError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching audit logs:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

export const getAuditLogById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(getAuditLogByIdSchema, req.params, res);
    if (!data) return;

    const { id } = data;

    try {
      const user = req.user;
      const log = await auditLogService.getById(id);

      if (!log) {
        sendResponse(res, 404, "Audit log not found", false);
        return;
      }

      // Access control: Admin can only see their school's logs
      if (user?.role !== UserRole.SUPER_ADMIN && user?.role !== UserRole.SUPER_SUB_ADMIN) {
        // User must have a school_id to access logs
        if (!user?.school_id) {
          sendResponse(res, 403, "Access denied: No school associated with user", false);
          return;
        }
        // Log must belong to user's school (or be a system-level log with null school_id created by their school's user)
        if (log.school_id !== null && log.school_id !== user.school_id) {
          sendResponse(res, 403, "Access denied", false);
          return;
        }
      }

      sendResponse(res, 200, "Audit log fetched successfully", true, log);
    } catch (error: unknown) {
      if (error instanceof AuditLogError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching audit log:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

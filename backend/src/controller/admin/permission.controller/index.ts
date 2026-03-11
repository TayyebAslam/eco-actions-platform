import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { parseBoolean, parsePositiveInteger } from "../../../utils/helperFunctions/parsers";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import { updateUserPermissionsSchema } from "../../../validations/permission.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { emitPermissionsUpdated } from "../../../utils/services/socket";
import { invalidatePermissions } from "../../../utils/services/redis/cacheInvalidation";
import { activityLogger } from "../../../utils/services/activityLogger";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Get all modules
 * GET /admin/modules
 */
export const getAllModules = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const modules = await db(TABLE.MODULES).select("*").orderBy("id");
      sendResponse(res, 200, "Modules fetched successfully", true, modules);
    } catch (error: unknown) {
      console.error("Error fetching modules:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Get user permissions
 * GET /admin/users/:id/permissions
 */
export const getUserPermissions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = parseInt(Array.isArray(id) ? id[0] ?? "" : id ?? "");

      // Verify user exists
      const user = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, userId)
        .first();

      if (!user) {
        sendResponse(res, 404, "User not found", false);
        return;
      }

      // Check if requester can view this user's permissions
      const requesterRole = req.user?.role;

      // Super Admin can view anyone's permissions
      // Super Sub-Admin can only view Super Sub-Admin's permissions
      if (requesterRole === UserRole.SUPER_SUB_ADMIN && user.role !== UserRole.SUPER_SUB_ADMIN) {
        sendResponse(res, 403, "You can only view Super Sub-Admin permissions", false);
        return;
      }
      // Admin can only view Sub-Admin's permissions
      if (requesterRole === UserRole.ADMIN && user.role !== UserRole.SUB_ADMIN) {
        sendResponse(res, 403, "You can only view Sub-Admin permissions", false);
        return;
      }

      // Get all modules with user's permissions (LEFT JOIN to include modules without permissions)
      const modulesWithPermissions = await db(TABLE.MODULES)
        .leftJoin(TABLE.PERMISSIONS, function () {
          this.on(`${TABLE.MODULES}.id`, "=", `${TABLE.PERMISSIONS}.module_id`)
            .andOn(`${TABLE.PERMISSIONS}.user_id`, "=", db.raw("?", [userId]));
        })
        .select(
          `${TABLE.MODULES}.id as module_id`,
          `${TABLE.MODULES}.name`,
          `${TABLE.MODULES}.key`,
          `${TABLE.MODULES}.scope`,
          db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_create, false) as can_create`),
          db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_read, false) as can_read`),
          db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_edit, false) as can_edit`),
          db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_delete, false) as can_delete`)
        )
        .orderBy(`${TABLE.MODULES}.id`);

      sendResponse(res, 200, "User permissions fetched successfully", true, {
        user_id: userId,
        role: user.role,
        permissions: modulesWithPermissions,
      });
    } catch (error: unknown) {
      console.error("Error fetching user permissions:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Update user permissions
 * PUT /admin/users/:id/permissions
 */
export const updateUserPermissions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = parseInt(Array.isArray(id) ? id[0] ?? "" : id ?? "");

      // Validate userId from params
      if (Number.isNaN(userId) || userId <= 0) {
        sendResponse(res, 400, "Invalid user ID format", false);
        return;
      }

      // Validate permissions array exists and is not empty
      if (!Array.isArray(req.body?.permissions) || req.body.permissions.length === 0) {
        sendResponse(res, 400, "Permissions array is required and cannot be empty", false);
        return;
      }

      // Parse and validate FormData: Convert string values to appropriate types
      const parsedBody = {
        permissions: req.body.permissions.map((perm: Record<string, unknown>) => ({
          module_id: parsePositiveInteger(perm.module_id),
          can_create: parseBoolean(perm.can_create),
          can_read: parseBoolean(perm.can_read),
          can_edit: parseBoolean(perm.can_edit),
          can_delete: parseBoolean(perm.can_delete),
        })),
      };

      // Validate request body against schema
      const validated = validateRequest(updateUserPermissionsSchema, parsedBody, res);
      if (!validated) {
        return;
      }

      const { permissions } = validated;

      // Check for duplicate module_ids in the permissions array
      const moduleIds = new Set(permissions.map((p) => p.module_id));
      if (moduleIds.size !== permissions.length) {
        sendResponse(res, 400, "Duplicate module IDs found in permissions", false);
        return;
      }

      // Verify user exists
      const user = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, userId)
        .first();

      if (!user) {
        sendResponse(res, 404, "User not found", false);
        return;
      }

      // Check permission hierarchy
      const requesterRole = req.user?.role;

      // Super Admin can update anyone's permissions (Super Sub-Admin, Admin or Sub-Admin)
      if (requesterRole === UserRole.SUPER_ADMIN) {
        if (
          user.role !== UserRole.SUPER_SUB_ADMIN &&
          user.role !== UserRole.ADMIN &&
          user.role !== UserRole.SUB_ADMIN
        ) {
          sendResponse(res, 400, "Permissions can only be set for admin roles", false);
          return;
        }
      }
      // Super Sub-Admin can only update Super Sub-Admin permissions
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        if (user.role !== UserRole.SUPER_SUB_ADMIN) {
          sendResponse(res, 403, "Super Sub-Admins can only update Super Sub-Admin permissions", false);
          return;
        }
      }
      // Admin can only update Sub-Admin permissions
      else if (requesterRole === UserRole.ADMIN) {
        if (user.role !== UserRole.SUB_ADMIN) {
          sendResponse(res, 403, "Admins can only update Sub-Admin permissions", false);
          return;
        }
      }
      // Sub-Admin cannot update permissions
      else {
        sendResponse(res, 403, "You don't have permission to update user permissions", false);
        return;
      }

      // Use transaction to update permissions
      await db.transaction(async (trx) => {
        // Delete existing permissions for this user
        await trx(TABLE.PERMISSIONS).where({ user_id: userId }).del();

        // Insert new permissions
        const permissionRecords = permissions.map((p) => ({
          user_id: userId,
          module_id: p.module_id,
          can_create: p.can_create,
          can_read: p.can_read,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }));

        if (permissionRecords.length > 0) {
          await trx(TABLE.PERMISSIONS).insert(permissionRecords);
        }
      });

      // Clear Redis cache for this user's permissions
      await invalidatePermissions(userId);

      // Fetch updated permissions with module keys for socket emit
      const updatedPermissions = await db(TABLE.PERMISSIONS)
        .join(TABLE.MODULES, `${TABLE.PERMISSIONS}.module_id`, `${TABLE.MODULES}.id`)
        .where({ user_id: userId })
        .select(
          `${TABLE.PERMISSIONS}.module_id`,
          `${TABLE.MODULES}.key as module_key`,
          `${TABLE.PERMISSIONS}.can_create`,
          `${TABLE.PERMISSIONS}.can_read`,
          `${TABLE.PERMISSIONS}.can_edit`,
          `${TABLE.PERMISSIONS}.can_delete`
        );

      // Emit real-time permission update to the user
      emitPermissionsUpdated(userId, updatedPermissions);

      await activityLogger.log(req, "PERMISSION_UPDATE", "permissions", {
        resourceId: userId,
        resourceName: user.email,
        details: {
          target_role: user.role,
          permissions_count: permissions.length,
        },
      });

      sendResponse(res, 200, "Permissions updated successfully", true);
    } catch (error: unknown) {
      console.error("Error updating user permissions:", error);
      await activityLogger.log(req, "PERMISSION_UPDATE", "permissions", {
        resourceId: parseInt(req.params.id as string),
        status: "failure",
        errorMessage: getErrorMessage(error),
      });
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import { updateRoleDisplayNameSchema } from "../../../validations/role.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Get all roles
 * Accessible by Super Admin and Super Sub-Admin
 */
export const getAllRoles = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Super Admin and Super Sub-Admin can view roles
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.SUPER_SUB_ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to view roles",
          false
        );
        return;
      }

      // Fetch all roles
      const roles = await db(TABLE.ROLES)
        .select("id", "name", "display_name", "created_at")
        .orderBy("id", "asc");

      sendResponse(res, 200, "Roles fetched successfully", true, roles);
      return;
    } catch (error: unknown) {
      console.error("Error fetching roles:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Update role display name
 * Only Super Admin can access this
 */
export const updateRoleDisplayName = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Only Super Admin can update role display names
      const requesterRole = req.user?.role;

      if (requesterRole !== UserRole.SUPER_ADMIN) {
        sendResponse(
          res,
          403,
          "Only Super Admin can update role display names",
          false
        );
        return;
      }

      const { id } = req.params;

      // Validate request body
      const data = validateRequest(updateRoleDisplayNameSchema, req.body, res);
      if (!data) return;

      const { display_name } = data;

      // Check if role exists
      const role = await db(TABLE.ROLES).where({ id }).first();

      if (!role) {
        sendResponse(res, 404, "Role not found", false);
        return;
      }

      // Update role display name
      await db(TABLE.ROLES).where({ id }).update({ display_name });

      // Fetch updated role
      const updatedRole = await db(TABLE.ROLES)
        .select("id", "name", "display_name", "created_at")
        .where({ id })
        .first();

      sendResponse(res, 200, "Role display name updated successfully", true, updatedRole);
      return;
    } catch (error: unknown) {
      console.error("Error updating role display name:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

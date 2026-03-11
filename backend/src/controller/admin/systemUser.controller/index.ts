import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import bcrypt from "bcryptjs";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createSystemUserSchema,
  updateSystemUserSchema,
  changeSystemUserPasswordSchema,
} from "../../../validations/systemUser.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { sendWelcomeEmail } from "../../../utils/services/nodemailer/welcomeEmail";
import { insertDefaultPermissions } from "../../../middlewares/permissionMiddleware";
import jobTitleService from "../../../services/jobTitle.service";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { generatePassword } from "../../../utils/helperFunctions/passwordHelper";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";
import logger from "../../../utils/logger";

type StaffInsert = {
  user_id: number;
  school_id: number | null;
  job_title: string;
  created_by?: number | null | undefined;
  job_title_id?: number | null;
};

type StaffUpdate = {
  job_title_id: number | null;
};

/**
 * Create a new System User
 * - Super Admin creates: Super Sub-Admin (global, no school)
 * - Super Sub-Admin creates: Sub-Admin (global, no school)
 * - Admin creates: Sub-Admin (scoped to Admin's school)
 */
export const createSystemUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validated = validateRequest(createSystemUserSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { first_name, last_name, email, job_title_id } = validated;

      // Auto-generate a strong password
      const password = generatePassword();

      // Determine role and school based on requester
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;

      // Determine target role and school for new system user
      let targetRole: UserRole;
      let targetSchoolId: number | null;
      let jobTitle: string;

      if (requesterRole === UserRole.SUPER_ADMIN) {
        // Super Admin creates Super Sub-Admin (global)
        targetRole = UserRole.SUPER_SUB_ADMIN;
        targetSchoolId = null;
        jobTitle = "System Administrator";
      } else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        // Super Sub-Admin creates Sub-Admin (global)
        targetRole = UserRole.SUB_ADMIN;
        targetSchoolId = null;
        jobTitle = "Sub Administrator";
      } else if (requesterRole === UserRole.ADMIN) {
        // Admin creates Sub-Admin (school-scoped)
        targetRole = UserRole.SUB_ADMIN;
        targetSchoolId = requesterSchoolId ?? null;
        jobTitle = "Sub Administrator";
        
        if (!targetSchoolId) {
          sendResponse(res, 400, "Admin must have a school assigned", false);
          return;
        }
      } else {
        sendResponse(res, 403, "Only Super Admin, Super Sub-Admin, or Admin can create System Users", false);
        return;
      }

      // Check if email already exists (exclude soft-deleted users)
      const existingUser = await db(TABLE.USERS)
        .where({ email })
        .where("is_deleted", false)
        .first();

      if (existingUser) {
        sendResponse(res, 400, "Email already exists", false);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Get Role ID for the target role
      const roleRecord = await db(TABLE.ROLES)
        .where({ name: targetRole })
        .first();

      if (!roleRecord) {
        sendResponse(res, 400, `${targetRole} role not found`, false);
        return;
      }

      // Validate job title if provided
      if (job_title_id) {
        await jobTitleService.validateJobTitleAssignment(job_title_id, targetRole);
      }

      // Use transaction for database operations
      let newUser: { id: number; email: string; first_name: string; last_name: string; is_active: boolean; created_at: string; [key: string]: unknown } | undefined;

      try {
        // Start transaction
        await db.transaction(async (trx) => {
          // Create new System User
          const [createdUser] = await trx(TABLE.USERS)
            .insert({
              email,
              password_hash: hashedPassword,
              first_name,
              last_name,
              role_id: roleRecord.id,
              is_active: true,
              school_id: targetSchoolId,
            })
            .returning(["id", "email", "first_name", "last_name", "is_active", "created_at"]);
          newUser = createdUser;

          // Create staff record for system user
          const staffData: StaffInsert = {
            user_id: createdUser.id,
            school_id: targetSchoolId,
            job_title: jobTitle,
            created_by: req.user?.id ?? null,
            job_title_id: job_title_id ?? null,
          };

          await trx(TABLE.STAFF).insert(staffData);

          // Insert default permissions for the new System User
          await insertDefaultPermissions(
            createdUser.id,
            targetRole,
            trx
          );

          // Send welcome email with credentials (non-blocking)
          try {
            await sendWelcomeEmail({
              email,
              password,
              first_name,
              last_name,
              role: targetRole,
            });
            logger.info(`Welcome email sent to ${email}`);
          } catch (emailError: unknown) {
            logger.error(`Failed to send welcome email: ${getErrorMessage(emailError)}`);
          }
        });

        if (!newUser) {
          throw new Error("Failed to create user");
        }

        // Fetch staff record with job title information
        const staffRecord = await db(TABLE.STAFF)
          .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
          .select(
            `${TABLE.STAFF}.job_title_id`,
            `${TABLE.STAFF}.school_id`,
            `${TABLE.JOB_TITLES}.name as job_title_name`
          )
          .where(`${TABLE.STAFF}.user_id`, newUser.id)
          .first();

        // Transaction committed successfully
        const responseUser = {
          id: newUser.id,
          email: newUser.email,
          first_name,
          last_name,
          role: targetRole,
          is_active: newUser.is_active,
          school_id: staffRecord?.school_id || null,
          job_title_id: staffRecord?.job_title_id || null,
          job_title_name: staffRecord?.job_title_name || null,
          created_at: newUser.created_at,
        };

        sendResponse(
          res,
          201,
          "System User created successfully",
          true,
          responseUser
        );
        return;
      } catch (transactionError: unknown) {
        logger.error("Transaction failed:", transactionError);
        sendResponse(
          res,
          500,
          "Failed to create System User",
          false
        );
        return;
      }
    } catch (error: unknown) {
      logger.error("Error creating System User:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Get all System Users with pagination
 * - Super Admin: views all Super Sub-Admins and Sub-Admins (all system users)
 * - Super Sub-Admin: views all Sub-Admins (all schools)
 * - Admin: views Sub-Admins from their school only
 */
export const getAllSystemUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;

      const { page, limit, search } = req.query;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;
      const searchTerm = (search as string) || "";

      // Fetch System Users
      let query = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
        .leftJoin(`${TABLE.SCHOOLS} as school`, `${TABLE.STAFF}.school_id`, `school.id`)
        .where(`${TABLE.USERS}.is_deleted`, false) // Exclude soft-deleted users
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`,
          `${TABLE.USERS}.created_at`,
          `${TABLE.ROLES}.name as role`,
          `${TABLE.STAFF}.school_id`,
          `school.name as school_name`,
          `${TABLE.STAFF}.job_title_id`,
          `${TABLE.JOB_TITLES}.name as job_title_name`
        );

      // Super Admin sees both Super Sub-Admins and Sub-Admins
      if (requesterRole === UserRole.SUPER_ADMIN) {
        query = query.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      }
      // Super Sub-Admin sees only Sub-Admins (all schools)
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        query = query.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      }
      // Admin sees only Sub-Admins from their school
      else if (requesterRole === UserRole.ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        query = query
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      } else {
        sendResponse(res, 403, "Access denied", false);
        return;
      }

      // Search filter - search in first_name, last_name, email
      if (searchTerm) {
        const safeTerm = buildSearchTerm(searchTerm);
        query = query.where(function () {
          this.where(`${TABLE.USERS}.first_name`, "ilike", safeTerm)
            .orWhere(`${TABLE.USERS}.last_name`, "ilike", safeTerm)
            .orWhere(`${TABLE.USERS}.email`, "ilike", safeTerm);
        });
      }

      const systemUsers = await query
        .offset(skip)
        .limit(pageLimit)
        .orderBy(`${TABLE.USERS}.created_at`, "desc");

      // Get total count with same filters
      let countQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .where(`${TABLE.USERS}.is_deleted`, false);

      // Apply same role filters as main query
      if (requesterRole === UserRole.SUPER_ADMIN) {
        countQuery = countQuery.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      } else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        countQuery = countQuery.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      } else if (requesterRole === UserRole.ADMIN && requesterSchoolId) {
        countQuery = countQuery
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      }

      // Apply search filter to count query
      if (searchTerm) {
        const safeTerm = buildSearchTerm(searchTerm);
        countQuery = countQuery.where(function () {
          this.where(`${TABLE.USERS}.first_name`, "ilike", safeTerm)
            .orWhere(`${TABLE.USERS}.last_name`, "ilike", safeTerm)
            .orWhere(`${TABLE.USERS}.email`, "ilike", safeTerm);
        });
      }

      const totalCountResult = await countQuery.count({ count: "*" });

      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: systemUsers,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "System Users fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      logger.error("Error fetching System Users:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Get System User by ID
 * - Super Admin: views both Super Sub-Admins and Sub-Admins
 * - Super Sub-Admin: views Sub-Admins only
 * - Admin: views Sub-Admins from their school only
 */
export const getSystemUserById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;
      const { id } = req.params;

      // Fetch System User by ID
      let query = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
        .leftJoin(`${TABLE.SCHOOLS} as school`, `${TABLE.STAFF}.school_id`, `school.id`)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`,
          `${TABLE.USERS}.created_at`,
          `${TABLE.ROLES}.name as role`,
          `${TABLE.STAFF}.school_id`,
          `school.name as school_name`,
          `${TABLE.STAFF}.job_title_id`,
          `${TABLE.JOB_TITLES}.name as job_title_name`
        )
        .where(`${TABLE.USERS}.id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false); // Exclude soft-deleted users

      // Super Admin can view both Super Sub-Admins and Sub-Admins
      if (requesterRole === UserRole.SUPER_ADMIN) {
        query = query.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      }
      // Super Sub-Admin can only view Sub-Admins
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        query = query.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      }
      // Admin can only view Sub-Admins from their school
      else if (requesterRole === UserRole.ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        query = query
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      } else {
        sendResponse(res, 403, "Access denied", false);
        return;
      }

      const systemUser = await query.first();

      if (!systemUser) {
        sendResponse(res, 404, "System User not found", false);
        return;
      }

      sendResponse(res, 200, "System User fetched successfully", true, systemUser);
      return;
    } catch (error: unknown) {
      logger.error("Error fetching System User:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Update System User
 * - Super Admin: updates both Super Sub-Admins and Sub-Admins
 * - Super Sub-Admin: updates Sub-Admins only
 * - Admin: updates Sub-Admins from their school only
 */
export const updateSystemUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;
      const { id } = req.params;

      // Validate request body
      const validated = validateRequest(updateSystemUserSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { first_name, last_name, email, is_active, job_title_id } = validated;

      // Check if System User exists
      let existingUserQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`, `${TABLE.STAFF}.school_id`)
        .where(`${TABLE.USERS}.id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false); // Exclude soft-deleted users

      // Super Admin can update both Super Sub-Admins and Sub-Admins
      if (requesterRole === UserRole.SUPER_ADMIN) {
        existingUserQuery = existingUserQuery.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      }
      // Super Sub-Admin can only update Sub-Admins
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        existingUserQuery = existingUserQuery.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      }
      // Admin can only update Sub-Admins from their school
      else if (requesterRole === UserRole.ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        existingUserQuery = existingUserQuery
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      } else {
        sendResponse(res, 403, "Access denied", false);
        return;
      }

      const existingUser = await existingUserQuery.first();

      if (!existingUser) {
        sendResponse(res, 404, "System User not found", false);
        return;
      }

      // Check if email is unique (if updating email)
      if (email) {
        const emailExists = await db(TABLE.USERS)
          .where({ email })
          .whereNot("id", id)
          .where("is_deleted", false) // Exclude soft-deleted users
          .first();

        if (emailExists) {
          sendResponse(res, 400, "Email already exists", false);
          return;
        }
      }

      // Validate job title if provided
      if (job_title_id !== undefined && job_title_id !== null) {
        await jobTitleService.validateJobTitleAssignment(job_title_id, existingUser.role);
      }

      // Update users table and staff table in a transaction
      await db.transaction(async (trx) => {
        const userUpdateData: Record<string, unknown> = {};
        if (email) userUpdateData.email = email;
        if (first_name) userUpdateData.first_name = first_name;
        if (last_name) userUpdateData.last_name = last_name;
        if (is_active !== undefined) userUpdateData.is_active = is_active;

        if (Object.keys(userUpdateData).length > 0) {
          await trx(TABLE.USERS).where({ id }).update(userUpdateData);
        }

        // Update staff table for job_title_id (single consolidated block)
        if (job_title_id !== undefined) {
          const staffUpdateData: StaffUpdate = { job_title_id: job_title_id ?? null };

          // Check if staff record exists, create if not
          const existingStaff = await trx(TABLE.STAFF).where({ user_id: id }).first();
          if (existingStaff) {
            await trx(TABLE.STAFF).where({ user_id: id }).update(staffUpdateData);
          } else {
            // Create staff record if it doesn't exist
            // Use existing user's role to determine job title and school
            const jobTitleForStaff = existingUser.role === UserRole.SUPER_SUB_ADMIN ? "System Administrator" : "Sub Administrator";
            const schoolIdForStaff = existingUser.school_id;
            await trx(TABLE.STAFF).insert({
              user_id: id,
              school_id: schoolIdForStaff,
              job_title: jobTitleForStaff,
              job_title_id: job_title_id ?? null,
              created_by: req.user?.id,
            });
          }
        }
      });

      // Fetch updated System User
      const updatedUser = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
        .leftJoin(`${TABLE.SCHOOLS} as school`, `${TABLE.STAFF}.school_id`, `school.id`)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`,
          `${TABLE.ROLES}.name as role`,
          `${TABLE.STAFF}.school_id`,
          `school.name as school_name`,
          `${TABLE.STAFF}.job_title_id`,
          `${TABLE.JOB_TITLES}.name as job_title_name`
        )
        .where(`${TABLE.USERS}.id`, id)
        .first();

      sendResponse(res, 200, "System User updated successfully", true, updatedUser);
      return;
    } catch (error: unknown) {
      logger.error("Error updating System User:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Delete System User
 * - Super Admin: deletes both Super Sub-Admins and Sub-Admins
 * - Super Sub-Admin: deletes Sub-Admins only
 * - Admin: deletes Sub-Admins from their school only
 */
export const deleteSystemUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;
      const { id } = req.params;

      // Check if System User exists
      let systemUserQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`, `${TABLE.STAFF}.school_id`)
        .where(`${TABLE.USERS}.id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false); // Exclude soft-deleted users

      // Super Admin can delete both Super Sub-Admins and Sub-Admins
      if (requesterRole === UserRole.SUPER_ADMIN) {
        systemUserQuery = systemUserQuery.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      }
      // Super Sub-Admin can only delete Sub-Admins
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        systemUserQuery = systemUserQuery.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      }
      // Admin can only delete Sub-Admins from their school
      else if (requesterRole === UserRole.ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        systemUserQuery = systemUserQuery
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      } else {
        sendResponse(res, 403, "Access denied", false);
        return;
      }

      const systemUser = await systemUserQuery.first();

      if (!systemUser) {
        sendResponse(res, 404, "System User not found", false);
        return;
      }

      // Soft delete: set is_deleted = true and deleted_at timestamp
      await db(TABLE.USERS)
        .where("id", id)
        .update({
          is_deleted: true,
          deleted_at: db.fn.now(),
        });

      sendResponse(res, 200, "System User deleted successfully", true);
      return;
    } catch (error: unknown) {
      logger.error("Error deleting System User:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Toggle System User status (activate/deactivate)
 * - Super Admin: toggles both Super Sub-Admins and Sub-Admins
 * - Super Sub-Admin: toggles Sub-Admins only
 * - Admin: toggles Sub-Admins from their school only
 */
export const toggleSystemUserStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;
      const { id } = req.params;

      // Check if System User exists
      let systemUserQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`, `${TABLE.STAFF}.school_id`)
        .where(`${TABLE.USERS}.id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false); // Exclude soft-deleted users

      // Super Admin can toggle both Super Sub-Admins and Sub-Admins
      if (requesterRole === UserRole.SUPER_ADMIN) {
        systemUserQuery = systemUserQuery.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      }
      // Super Sub-Admin can only toggle Sub-Admins
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        systemUserQuery = systemUserQuery.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      }
      // Admin can only toggle Sub-Admins from their school
      else if (requesterRole === UserRole.ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        systemUserQuery = systemUserQuery
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      } else {
        sendResponse(res, 403, "Access denied", false);
        return;
      }

      const systemUser = await systemUserQuery.first();

      if (!systemUser) {
        sendResponse(res, 404, "System User not found", false);
        return;
      }

      // Toggle status
      const newStatus = !systemUser.is_active;
      await db(TABLE.USERS).where("id", id).update({ is_active: newStatus });

      sendResponse(
        res,
        200,
        `System User ${newStatus ? "activated" : "deactivated"} successfully`,
        true,
        { is_active: newStatus }
      );
      return;
    } catch (error: unknown) {
      logger.error("Error toggling System User status:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Change System User password
 * - Super Admin: changes passwords for both Super Sub-Admins and Sub-Admins
 * - Super Sub-Admin: changes passwords for Sub-Admins only
 * - Admin: changes Sub-Admin passwords from their school only
 */
export const changeSystemUserPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const requesterSchoolId = req.user?.school_id;
      const { id } = req.params;

      // Validate request body
      const validated = validateRequest(
        changeSystemUserPasswordSchema,
        req.body,
        res
      );
      if (!validated) {
        return;
      }

      const { password } = validated;

      // Check if System User exists
      let systemUserQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`, `${TABLE.STAFF}.school_id`)
        .where(`${TABLE.USERS}.id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false); // Exclude soft-deleted users

      // Super Admin can change passwords for both Super Sub-Admins and Sub-Admins
      if (requesterRole === UserRole.SUPER_ADMIN) {
        systemUserQuery = systemUserQuery.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      }
      // Super Sub-Admin can only change passwords for Sub-Admins
      else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        systemUserQuery = systemUserQuery.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      }
      // Admin can only change passwords for Sub-Admins from their school
      else if (requesterRole === UserRole.ADMIN) {
        if (!requesterSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        systemUserQuery = systemUserQuery
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      } else {
        sendResponse(res, 403, "Access denied", false);
        return;
      }

      const systemUser = await systemUserQuery.first();

      if (!systemUser) {
        sendResponse(res, 404, "System User not found", false);
        return;
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(password, 10);
      await db(TABLE.USERS).where("id", id).update({ password_hash: hashedPassword });

      sendResponse(res, 200, "System User password changed successfully", true);
      return;
    } catch (error: unknown) {
      logger.error("Error changing System User password:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

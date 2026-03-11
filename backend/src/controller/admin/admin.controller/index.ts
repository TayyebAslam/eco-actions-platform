import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import bcrypt from "bcryptjs";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { generatePassword } from "../../../utils/helperFunctions/passwordHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createAdminSchema,
  updateAdminSchema,
  changeAdminPasswordSchema,
} from "../../../validations/admin.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { sendWelcomeEmail } from "../../../utils/services/nodemailer/welcomeEmail";
import { insertDefaultPermissions } from "../../../middlewares/permissionMiddleware";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";

/**
 * Create a new admin (school_admin or sub_admin)
 * Only Super Admin can access this
 */
export const createAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validated = validateRequest(createAdminSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { first_name, last_name, email, role, school_id, job_title_id } = validated;
      const password = generatePassword();

      // Permission check: Super Admin can create admin/sub_admin, Admin can only create sub_admin
      const requesterRole = req.user?.role;

      if (requesterRole === UserRole.SUB_ADMIN) {
        sendResponse(res, 403, "Sub-Admins cannot create admin users", false);
        return;
      }

      if (requesterRole === UserRole.ADMIN && role === UserRole.ADMIN) {
        sendResponse(
          res,
          403,
          "Admins can only create Sub-Admins, not other Admins",
          false
        );
        return;
      }

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to create admins",
          false
        );
        return;
      }

      // Check if email already exists
      const existingUser = await db(TABLE.USERS).where({ email }).first();

      if (existingUser) {
        sendResponse(res, 400, "Email already exists", false);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Get Role ID (no mapping needed, database has "admin" and "sub_admin")
      const roleRecord = await db(TABLE.ROLES).where({ name: role }).first();

      if (!roleRecord) {
        sendResponse(res, 400, "Invalid role", false);
        return;
      }

      // Use transaction for database operations
      let newUser: { id: number; email: string; first_name: string; last_name: string; is_active: boolean; created_at: string; [key: string]: unknown } | undefined;

      try {
        // Start transaction
        await db.transaction(async (trx) => {
          // Determine school_id: use provided value, otherwise store NULL
          const finalSchoolId = school_id === undefined ? null : school_id;

          // Create new admin user with first_name and last_name, include resolved school_id
          [newUser] = await trx(TABLE.USERS)
            .insert({
              email,
              password_hash: hashedPassword,
              first_name,
              last_name,
              role_id: roleRecord.id,
              is_active: true,
              email_verified: true, // Auto-verify since admin is created by Super Admin/Admin
              school_id: finalSchoolId,
            })
            .returning(["id", "email", "first_name", "last_name", "is_active", "created_at"]);

          if (!newUser) {
            throw new Error("Failed to create user");
          }

          // Resolve job title name if job_title_id is provided
          let jobTitle = role === "admin" ? "Administrator" : "Sub Administrator";
          if (job_title_id) {
            const jobTitleRecord = await trx(TABLE.JOB_TITLES).where({ id: job_title_id }).first();
            if (jobTitleRecord) {
              jobTitle = jobTitleRecord.name;
            }
          }

          // Create Staff profile for admin
          await trx(TABLE.STAFF).insert({
            user_id: newUser.id,
            school_id: finalSchoolId,
            job_title: jobTitle,
            job_title_id: job_title_id ?? null,
            created_by: req.user?.id,
          });

          // Insert default permissions for the new admin/sub-admin
          // Admin gets all permissions enabled, Sub-Admin gets all disabled
          await insertDefaultPermissions(
            newUser.id,
            role === "admin" ? UserRole.ADMIN : UserRole.SUB_ADMIN,
            trx // Pass transaction
          );

          // Send welcome email with credentials (non-blocking - admin created even if email fails)
          try {
            await sendWelcomeEmail({
              email,
              password, // Plain password before hashing
              first_name,
              last_name,
              role,
            });
            console.log(`Welcome email sent to ${email}`);
          } catch (emailError: unknown) {
            // Log error but don't rollback - admin is created successfully
            console.error("Failed to send welcome email:", getErrorMessage(emailError));
          }

          // If we reach here, everything succeeded - transaction will commit
        });

        if (!newUser) {
          throw new Error("Failed to create user");
        }

        // Transaction committed successfully
        const responseAdmin = {
          id: newUser.id,
          email: newUser.email,
          first_name,
          last_name,
          role, // Return as "admin" or "sub_admin"
          is_active: newUser.is_active,
          created_at: newUser.created_at,
        };

        sendResponse(
          res,
          201,
          "Admin created successfully",
          true,
          responseAdmin
        );
        return;
      } catch (transactionError: unknown) {
        // Transaction rolled back - user and staff were not created
        console.error("Transaction failed:", transactionError);

        // Simple error message for frontend
        sendResponse(
          res,
          500,
          "Failed to create admin",
          false
        );
        return;
      }
    } catch (error: unknown) {
      console.error("Error creating admin:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

/**
 * Get all admins with pagination
 * Only Super Admin can access this
 */
export const getAllAdmins = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Super Admin and Admin can view admins
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to view admins",
          false
        );
        return;
      }

      const { page, limit, search } = req.query;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;
      const searchTerm = (search as string) || "";

      // Fetch admins (admin and sub_admin only)
      const adminRoles = [UserRole.ADMIN, UserRole.SUB_ADMIN];

      let query = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .leftJoin(
          `${TABLE.USERS} as creator`,
          `${TABLE.STAFF}.created_by`,
          "creator.id"
        )
        .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`,
          `${TABLE.USERS}.created_at`,
          `${TABLE.ROLES}.name as role`,
          `${TABLE.USERS}.school_id`,
          `${TABLE.STAFF}.job_title`,
          `${TABLE.STAFF}.job_title_id`,
          `${TABLE.JOB_TITLES}.name as job_title_name`,
          `${TABLE.STAFF}.created_by`,
          db.raw(
            `CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name`
          )
        )
        .whereIn(`${TABLE.ROLES}.name`, adminRoles)
        .where(`${TABLE.USERS}.is_deleted`, false);

      // If requester is Admin (not Super Admin), show only their created sub-admins
      if (requesterRole === UserRole.ADMIN) {
        query = query.where(`${TABLE.STAFF}.created_by`, req.user?.id);
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

      const admins = await query
        .orderBy(`${TABLE.USERS}.created_at`, "desc")
        .offset(skip)
        .limit(pageLimit);

      // Get total count with same filters
      let countQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .whereIn(`${TABLE.ROLES}.name`, adminRoles)
        .where(`${TABLE.USERS}.is_deleted`, false)
        .countDistinct(`${TABLE.USERS}.id as count`);

      // Apply same filter for Admin
      if (requesterRole === UserRole.ADMIN) {
        countQuery = countQuery.where(`${TABLE.STAFF}.created_by`, req.user?.id);
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

      const totalCountResult = await countQuery;

      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: admins,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "Admins fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching admins:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

/**
 * Get admin by ID
 * Only Super Admin can access this
 */
export const getAdminById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Super Admin and Admin can view admin details
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to view admin details",
          false
        );
        return;
      }

      const { id } = req.params;

      // Fetch admin by ID
      const admin = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .leftJoin(
          `${TABLE.USERS} as creator`,
          `${TABLE.STAFF}.created_by`,
          "creator.id"
        )
        .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`,
          `${TABLE.USERS}.created_at`,
          `${TABLE.ROLES}.name as role`,
          `${TABLE.USERS}.school_id`,
          `${TABLE.STAFF}.job_title`,
          `${TABLE.STAFF}.job_title_id`,
          `${TABLE.JOB_TITLES}.name as job_title_name`,
          `${TABLE.STAFF}.created_by`,
          db.raw(
            `CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name`
          )
        )
        .where(`${TABLE.USERS}.id`, id)
        .whereIn(`${TABLE.ROLES}.name`, [UserRole.ADMIN, UserRole.SUB_ADMIN])
        .first();

      if (!admin) {
        sendResponse(res, 404, "Admin not found", false);
        return;
      }

      sendResponse(res, 200, "Admin fetched successfully", true, admin);
      return;
    } catch (error: unknown) {
      console.error("Error fetching admin:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

/**
 * Update admin
 * Only Super Admin can access this
 */
export const updateAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Super Admin and Admin can update admins
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to update admins",
          false
        );
        return;
      }

      const { id } = req.params;

      // Validate request body
      const validated = validateRequest(updateAdminSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { first_name, last_name, email, role, school_id, is_active, job_title_id } =
        validated;

      // Check if admin exists
      const existingAdmin = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .where(`${TABLE.USERS}.id`, id)
        .whereIn(`${TABLE.ROLES}.name`, [UserRole.ADMIN, UserRole.SUB_ADMIN])
        .first();

      if (!existingAdmin) {
        sendResponse(res, 404, "Admin not found", false);
        return;
      }

      // Additional permission check for Admins
      if (requesterRole === UserRole.ADMIN) {
        // Admin can only update Sub-Admins, not other Admins
        if (existingAdmin.name === UserRole.ADMIN) {
          sendResponse(
            res,
            403,
            "Admins can only update Sub-Admins, not other Admins",
            false
          );
          return;
        }

        // Admin cannot promote sub-admin to admin
        if (role && role === UserRole.ADMIN) {
          sendResponse(
            res,
            403,
            "Admins cannot promote Sub-Admins to Admin role",
            false
          );
          return;
        }
      }

      // Check if email is unique (if updating email)
      if (email) {
        const emailExists = await db(TABLE.USERS)
          .where({ email })
          .whereNot("id", id)
          .first();

        if (emailExists) {
          sendResponse(res, 400, "Email already exists", false);
          return;
        }
      }

      // Update users table (password is handled by separate API)
      const userUpdateData: Record<string, unknown> = {};
      if (email) userUpdateData.email = email;
      if (first_name) userUpdateData.first_name = first_name;
      if (last_name) userUpdateData.last_name = last_name;
      if (is_active !== undefined) userUpdateData.is_active = is_active;
      if (school_id !== undefined && school_id !== null) userUpdateData.school_id = school_id;

      if (role) {
        // No mapping needed, database has "admin" and "sub_admin" directly
        const roleRecord = await db(TABLE.ROLES).where({ name: role }).first();
        if (roleRecord) {
          userUpdateData.role_id = roleRecord.id;
        }
      }

      if (Object.keys(userUpdateData).length > 0) {
        await db(TABLE.USERS).where({ id }).update(userUpdateData);
      }

      // Update staff table
      const staffUpdateData: Record<string, unknown> = {};
      if (school_id !== undefined && school_id !== null) staffUpdateData.school_id = school_id;
      if (role) {
        staffUpdateData.job_title =
          role === "admin" ? "Administrator" : "Sub Administrator";
      }
      if (job_title_id !== undefined) {
        if (job_title_id === null) {
          staffUpdateData.job_title_id = null;
        } else {
          const jobTitleRecord = await db(TABLE.JOB_TITLES).where({ id: job_title_id }).first();
          if (jobTitleRecord) {
            staffUpdateData.job_title_id = job_title_id;
            staffUpdateData.job_title = jobTitleRecord.name;
          }
        }
      }

      if (Object.keys(staffUpdateData).length > 0) {
        await db(TABLE.STAFF).where({ user_id: id }).update(staffUpdateData);
      }

      // Fetch updated admin
      const updatedAdmin = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`,
          `${TABLE.ROLES}.name as role`,
          `${TABLE.STAFF}.school_id`,
          `${TABLE.STAFF}.job_title_id`,
          `${TABLE.JOB_TITLES}.name as job_title_name`
        )
        .where(`${TABLE.USERS}.id`, id)
        .first();

      sendResponse(res, 200, "Admin updated successfully", true, updatedAdmin);
      return;
    } catch (error: unknown) {
      console.error("Error updating admin:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

/**
 * Delete admin
 * Only Super Admin can access this
 */
export const deleteAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Super Admin and Admin can delete admins
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to delete admins",
          false
        );
        return;
      }

      const { id } = req.params;

      // Check if admin exists and is actually an admin
      const admin = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, id)
        .whereIn(`${TABLE.ROLES}.name`, [UserRole.ADMIN, UserRole.SUB_ADMIN])
        .first();

      if (!admin) {
        sendResponse(res, 404, "Admin not found", false);
        return;
      }

      // Additional permission check for Admins
      if (requesterRole === UserRole.ADMIN && admin.role === UserRole.ADMIN) {
        sendResponse(
          res,
          403,
          "Admins can only delete Sub-Admins, not other Admins",
          false
        );
        return;
      }

      // Delete admin (cascade will handle staff table)
      await db(TABLE.USERS).where("id", id).del();

      sendResponse(res, 200, "Admin deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting admin:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

/**
 * Toggle admin status (activate/deactivate)
 * Only Super Admin can access this
 */
export const toggleAdminStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Super Admin and Admin can toggle admin status
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(
          res,
          403,
          "You don't have permission to toggle admin status",
          false
        );
        return;
      }

      const { id } = req.params;

      // Check if admin exists
      const admin = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, id)
        .whereIn(`${TABLE.ROLES}.name`, [UserRole.ADMIN, UserRole.SUB_ADMIN])
        .first();

      if (!admin) {
        sendResponse(res, 404, "Admin not found", false);
        return;
      }

      // Additional permission check for Admins
      if (requesterRole === UserRole.ADMIN && admin.role === UserRole.ADMIN) {
        sendResponse(
          res,
          403,
          "Admins can only toggle Sub-Admin status, not other Admins",
          false
        );
        return;
      }

      // Toggle status
      const newStatus = !admin.is_active;
      await db(TABLE.USERS).where("id", id).update({ is_active: newStatus });

      sendResponse(
        res,
        200,
        `Admin ${newStatus ? "activated" : "deactivated"} successfully`,
        true,
        { is_active: newStatus }
      );
      return;
    } catch (error: unknown) {
      console.error("Error toggling admin status:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

/**
 * Change admin password
 * Only Super Admin can change any admin's password
 */
export const changeAdminPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Permission check: Only Super Admin can change passwords
      const requesterRole = req.user?.role;

      if (requesterRole !== UserRole.SUPER_ADMIN) {
        sendResponse(
          res,
          403,
          "Only Super Admin can change admin passwords",
          false
        );
        return;
      }

      const { id } = req.params;

      // Validate request body
      const validated = validateRequest(
        changeAdminPasswordSchema,
        req.body,
        res
      );
      if (!validated) {
        return;
      }

      const { password } = validated;

      // Check if admin exists
      const admin = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, id)
        .whereIn(`${TABLE.ROLES}.name`, [UserRole.ADMIN, UserRole.SUB_ADMIN])
        .first();

      if (!admin) {
        sendResponse(res, 404, "Admin not found", false);
        return;
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(password, 10);
      await db(TABLE.USERS).where("id", id).update({ password_hash: hashedPassword });

      sendResponse(res, 200, "Admin password changed successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error changing admin password:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

import { NextFunction, Request, Response } from "express";
import { Knex } from "knex";
import { sendResponse } from "../utils/helperFunctions/responseHelper";
import { TABLE } from "../utils/Database/table";
import db from "../config/db";
import { UserRole } from "../utils/enums/users.enum";
import { PermissionAction, ModuleKey } from "../utils/enums/permissions.enum";
import { cache } from "../utils/services/redis/cache";
import { REDIS_KEYS, REDIS_TTL } from "../utils/services/redis/keys";

// Type for permissions map
type PermissionsMap = Record<string, Record<string, boolean>>;

/**
 * Fetch permissions from database
 */
const fetchPermissionsFromDB = async (userId: number): Promise<PermissionsMap> => {
  const permissions = await db(TABLE.MODULES)
    .leftJoin(TABLE.PERMISSIONS, function () {
      this.on(`${TABLE.MODULES}.id`, "=", `${TABLE.PERMISSIONS}.module_id`).andOn(
        `${TABLE.PERMISSIONS}.user_id`,
        "=",
        db.raw("?", [userId])
      );
    })
    .select(
      `${TABLE.MODULES}.key`,
      db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_create, false) as can_create`),
      db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_read, false) as can_read`),
      db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_edit, false) as can_edit`),
      db.raw(`COALESCE(${TABLE.PERMISSIONS}.can_delete, false) as can_delete`)
    );

  const permissionsMap: PermissionsMap = {};

  for (const perm of permissions) {
    permissionsMap[perm.key] = {
      can_create: perm.can_create,
      can_read: perm.can_read,
      can_edit: perm.can_edit,
      can_delete: perm.can_delete,
    };
  }

  return permissionsMap;
};

/**
 * Get user permissions with caching
 */
const getPermissionsWithCache = async (userId: number): Promise<PermissionsMap> => {
  const cacheKey = REDIS_KEYS.USER_PERMISSIONS(userId);

  return cache.getOrSet<PermissionsMap>(
    cacheKey,
    () => fetchPermissionsFromDB(userId),
    REDIS_TTL.PERMISSIONS
  );
};

/**
 * Invalidate user permissions cache
 * Call this when permissions are updated
 */
export const invalidatePermissionsCache = async (userId: number): Promise<void> => {
  await cache.del(REDIS_KEYS.USER_PERMISSIONS(userId));
};

/**
 * Creates a middleware that checks if user has specific permission for a module
 *
 * @param moduleKey - The module key to check (e.g., "students", "teachers")
 * @param action - The action to check (can_create, can_read, can_edit, can_delete)
 */
export const checkPermission = (moduleKey: ModuleKey, action: PermissionAction) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;

      if (!user) {
        sendResponse(res, 401, "Unauthorized", false);
        return;
      }

      // Super Admin has full access - skip permission check
      if (user.role === UserRole.SUPER_ADMIN) {
        next();
        return;
      }

      // For Super Sub-Admin, Admin and Sub-Admin, check permissions table
      if (
        user.role === UserRole.SUPER_SUB_ADMIN ||
        user.role === UserRole.ADMIN ||
        user.role === UserRole.SUB_ADMIN
      ) {
        // Get permissions with caching
        const permissionsMap = await getPermissionsWithCache(user.id);

        const modulePermissions = permissionsMap[moduleKey];

        if (!modulePermissions || !modulePermissions[action]) {
          const actionName = action.replace("can_", "");
          sendResponse(
            res,
            403,
            `You don't have permission to ${actionName} ${moduleKey}`,
            false
          );
          return;
        }

        next();
        return;
      }

      // Teachers and Students don't have access to admin routes
      sendResponse(res, 403, "Access denied", false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Permission check error:", errorMessage);
      sendResponse(res, 500, "Permission check failed", false);
    }
  };
};

/**
 * Helper to get user permissions for frontend
 * Returns a map of module permissions for the current user
 * Uses Redis caching for better performance
 */
export const getUserPermissionsMap = async (
  userId: number
): Promise<PermissionsMap> => {
  return getPermissionsWithCache(userId);
};

/**
 * Helper to insert default permissions for a user
 * Admin gets all permissions enabled, Sub-Admin gets all permissions disabled
 * @param trx - Optional Knex transaction object
 */
export const insertDefaultPermissions = async (
  userId: number,
  role: UserRole,
  trx?: Knex.Transaction
): Promise<void> => {
  const queryBuilder = trx || db;

  // Filter modules by scope based on role
  let modulesQuery = queryBuilder(TABLE.MODULES);

  if (role === UserRole.SUPER_SUB_ADMIN) {
    // Super Sub-Admins get all modules (both platform and school-scoped)
    // They assist SUPER_ADMIN and may need to manage school content
  } else if (role === UserRole.ADMIN || role === UserRole.SUB_ADMIN) {
    // School Admins get school-scoped modules (includes "admins" module) + specific platform modules
    // This includes 'super_sub_admins' module so SUPER_ADMIN can delegate system user management
    modulesQuery = modulesQuery.where(function() {
      this.where({ scope: "school" })
        .orWhere({ key: "super_sub_admins" }); // Allow ADMIN to see system users module
    });
  }

  const modules = await modulesQuery.select("id");

  const defaultPermissions = modules.map((module: { id: number }) => ({
    user_id: userId,
    module_id: module.id,
    can_create: role === UserRole.ADMIN, // Admin gets all enabled, others get disabled
    can_read: role === UserRole.ADMIN,
    can_edit: role === UserRole.ADMIN,
    can_delete: role === UserRole.ADMIN,
  }));

  if (defaultPermissions.length > 0) {
    await queryBuilder(TABLE.PERMISSIONS).insert(defaultPermissions);
  }

  // Restrict Admin from managing system users (super_sub_admins module)
  // Admin should only have read access to system users, not create/edit/delete
  if (role === UserRole.ADMIN) {
    await queryBuilder(TABLE.PERMISSIONS)
      .where({ user_id: userId })
      .whereIn("module_id", function () {
        this.select("id").from(TABLE.MODULES).where({ key: "super_sub_admins" });
      })
      .update({ can_create: false, can_edit: false, can_delete: false });
  }

  // Invalidate cache for this user (new permissions added)
  await invalidatePermissionsCache(userId);
};

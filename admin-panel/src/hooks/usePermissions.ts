"use client";

import { useAuth } from "@/providers/auth-provider";
import { PermissionSet } from "@/types";

export type ModuleKey =
  // Platform-level modules
  | "schools"
  | "school_requests"
  | "super_sub_admins"
  | "platform_reports"
  | "admins"
  // School-level modules
  | "students"
  | "teachers"
  | "categories"
  | "activities"
  | "challenges"
  | "articles"
  | "badges"
  | "levels";

export type PermissionAction = "can_create" | "can_read" | "can_edit" | "can_delete";

export function usePermissions() {
  const { user } = useAuth();

  const isSuperAdmin = user?.role === "super_admin";
  // Check both "admin" and legacy "school_admin" role names
  const isAdmin = user?.role === "admin" || user?.role === "school_admin";
  const isSubAdmin = user?.role === "sub_admin";

  /**
   * Check if user has a specific permission for a module
   * Super Admin always has full access
   */
  const hasPermission = (moduleKey: ModuleKey, action: PermissionAction): boolean => {
    // Super Admin has full access to everything
    if (isSuperAdmin) {
      return true;
    }

    // For Admin and Sub Admin, check permissions map
    if (!user?.permissions) {
      return false;
    }

    const modulePermissions = user.permissions[moduleKey];
    if (!modulePermissions) {
      return false;
    }

    return modulePermissions[action] === true;
  };

  /**
   * Check if user can access (read) a module
   */
  const canAccess = (moduleKey: ModuleKey): boolean => {
    return hasPermission(moduleKey, "can_read");
  };

  /**
   * Check if user can create in a module
   */
  const canCreate = (moduleKey: ModuleKey): boolean => {
    return hasPermission(moduleKey, "can_create");
  };

  /**
   * Check if user can edit in a module
   */
  const canEdit = (moduleKey: ModuleKey): boolean => {
    return hasPermission(moduleKey, "can_edit");
  };

  /**
   * Check if user can delete in a module
   */
  const canDelete = (moduleKey: ModuleKey): boolean => {
    return hasPermission(moduleKey, "can_delete");
  };

  /**
   * Get all permissions for a module
   */
  const getModulePermissions = (moduleKey: ModuleKey): PermissionSet | null => {
    if (isSuperAdmin) {
      return {
        can_create: true,
        can_read: true,
        can_edit: true,
        can_delete: true,
      };
    }

    return user?.permissions?.[moduleKey] || null;
  };

  /**
   * Check if user can edit permissions for a specific role
   * Super Admin can edit Super Sub-Admin, Admin and Sub Admin permissions
   * Admin can only edit Sub Admin permissions
   */
  const canEditPermissionsFor = (targetRole: string): boolean => {
    if (isSuperAdmin) {
      return targetRole === "super_sub_admin" || targetRole === "admin" || targetRole === "sub_admin";
    }
    if (isAdmin) {
      return targetRole === "sub_admin";
    }
    return false;
  };

  return {
    // Role flags
    isSuperAdmin,
    isAdmin,
    isSubAdmin,

    // Permission checks
    hasPermission,
    canAccess,
    canCreate,
    canEdit,
    canDelete,

    // Utilities
    getModulePermissions,
    canEditPermissionsFor,
  };
}

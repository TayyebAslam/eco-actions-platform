import { z } from "zod";

// Schema for a single module permission
const modulePermissionSchema = z.object({
  module_id: z.number().int().positive(),
  can_create: z.boolean().default(false),
  can_read: z.boolean().default(false),
  can_edit: z.boolean().default(false),
  can_delete: z.boolean().default(false),
});

// Schema for updating user permissions (array of module permissions)
export const updateUserPermissionsSchema = z.object({
  permissions: z.array(modulePermissionSchema).min(1, "At least one permission is required"),
});

export type ModulePermission = z.infer<typeof modulePermissionSchema>;
export type UpdateUserPermissionsInput = z.infer<typeof updateUserPermissionsSchema>;

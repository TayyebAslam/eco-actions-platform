import { z } from "zod";
import { UserRole } from "../utils/enums/users.enum";

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

// Schema for creating an admin (handles multipart/form-data)
export const createAdminSchema = z.object({
  first_name: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters"),
  last_name: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters"),
  role: z.enum(["admin", "sub_admin"], {
    error: "Role must be either admin or sub_admin",
  }),
  school_id: z.coerce.number().optional(), // Coerce string to number from form-data
  job_title_id: z.number().int().positive("Invalid job title ID").optional().nullable(),
});

// Schema for updating an admin (handles multipart/form-data)
// Note: Password is handled by a separate API endpoint
export const updateAdminSchema = z.object({
  first_name: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters")
    .optional(),
  last_name: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters")
    .optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters")
    .optional(),
  role: z.enum(["admin", "sub_admin"]).optional(),
  school_id: z.coerce.number().optional(), // Coerce string to number from form-data
  job_title_id: z.number().int().positive("Invalid job title ID").optional().nullable(),
  is_active: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional(), // Handle both boolean and string
});

// Schema for changing admin password (Super Admin only)
export const changeAdminPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(passwordRegex, "Password must contain uppercase, lowercase, number and special character (@$!%*?&#)"),
});

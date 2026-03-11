import { z } from "zod";

export const createTeacherSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters"),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must not exceed 50 characters"),
  last_name: z
    .string()
    .max(50, "Last name must not exceed 50 characters")
    .optional(),
  school_id: z.coerce.number().min(1, "School ID is required"),
});

export const updateTeacherSchema = z.object({
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must not exceed 50 characters")
    .optional(),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must not exceed 50 characters")
    .optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters")
    .optional(),
  is_active: z.boolean().optional(),
});

export const bulkUploadTeacherSchema = z.object({
  school_id: z.coerce.number().min(1, "School ID is required").optional(),
});

export const flagSchoolUserSchema = z.object({
  reason: z.enum(
    ["Suspicious activity", "Inappropriate content", "Gaming the system"],
    {
      message:
        "Reason must be one of: Suspicious activity, Inappropriate content, Gaming the system",
    }
  ),
  note: z
    .string()
    .max(1000, "Note must not exceed 1000 characters")
    .optional(),
});

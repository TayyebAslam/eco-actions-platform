import { z } from "zod";

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

// Schema for initiating school registration (Step 1 - Admin info only)
export const initiateSchoolRequestSchema = z.object({
  admin_email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters"),
  admin_first_name: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters"),
  admin_last_name: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters"),
  admin_password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(passwordRegex, "Password must contain uppercase, lowercase, number and special character (@$!%*?&#)"),
});

// Schema for completing school registration (Step 2 - School info after email verification)
export const completeSchoolRequestSchema = z.object({
  completion_token: z.string().min(1, "Completion token is required"),
  school_name: z
    .string()
    .min(2, "School name must be at least 2 characters")
    .max(255, "School name must not exceed 255 characters"),
  school_slug: z
    .string()
    .min(2, "School slug must be at least 2 characters")
    .max(255, "School slug must not exceed 255 characters"),
  school_address: z
    .string()
    .max(500, "School address must not exceed 500 characters")
    .optional(),
});

// Schema for re-registering after rejection
export const reRegisterSchoolRequestSchema = z.object({
  admin_email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters"),
  admin_password: z.string().min(1, "Password is required"),
  school_name: z
    .string()
    .min(2, "School name must be at least 2 characters")
    .max(255, "School name must not exceed 255 characters"),
  school_slug: z
    .string()
    .min(2, "School slug must be at least 2 characters")
    .max(255, "School slug must not exceed 255 characters"),
  school_address: z
    .string()
    .max(500, "School address must not exceed 500 characters")
    .optional(),
});

// Schema for public school registration request (legacy - single step)
export const createSchoolRequestSchema = z.object({
  // Admin Information
  admin_email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters"),
  admin_first_name: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters"),
  admin_last_name: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters"),
  admin_password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(passwordRegex, "Password must contain uppercase, lowercase, number and special character (@$!%*?&#)"),

  // School Information
  school_name: z
    .string()
    .min(2, "School name must be at least 2 characters")
    .max(255, "School name must not exceed 255 characters"),
  school_slug: z
    .string()
    .min(2, "School slug must be at least 2 characters")
    .max(255, "School slug must not exceed 255 characters"),
  school_address: z
    .string()
    .max(500, "School address must not exceed 500 characters")
    .optional(),
});

// Schema for approving/rejecting a request
export const reviewSchoolRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejection_reason: z
    .string()
    .max(1000, "Rejection reason must not exceed 1000 characters")
    .optional(),
});

import { z } from "zod";

// Schema for creating a school
export const createSchoolSchema = z.object({
  name: z
    .string()
    .min(2, "School name must be at least 2 characters")
    .max(255, "School name must not exceed 255 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(255, "Slug must not exceed 255 characters")
    .optional(),
  address: z
    .string()
    .max(500, "Address must not exceed 500 characters")
    .optional(),
  subscription_status: z.enum(["active", "inactive", "suspended"]).default("active").optional(),
});

// Schema for updating a school
export const updateSchoolSchema = z.object({
  name: z
    .string()
    .min(2, "School name must be at least 2 characters")
    .max(255, "School name must not exceed 255 characters")
    .optional(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(255, "Slug must not exceed 255 characters")
    .optional(),
  address: z
    .string()
    .max(500, "Address must not exceed 500 characters")
    .optional(),
  subscription_status: z.enum(["active", "inactive", "suspended"]).optional(),
});

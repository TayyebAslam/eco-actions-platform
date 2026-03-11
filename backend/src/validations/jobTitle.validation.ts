import { z } from "zod";

/**
 * Schema for creating a job title
 */
export const createJobTitleSchema = z.object({
  name: z
    .string()
    .min(2, "Job title name must be at least 2 characters")
    .max(100, "Job title name must not exceed 100 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .trim()
    .optional()
    .nullable(),
  scope: z
    .enum(["global", "system", "school"], {
      message: "Scope must be 'global', 'system', or 'school'",
    })
    .optional()
    .default("global"),
});

/**
 * Schema for updating a job title
 */
export const updateJobTitleSchema = z.object({
  name: z
    .string()
    .min(2, "Job title name must be at least 2 characters")
    .max(100, "Job title name must not exceed 100 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .trim()
    .optional()
    .nullable(),
  scope: z
    .enum(["global", "system", "school"], {
      message: "Scope must be 'global', 'system', or 'school'",
    })
    .optional(),
});

/**
 * Schema for job title query parameters
 */
export const jobTitleQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
  scope: z.enum(["global", "system", "school", "all"]).optional().default("all"),
});

import { z } from "zod";

export const createBadgeSchema = z.object({
  name: z
    .string()
    .min(2, "Badge name must be at least 2 characters")
    .max(100, "Badge name must not exceed 100 characters"),
  criteria: z
    .string()
    .max(500, "Criteria must not exceed 500 characters")
    .optional(),
});

export const updateBadgeSchema = z.object({
  name: z
    .string()
    .min(2, "Badge name must be at least 2 characters")
    .max(100, "Badge name must not exceed 100 characters")
    .optional(),
  criteria: z
    .string()
    .max(500, "Criteria must not exceed 500 characters")
    .optional(),
});

import { z } from "zod";

const challengeVariantSchema = z.object({
  name: z
    .string()
    .max(100, "Variant name must not exceed 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Variant description must not exceed 500 characters")
    .optional(),
  target_count: z.coerce.number().min(1).optional(),
  target_unit: z
    .string()
    .max(50, "Target unit must not exceed 50 characters")
    .optional(),
  points: z.coerce.number().min(0).optional(),
});

export const createChallengeSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(255, "Title must not exceed 255 characters"),
  description: z
    .string()
    .max(2000, "Description must not exceed 2000 characters")
    .optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_active: z.preprocess(
    (val) => (typeof val === "string" ? val === "true" : val),
    z.boolean().optional().default(true)
  ),
  school_id: z.coerce.number().optional(),
  challenge_type_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  // Require at least one variant so students can join by variant_id
  variants: z.preprocess(
    (val) => {
      const parsed = typeof val === "string" ? JSON.parse(val) : val;
      return Array.isArray(parsed) ? parsed : [parsed];
    },
    z.array(challengeVariantSchema).min(1, "At least one variant is required")
  ),
});

export const updateChallengeSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(255, "Title must not exceed 255 characters")
    .optional(),
  description: z
    .string()
    .max(2000, "Description must not exceed 2000 characters")
    .optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_active: z.preprocess(
    (val) => (typeof val === "string" ? val === "true" : val),
    z.boolean().optional()
  ),
  school_id: z.coerce.number().optional(),
  challenge_type_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  variants: z.preprocess(
    (val) => {
      if (val === undefined) return val;
      const parsed = typeof val === "string" ? JSON.parse(val) : val;
      return Array.isArray(parsed) ? parsed : [parsed];
    },
    z.array(challengeVariantSchema).optional()
  ),
});

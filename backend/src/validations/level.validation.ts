import { z } from "zod";

export const createLevelSchema = z.object({
  id: z.number().min(1, "Level ID must be at least 1"),
  title: z
    .string()
    .min(1, "Level title is required")
    .max(100, "Level title must not exceed 100 characters"),
  min_xp: z.number().min(0, "Minimum XP must be at least 0"),
});

export const updateLevelSchema = z.object({
  title: z
    .string()
    .min(1, "Level title is required")
    .max(100, "Level title must not exceed 100 characters")
    .optional(),
  min_xp: z.number().min(0, "Minimum XP must be at least 0").optional(),
});

export const applyLevelFormulaSchema = z.object({
  total_levels: z.coerce.number().int().min(2).max(500).default(100),
  base_min_xp: z.coerce.number().int().min(0).default(0),
  initial_gap: z.coerce.number().int().min(1).default(100),
  tier_size: z.coerce.number().int().min(1).max(100).default(20),
  base_increment: z.coerce.number().int().min(1).default(10),
  growth_divisor: z.coerce.number().positive().default(50),
  title_prefix: z
    .string()
    .min(1)
    .max(50, "Title prefix must not exceed 50 characters")
    .default("Level"),
});

import { z } from "zod";

export const createChallengeTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  label: z.string().min(1, "Label is required"),
  description: z.string().optional(),
  units: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export const updateChallengeTypeSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  label: z.string().min(1, "Label is required").optional(),
  description: z.string().optional(),
  units: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

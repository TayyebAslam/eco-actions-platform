import { z } from "zod";

export const createSectionSchema = z.object({
  name: z
    .string()
    .min(1, "Section name is required")
    .max(100, "Section name must not exceed 100 characters"),
});

export const updateSectionSchema = z.object({
  name: z
    .string()
    .min(1, "Section name is required")
    .max(100, "Section name must not exceed 100 characters")
    .optional(),
});

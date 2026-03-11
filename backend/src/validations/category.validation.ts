import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name must not exceed 100 characters"),
  color: z
    .string()
    .max(7, "Color must be a valid hex code (e.g., #FF0000)")
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
    .optional(),
  units: z
    .union([
      z.array(z.string().min(1, "Unit must not be empty").max(50, "Unit must not exceed 50 characters")),
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }),
    ])
    .optional(),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name must not exceed 100 characters")
    .optional(),
  color: z
    .string()
    .max(7, "Color must be a valid hex code (e.g., #FF0000)")
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
    .optional(),
  units: z
    .union([
      z.array(z.string().min(1, "Unit must not be empty").max(50, "Unit must not exceed 50 characters")),
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }),
    ])
    .optional(),
});

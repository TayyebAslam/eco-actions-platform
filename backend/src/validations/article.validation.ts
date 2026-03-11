import { z } from "zod";

export const createArticleSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(255, "Title must not exceed 255 characters"),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(50000, "Content must not exceed 50000 characters"),
  points: z.coerce.number().min(0).optional().default(10),
  category_id: z.coerce.number(),
  school_id: z.coerce.number().nullable().optional().transform(val => val === 0 ? null : val),
  thumbnail_image: z.string().url().optional(), // URL from upload endpoint
});

export const updateArticleSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(255, "Title must not exceed 255 characters")
    .optional(),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(50000, "Content must not exceed 50000 characters")
    .optional(),
  points: z.coerce.number().min(0).optional(),
  category_id: z.coerce.number().optional(),
  school_id: z.coerce.number().nullable().optional().transform(val => val === 0 ? null : val),
  thumbnail_image: z.string().url().optional(), // URL from upload endpoint
});

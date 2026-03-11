import { z } from "zod";

export const createStudentSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters"),
  school_id: z.number().min(1, "School ID is required"),
  class_id: z.number().min(1, "Class ID is required"),
  section_id: z.number().min(1, "Section ID must be valid").optional(),
});

export const updateStudentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters")
    .optional(),
  class_id: z.number().min(1, "Class ID is required").optional(),
  section_id: z.number().min(1, "Section ID must be valid").nullable().optional(),
  is_active: z.boolean().optional(),
});

export const bulkUploadStudentSchema = z.object({
  school_id: z.number().min(1, "School ID is required").optional(),
});

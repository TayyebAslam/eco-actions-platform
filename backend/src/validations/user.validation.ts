import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive({ message: "ID must be a positive integer" }),
});

export const createUserSchema = z
  .object({
    first_name: z
      .string()
      .min(3, { message: "First name must be at least 3 characters long" })
      .max(50, { message: "First name must not exceed 50 characters" })
      .regex(/^[A-Za-z\s]+$/, {
        message: "First name can only contain letters and spaces",
      }),

    last_name: z
      .string()
      .min(2, { message: "Last name must be at least 2 characters long" })
      .max(50, { message: "Last name must not exceed 50 characters" })
      .regex(/^[A-Za-z\s]+$/, {
        message: "Last name can only contain letters and spaces",
      }),

    email: z.string().email({ message: "Invalid email format" }),

    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long" })
      .regex(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter",
      })
      .regex(/[a-z]/, {
        message: "Password must contain at least one lowercase letter",
      })
      .regex(/\d/, { message: "Password must contain at least one number" })
      .regex(/[@$!%*?&#]/, {
        message:
          "Password must contain at least one special character (@, $, !, %, *, ?, &, #)",
      }),
    confirmPassword: z.string(),
    role: z.string().min(1, "Role is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

  export const updateUserSchema = z
  .object({
    first_name: z
      .string()
      .min(3, { message: "First name must be at least 3 characters long" })
      .max(50, { message: "First name must not exceed 50 characters" })
      .regex(/^[A-Za-z\s]+$/, {
        message: "First name can only contain letters and spaces",
      }),

    last_name: z
      .string()
      .min(2, { message: "Last name must be at least 2 characters long" })
      .max(50, { message: "Last name must not exceed 50 characters" })
      .regex(/^[A-Za-z\s]+$/, {
        message: "Last name can only contain letters and spaces",
      }),

    email: z.string().email({ message: "Invalid email format" }),

    role: z.string().min(1, "Role is required"),
  });

export const getUsersQuerySchema = paginationSchema.extend({
  search: z.string().max(255).optional(),
  role: z.string().max(50).optional(),
  is_active: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

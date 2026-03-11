import { z } from "zod";

export const registerSchema = z.object({
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

  email: z
    .string()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email must not exceed 255 characters" }),

  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password must not exceed 128 characters" })
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
});

export const authSchema = z
  .object({
    first_name: z
      .string()
      .min(2, { message: "First name must be at least 2 characters long" })
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
    email: z
      .string()
      .email({ message: "Invalid email" })
      .max(255, { message: "Email must not exceed 255 characters" }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password must not exceed 128 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/\d/, "Password must contain at least one number")
      .regex(
        /[@$!%*?&#]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .email({ message: "Invalid email" })
    .max(255, { message: "Email must not exceed 255 characters" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export const googleLoginSchema = z.object({
  id_token: z.string().min(1, { message: "Google id_token is required" }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(
      /[@$!%*?&#]/,
      "Password must contain at least one special character"
    ),
  confirmPassword: z
    .string()
    .min(1, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Confirm password must match",
  path: ["confirmPassword"],
});

export const requestEmailChangeSchema = z.object({
  new_email: z
    .string()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email must not exceed 255 characters" })
});

export const confirmEmailChangeSchema = z.object({
  new_email: z
    .string()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email must not exceed 255 characters" }),
  otp: z.string().min(6, { message: "OTP must be 6 digits" }).max(6, { message: "OTP must be 6 digits" })
});

export const adminSignupSchema = z.object({
  first_name: z
    .string()
    .min(2, { message: "First name must be at least 2 characters long" })
    .max(50, { message: "First name must not exceed 50 characters" }),

  last_name: z
    .string()
    .min(2, { message: "Last name must be at least 2 characters long" })
    .max(50, { message: "Last name must not exceed 50 characters" }),

  email: z
    .string()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email must not exceed 255 characters" }),

  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password must not exceed 128 characters" })
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
});

export const resetPasswordSchema = z.object({
  data: z.string().min(1, { message: "Reset token is required" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password must not exceed 128 characters" })
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
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { message: "Password is required for confirmation" }),
});

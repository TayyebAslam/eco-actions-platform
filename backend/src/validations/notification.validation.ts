import { z } from "zod";

export const getNotificationsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1))
    .pipe(z.number().int().positive("Page must be a positive integer")),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10))
    .pipe(z.number().int().positive("Limit must be a positive integer").max(100, "Limit cannot exceed 100")),
  is_read: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  type: z
    .enum([
      "activity_approved",
      "activity_rejected",
      "pending_activities",
      "challenge_joined",
      "school_request",
      "new_article",
      "comment_received",
      "system_alert",
    ])
    .optional(),
});

export const markAsReadSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val))
    .pipe(z.number().int().positive("Invalid notification ID")),
});

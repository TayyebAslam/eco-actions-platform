import { z } from "zod";

export const createActivitySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category_id: z.number().min(1, "Category ID is required"),
  photos: z.array(z.string()).optional(),
});

export const reviewActivitySchema = z
  .object({
    status: z.enum(["approved", "rejected"]),

    points: z.coerce
      .number()


      .min(0, "Points must be a positive number")
      .optional(),
    rejection_reason: z
      .string()
      .trim()
      .min(1, "Rejection reason is required")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "rejected" && !data.rejection_reason) {
      ctx.addIssue({
        path: ["rejection_reason"],
        message: "Rejection reason is required when rejecting an activity",
        code: z.ZodIssueCode.custom,
      });
    }
    if (data.status === "approved" && data.rejection_reason) {
      ctx.addIssue({
        path: ["rejection_reason"],
        message:
          "Rejection reason must not be provided when approving an activity",
        code: z.ZodIssueCode.custom,
      });
    }
  });

export const shareActivitySchema = z.object({
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
});

export const addFeedCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required"),
});

export const reportFeedActivitySchema = z.object({
  reason: z.enum(
    [
      "Spam or misleading",
      "Inappropriate content",
      "Harassment or bullying",
      "False information",
    ],
    {
      message:
        "Reason must be one of: Spam or misleading, Inappropriate content, Harassment or bullying, False information",
    }
  ),
  description: z
    .string()
    .max(1000, "Description must not exceed 1000 characters")
    .optional(),
});

export const moderateReportedActivitySchema = z.object({
  action: z.enum(["approve", "remove"], {
    message: "Action must be either 'approve' or 'remove'",
  }),
  note: z
    .string()
    .max(1000, "Note must not exceed 1000 characters")
    .optional(),
});

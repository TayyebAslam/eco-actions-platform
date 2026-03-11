import { z } from "zod";

export const updateRoleDisplayNameSchema = z.object({
  display_name: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must not exceed 100 characters"),
});

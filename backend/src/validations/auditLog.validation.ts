import { z } from "zod";

// Date format regex: YYYY-MM-DD or ISO 8601 datetime
const dateFormatRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

export const getAuditLogsSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
  user_id: z.coerce.number().optional(),
  action: z.string().optional(),
  module: z.string().optional(),
  status: z.enum(["success", "failure"]).optional(),
  start_date: z.string().regex(dateFormatRegex, "Invalid date format. Use YYYY-MM-DD or ISO 8601").optional(),
  end_date: z.string().regex(dateFormatRegex, "Invalid date format. Use YYYY-MM-DD or ISO 8601").optional(),
});

export const getAuditLogByIdSchema = z.object({
  id: z.coerce.number().min(1, "Invalid audit log ID"),
});

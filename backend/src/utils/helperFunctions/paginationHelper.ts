import { z } from "zod";

/**
 * Reusable pagination schema with validation bounds
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Parse and validate pagination from query parameters
 * Returns safe defaults if parsing fails
 */
export const parsePagination = (
  query: Record<string, unknown>
): PaginationParams => {
  const result = paginationSchema.safeParse(query);
  if (result.success) {
    return result.data;
  }
  return { page: 1, limit: 10 };
};

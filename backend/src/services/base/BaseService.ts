import { Knex } from "knex";
import db from "../../config/db";

/** In-memory cache for schema column checks (populated once at startup) */
const columnCache = new Map<string, boolean>();

/**
 * Check if a column exists (cached after first check)
 */
export const hasColumn = async (
  table: string,
  column: string
): Promise<boolean> => {
  const key = `${table}.${column}`;
  const cached = columnCache.get(key);
  if (cached !== undefined) return cached;

  const result = await db.schema.hasColumn(table, column);
  columnCache.set(key, result);
  return result;
};

/**
 * Base Service Class
 * Provides common functionality for all services
 */
export abstract class BaseService {
  protected db: Knex;

  constructor() {
    this.db = db;
  }

  /** Cached column existence check */
  protected hasColumn = hasColumn;

  /**
   * Execute operations within a transaction
   */
  protected async withTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    return await this.db.transaction(async (trx) => {
      return await callback(trx);
    });
  }

  /**
   * Paginate query results with enforced bounds
   */
  protected paginate(page: number = 1, limit: number = 10) {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;
    return { offset, limit: safeLimit };
  }

  /**
   * Build pagination response
   */
  protected buildPaginationResponse<T>(
    data: T[],
    totalCount: number,
    page: number,
    limit: number
  ) {
    return {
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Parse count result from Knex
   */
protected parseCount(result?: { count?: string | number }[] | undefined): number {
  if (!result || result.length === 0) return 0;
  const countValue = result[0]?.count;
  return typeof countValue === "number" ? countValue : parseInt(countValue as string) || 0;
}


  /**
   * Build search condition for multiple fields
   */
    protected buildSearchCondition(
      query: Knex.QueryBuilder,
      searchTerm: string,
      fields: string[]
    ): Knex.QueryBuilder {
      if (!searchTerm) return query;

      return query.where((builder) => {
        fields.forEach((field, index) => {
          if (index === 0) {
            builder.where(field, "ilike", `%${searchTerm}%`);
          } else {
            builder.orWhere(field, "ilike", `%${searchTerm}%`);
          }
        });
      });
    }

  /**
   * Build cursor-based pagination for high-traffic endpoints
   * More efficient than offset-based for large datasets
   *
   * @param query - Knex query builder (already filtered)
   * @param cursor - Last item's cursor value (e.g. created_at or id)
   * @param limit - Items per page
   * @param cursorColumn - Column to use as cursor (default: "id")
   * @param direction - "next" for newer items or "prev" for older items
   */
  protected async buildCursorPagination<T>(
    query: Knex.QueryBuilder,
    cursor: string | number | undefined,
    limit: number = 10,
    cursorColumn: string = "id",
    direction: "next" | "prev" = "next"
  ): Promise<{ data: T[]; nextCursor: string | number | null; hasMore: boolean }> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    if (cursor !== undefined) {
      if (direction === "next") {
        query = query.where(cursorColumn, "<", cursor);
      } else {
        query = query.where(cursorColumn, ">", cursor);
      }
    }

    const data = await query
      .orderBy(cursorColumn, direction === "next" ? "desc" : "asc")
      .limit(safeLimit + 1) as T[];

    const hasMore = data.length > safeLimit;
    if (hasMore) data.pop();

    if (direction === "prev") data.reverse();

    const nextCursor = hasMore && data.length > 0
      ? (data[data.length - 1] as Record<string, unknown>)[cursorColumn.split(".").pop()!] as string | number
      : null;

    return { data, nextCursor, hasMore };
  }
  }

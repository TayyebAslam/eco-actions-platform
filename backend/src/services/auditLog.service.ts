import { Knex } from "knex";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { AuditLogError } from "../utils/errors";
import { BaseService } from "./base/BaseService";
import { ActionType, ModuleType } from "../utils/services/activityLogger/types";

export interface AuditLogFilters {
  user_id?: number;
  exclude_user_id?: number;
  school_id?: number;
  action?: string;
  module?: string;
  status?: "success" | "failure";
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface CreateAuditLogDTO {
  user_id?: number | null;
  user_email?: string | null;
  user_role?: string | null;
  school_id?: number | null;
  action: ActionType;
  module: ModuleType | string;
  resource_id?: number | null;
  resource_name?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  status?: "success" | "failure";
  error_message?: string | null;
}

export interface AuditLogResponse {
  id: number;
  user_id: number | null;
  user_email: string | null;
  user_role: string | null;
  school_id: number | null;
  action: string;
  module: string;
  resource_id: number | null;
  resource_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "failure";
  error_message: string | null;
  created_at: string;
}

export interface PaginationDTO {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class AuditLogService extends BaseService {
  /**
   * Create a new audit log entry
   */
  async create(data: CreateAuditLogDTO): Promise<AuditLogResponse> {
    const [log] = await this.db(TABLE.AUDIT_LOGS)
      .insert({
        user_id: data.user_id,
        user_email: data.user_email,
        user_role: data.user_role,
        school_id: data.school_id,
        action: data.action,
        module: data.module,
        resource_id: data.resource_id,
        resource_name: data.resource_name,
        details: data.details ? JSON.stringify(data.details) : null,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        status: data.status || "success",
        error_message: data.error_message,
      })
      .returning("*");

    return this.formatLog(log);
  }

  /**
   * Get all audit logs with filtering and pagination
   */
  async getAll(
    filters: AuditLogFilters,
    pagination: PaginationDTO
  ): Promise<PaginatedResponse<AuditLogResponse>> {
    const { page = 1, limit = 10 } = pagination;
    const { offset } = this.paginate(page, limit);

    let query = this.db(TABLE.AUDIT_LOGS).select("*");

    // Apply filters
    query = this.applyFilters(query, filters);

    // Count query
    let countQuery = this.db(TABLE.AUDIT_LOGS);
    countQuery = this.applyFilters(countQuery, filters);
    const totalCountResult = await countQuery.count<{ count: string }>("* as count").first();
    const totalCount = totalCountResult ? parseInt(totalCountResult.count) : 0;

    // Fetch paginated data
    const logs = await query
      .offset(offset)
      .limit(limit)
      .orderBy("created_at", "desc");

    return this.buildPaginationResponse(
      logs.map(this.formatLog),
      totalCount,
      page,
      limit
    );
  }

  /**
   * Get a single audit log by ID
   */
  async getById(id: number): Promise<AuditLogResponse | null> {
    const log = await this.db(TABLE.AUDIT_LOGS).where({ id }).first();

    if (!log) {
      return null;
    }

    return this.formatLog(log);
  }

  /**
   * Delete logs older than specified days (for cleanup)
   */
  async cleanup(days: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db(TABLE.AUDIT_LOGS)
      .where("created_at", "<", cutoffDate)
      .del();

    return result;
  }

  /**
   * Apply filters to query
   */
  private applyFilters(
    query: Knex.QueryBuilder,
    filters: AuditLogFilters
  ): Knex.QueryBuilder {
    if (filters.user_id) {
      query = query.where("user_id", filters.user_id);
    }

    // Exclude current user's own actions
    if (filters.exclude_user_id) {
      query = query.whereNot("user_id", filters.exclude_user_id);
    }

    if (filters.school_id) {
      query = query.where("school_id", filters.school_id);
    }

    if (filters.action) {
      query = query.where("action", filters.action);
    }

    if (filters.module) {
      query = query.where("module", filters.module);
    }

    if (filters.status) {
      query = query.where("status", filters.status);
    }

    if (filters.start_date) {
      query = query.where("created_at", ">=", filters.start_date);
    }

    if (filters.end_date) {
      query = query.where("created_at", "<=", filters.end_date);
    }

    if (filters.search) {
      query = query.where((builder) => {
        builder
          .where("user_email", "ilike", `%${filters.search}%`)
          .orWhere("resource_name", "ilike", `%${filters.search}%`);
      });
    }

    return query;
  }

  /**
   * Format log entry for response
   */
  private formatLog(log: Record<string, unknown>): AuditLogResponse {
    // Safely parse JSON details
    let parsedDetails: Record<string, unknown> | null = null;
    if (log.details) {
      if (typeof log.details === "string") {
        try {
          parsedDetails = JSON.parse(log.details);
        } catch {
          parsedDetails = null;
        }
      } else {
        parsedDetails = log.details as Record<string, unknown>;
      }
    }

    return {
      id: log.id as number,
      user_id: log.user_id as number | null,
      user_email: log.user_email as string | null,
      user_role: log.user_role as string | null,
      school_id: log.school_id as number | null,
      action: log.action as string,
      module: log.module as string,
      resource_id: log.resource_id as number | null,
      resource_name: log.resource_name as string | null,
      details: parsedDetails,
      ip_address: log.ip_address as string | null,
      user_agent: log.user_agent as string | null,
      status: log.status as "success" | "failure",
      error_message: log.error_message as string | null,
      created_at: log.created_at as string,
    };
  }
}

export { AuditLogError } from "../utils/errors";

// Export singleton instance
export const auditLogService = new AuditLogService();

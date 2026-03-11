import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { JobTitleError } from "../utils/errors";
import { buildSearchTerm } from "../utils/helperFunctions/searchHelper";
import { Knex } from "knex";

/**
 * JobTitleService - Handles all job title business logic
 *
 * Scope:
 *   - "global" = Available for everyone (system users + school users)
 *   - "system" = Only for system-level users (super_admin, super_sub_admin)
 *   - "school" = Only for school-level users (admin, sub_admin)
 */
export class JobTitleService {
  /**
   * Create a new job title
   * Only SuperAdmin/SuperSubAdmin can create job titles
   */
  async createJobTitle(
    name: string,
    description: string | null | undefined,
    scope: "global" | "system" | "school",
    requesterRole: string,
    requesterId: number
  ): Promise<{
    id: number;
    name: string;
    description: string | null;
    scope: string;
    created_by: number;
    created_at: Date;
    updated_at: Date;
  }> {
    // Only super admin can create job titles
    this.validateCreatePermissions(requesterRole);

    // Check uniqueness: name must be unique within the same scope
    await this.ensureJobTitleNameIsUnique(name, scope);

    // Insert job title
    const [newJobTitle] = await db(TABLE.JOB_TITLES)
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        scope,
        created_by: requesterId,
      })
      .returning("*");

    return this.formatJobTitleResponse(newJobTitle);
  }

  /**
   * Get all job titles with pagination and filters
   * SuperAdmin/SuperSubAdmin: Can see all job titles
   * Admin: Can see all job titles (read-only)
   */
  async getAllJobTitles(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      scope?: "global" | "system" | "school" | "all";
    },
    requesterRole: string
  ): Promise<{
    data: Array<{
      id: number;
      name: string;
      description: string | null;
      scope: string;
      created_at: Date;
    }>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const { page = 1, limit = 10, search, scope = "all" } = filters;
    const offset = (page - 1) * limit;

    // Build base query
    let baseQuery = db(TABLE.JOB_TITLES);

    // Apply visibility rules based on role
    baseQuery = this.applyVisibilityFilter(baseQuery, requesterRole);

    // Apply search filter
    if (search) {
      const safeTerm = buildSearchTerm(search);
      baseQuery = baseQuery.where(function () {
        this.where(`${TABLE.JOB_TITLES}.name`, "ilike", safeTerm)
          .orWhere(`${TABLE.JOB_TITLES}.description`, "ilike", safeTerm);
      });
    }

    // Apply scope filter
    if (scope === "global") {
      baseQuery = baseQuery.where(`${TABLE.JOB_TITLES}.scope`, "global");
    } else if (scope === "system") {
      baseQuery = baseQuery.where(`${TABLE.JOB_TITLES}.scope`, "system");
    } else if (scope === "school") {
      baseQuery = baseQuery.where(`${TABLE.JOB_TITLES}.scope`, "school");
    }

    // Get total count
    const totalCountResult = await baseQuery.clone().count(`${TABLE.JOB_TITLES}.id as count`).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    // Get paginated data
    const jobTitles = await baseQuery
      .clone()
      .select(
        `${TABLE.JOB_TITLES}.id`,
        `${TABLE.JOB_TITLES}.name`,
        `${TABLE.JOB_TITLES}.description`,
        `${TABLE.JOB_TITLES}.scope`,
        `${TABLE.JOB_TITLES}.created_at`,
        `${TABLE.JOB_TITLES}.updated_at`
      )
      .offset(offset)
      .limit(limit)
      .orderBy(`${TABLE.JOB_TITLES}.created_at`, "desc");

    return {
      data: jobTitles.map((jt: Record<string, unknown>) => this.formatJobTitleListItem(jt)),
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
   * Get job title by ID
   */
  async getJobTitleById(
    id: number,
    requesterRole: string
  ): Promise<{
    id: number;
    name: string;
    description: string | null;
    scope: string;
    created_by: number;
    created_at: Date;
    updated_at: Date;
  }> {
    const jobTitle = await db(TABLE.JOB_TITLES)
      .select(`${TABLE.JOB_TITLES}.*`)
      .where(`${TABLE.JOB_TITLES}.id`, id)
      .first();

    if (!jobTitle) {
      throw new JobTitleError("Job title not found", 404);
    }

    // Check visibility permissions
    this.validateVisibilityPermissions(requesterRole);

    return this.formatJobTitleResponse(jobTitle);
  }

  /**
   * Update job title
   */
  async updateJobTitle(
    id: number,
    data: { name?: string; description?: string | null; scope?: "global" | "system" | "school" },
    requesterRole: string
  ): Promise<{
    id: number;
    name: string;
    description: string | null;
    scope: string;
    created_by: number;
    created_at: Date;
    updated_at: Date;
  }> {
    const { name, description, scope } = data;

    // Check if job title exists
    const existingJobTitle = await db(TABLE.JOB_TITLES).where("id", id).first();

    if (!existingJobTitle) {
      throw new JobTitleError("Job title not found", 404);
    }

    // Only super admin can update job titles
    this.validateUpdatePermissions(requesterRole);

    // Build update data
    const updateData: Record<string, string | null> = {};

    const finalScope = scope || existingJobTitle.scope;

    if (name !== undefined) {
      // Check name uniqueness if updating
      if (name !== existingJobTitle.name || finalScope !== existingJobTitle.scope) {
        await this.ensureJobTitleNameIsUnique(name, finalScope, id);
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (scope !== undefined) {
      updateData.scope = scope;
      // If only scope changed (not name), check uniqueness for existing name + new scope
      if (name === undefined && scope !== existingJobTitle.scope) {
        await this.ensureJobTitleNameIsUnique(existingJobTitle.name, scope, id);
      }
    }

    // Update job title
    if (Object.keys(updateData).length > 0) {
      const [updatedJobTitle] = await db(TABLE.JOB_TITLES)
        .where("id", id)
        .update(updateData)
        .returning("*");

      return this.formatJobTitleResponse(updatedJobTitle);
    }

    return this.formatJobTitleResponse(existingJobTitle);
  }

  /**
   * Delete job title
   * If force=false and assigned to staff, returns error with count
   * If force=true and assigned to staff, deactivates those users and deletes the job title
   */
  async deleteJobTitle(
    id: number,
    requesterRole: string,
    force: boolean = false
  ): Promise<void> {
    // Check if job title exists
    const existingJobTitle = await db(TABLE.JOB_TITLES).where("id", id).first();

    if (!existingJobTitle) {
      throw new JobTitleError("Job title not found", 404);
    }

    // Only super admin can delete job titles
    this.validateDeletePermissions(requesterRole);

    // Check if job title is assigned to any staff member
    const assignedCount = await db(TABLE.STAFF)
      .where("job_title_id", id)
      .count({ count: "*" })
      .first();

    const count = parseInt(assignedCount?.count as string) || 0;

    if (count > 0 && !force) {
      throw new JobTitleError(
        `This job title is assigned to ${count} user(s). Deleting it will deactivate all assigned users.`,
        409
      );
    }

    // If force delete with assigned users, deactivate them first
    if (count > 0 && force) {
      await db.transaction(async (trx) => {
        // Get all user IDs with this job title
        const staffRows = await trx(TABLE.STAFF)
          .where("job_title_id", id)
          .select("user_id");

        const userIds = staffRows.map((row: { user_id: number }) => row.user_id);

        // Deactivate those users
        if (userIds.length > 0) {
          await trx(TABLE.USERS)
            .whereIn("id", userIds)
            .update({ is_active: false });
        }

        // Clear job_title_id from staff records
        await trx(TABLE.STAFF)
          .where("job_title_id", id)
          .update({ job_title_id: null });

        // Delete the job title
        await trx(TABLE.JOB_TITLES).where("id", id).del();
      });
      return;
    }

    // No assigned users, just delete
    await db(TABLE.JOB_TITLES).where("id", id).del();
  }

  /**
   * Get job titles for dropdown (visible to requester)
   */
  async getJobTitlesForDropdown(
    requesterRole: string
  ): Promise<Array<{ id: number; name: string; scope: string }>> {
    let query = db(TABLE.JOB_TITLES)
      .select("id", "name", "scope")
      .orderBy("name", "asc");

    // Apply visibility filter
    query = this.applyVisibilityFilter(query, requesterRole);

    const jobTitles = await query;

    return jobTitles.map((jt: Record<string, unknown>) => ({
      id: jt.id as number,
      name: jt.name as string,
      scope: jt.scope as string,
    }));
  }

  /**
   * Validate job title assignment to staff
   * Global scope: can be assigned to anyone
   * System scope: only for system-level users (super_admin, super_sub_admin)
   * School scope: only for school-level users (admin, sub_admin)
   */
  async validateJobTitleAssignment(
    jobTitleId: number,
    staffRole: string
  ): Promise<void> {
    const jobTitle = await db(TABLE.JOB_TITLES).where("id", jobTitleId).first();

    if (!jobTitle) {
      throw new JobTitleError("Job title not found", 404);
    }

    const systemRoles = [UserRole.SUPER_ADMIN, UserRole.SUPER_SUB_ADMIN];
    const schoolRoles = [UserRole.ADMIN, UserRole.SUB_ADMIN];

    // System-scoped: only for super_admin / super_sub_admin
    if (jobTitle.scope === "system" && !systemRoles.includes(staffRole as UserRole)) {
      throw new JobTitleError(
        "System-scoped job titles can only be assigned to system-level users",
        400
      );
    }

    // School-scoped: only for admin / sub_admin
    if (jobTitle.scope === "school" && !schoolRoles.includes(staffRole as UserRole)) {
      throw new JobTitleError(
        "School-scoped job titles can only be assigned to school-level users",
        400
      );
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Validate create permissions - only super admin
   */
  private validateCreatePermissions(requesterRole: string): void {
    if (requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.SUPER_SUB_ADMIN) {
      return;
    }

    throw new JobTitleError("Insufficient permissions to create job titles", 403);
  }

  /**
   * Ensure job title name is unique within the same scope
   */
  private async ensureJobTitleNameIsUnique(
    name: string,
    scope: string,
    excludeId?: number
  ): Promise<void> {
    let query = db(TABLE.JOB_TITLES)
      .where("name", "ilike", name.trim())
      .where("scope", scope);

    if (excludeId) {
      query = query.whereNot("id", excludeId);
    }

    const existing = await query.first();

    if (existing) {
      throw new JobTitleError(`Job title "${name}" already exists in ${scope} scope`, 400);
    }
  }

  /**
   * Apply visibility filter based on role
   */
  private applyVisibilityFilter(
    query: Knex.QueryBuilder,
    requesterRole: string
  ): Knex.QueryBuilder {
    if (requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.SUPER_SUB_ADMIN) {
      // SuperAdmin/SuperSubAdmin can see all job titles
      return query;
    }

    if (requesterRole === UserRole.ADMIN || requesterRole === UserRole.SUB_ADMIN) {
      // School Admin/Sub Admin can only see global + school scoped job titles (not system)
      return query.where(function () {
        this.where(`${TABLE.JOB_TITLES}.scope`, "global")
          .orWhere(`${TABLE.JOB_TITLES}.scope`, "school");
      });
    }

    // Other roles: no access
    throw new JobTitleError("Insufficient permissions to view job titles", 403);
  }

  /**
   * Validate visibility permissions
   */
  private validateVisibilityPermissions(requesterRole: string): void {
    if (
      requesterRole === UserRole.SUPER_ADMIN ||
      requesterRole === UserRole.SUPER_SUB_ADMIN ||
      requesterRole === UserRole.ADMIN ||
      requesterRole === UserRole.SUB_ADMIN
    ) {
      return;
    }

    throw new JobTitleError("Insufficient permissions to view job titles", 403);
  }

  /**
   * Validate update permissions - only super admin
   */
  private validateUpdatePermissions(requesterRole: string): void {
    if (requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.SUPER_SUB_ADMIN) {
      return;
    }

    throw new JobTitleError("Insufficient permissions to update job titles", 403);
  }

  /**
   * Validate delete permissions - only super admin
   */
  private validateDeletePermissions(requesterRole: string): void {
    if (requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.SUPER_SUB_ADMIN) {
      return;
    }

    throw new JobTitleError("Insufficient permissions to delete job titles", 403);
  }

  /**
   * Format job title response
   */
  private formatJobTitleResponse(jobTitle: Record<string, unknown>): {
    id: number;
    name: string;
    description: string | null;
    scope: string;
    created_by: number;
    created_at: Date;
    updated_at: Date;
  } {
    return {
      id: jobTitle.id as number,
      name: jobTitle.name as string,
      description: jobTitle.description as string | null,
      scope: jobTitle.scope as string,
      created_by: jobTitle.created_by as number,
      created_at: jobTitle.created_at as Date,
      updated_at: jobTitle.updated_at as Date,
    };
  }

  /**
   * Format job title list item
   */
  private formatJobTitleListItem(jobTitle: Record<string, unknown>): {
    id: number;
    name: string;
    description: string | null;
    scope: string;
    created_at: Date;
  } {
    return {
      id: jobTitle.id as number,
      name: jobTitle.name as string,
      description: jobTitle.description as string | null,
      scope: jobTitle.scope as string,
      created_at: jobTitle.created_at as Date,
    };
  }
}

export default new JobTitleService();

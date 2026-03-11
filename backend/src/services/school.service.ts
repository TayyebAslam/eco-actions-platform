import fs from "fs";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { SchoolError } from "../utils/errors";
import {
  CreateSchoolDTO,
  UpdateSchoolDTO,
  SchoolFilters,
  SchoolResponse,
  SchoolWithStatsResponse,
  SchoolRequestDTO,
  SchoolRequestResponse,
} from "../dto/school.dto";
import { PaginationDTO, PaginatedResponse } from "../dto/user.dto";

/** Raw row shape returned by the schools query */
interface SchoolRow {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  subscription_status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * SchoolService - Handles all school management business logic
 */
export class SchoolService {
  /**
   * Create a new school
   */
  async createSchool(data: CreateSchoolDTO, requesterRole: string): Promise<SchoolResponse> {
    // Permission check
    this.checkCreatePermission(requesterRole);

    const { name, slug, address, subscription_status, logo_url } = data;

    // Generate slug
    const finalSlug = this.generateSlug(name, slug);

    // Check if slug exists
    await this.ensureSlugNotExists(finalSlug);

    // Insert school
    const [newSchool] = await db(TABLE.SCHOOLS)
      .insert({
        name,
        slug: finalSlug,
        logo_url: logo_url || null,
        address: address || null,
        subscription_status: subscription_status || "active",
      })
      .returning("*");

    return this.formatSchoolResponse(newSchool);
  }

  /**
   * Get all schools with pagination
   */
  async getAllSchools(
    filters: SchoolFilters,
    pagination: PaginationDTO
  ): Promise<PaginatedResponse<SchoolWithStatsResponse>> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    let query = db(TABLE.SCHOOLS);

    // Apply search filter
    if (filters.search) {
      query = query.where("name", "ilike", `%${filters.search}%`);
    }

    // Apply status filter
    if (filters.subscription_status) {
      query = query.where("subscription_status", filters.subscription_status);
    }

    // Get total count
    const countQuery = query.clone();
    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    // Get paginated data
    const schools = await query
      .clone()
      .offset(offset)
      .limit(limit)
      .orderBy("created_at", "desc");

    // Add counts for each school
    const schoolsWithStats = await Promise.all(
      schools.map(async (school: SchoolRow) => {
        const [studentsCount, staffCount] = await Promise.all([
          this.getStudentsCount(school.id),
          this.getStaffCount(school.id),
        ]);

        return {
          ...this.formatSchoolResponse(school),
          students_count: studentsCount,
          staff_count: staffCount,
          classes_count: 0,
        };
      })
    );

    return {
      data: schoolsWithStats,
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
  async getAllSchoolswithName(): Promise<Array<{ id: number; name: string }>> {
    const schools = await db(TABLE.SCHOOLS)
    .where("subscription_status", "active")
    .select("id", "name");
    return schools;
  }
  /**
   * Get school by ID with stats
   */
  async getSchoolById(id: number): Promise<SchoolWithStatsResponse> {
    const school = await db(TABLE.SCHOOLS).where("id", id).first();

    if (!school) {
      throw new SchoolError("School not found", 404);
    }

    // Get counts
    const [classesCount, studentsCount, staffCount] = await Promise.all([
      this.getClassesCount(id),
      this.getStudentsCount(id),
      this.getStaffCount(id),
    ]);

    return {
      ...this.formatSchoolResponse(school),
      classes_count: classesCount,
      students_count: studentsCount,
      staff_count: staffCount,
    };
  }

  /**
   * Update school
   */
  async updateSchool(
    id: number,
    data: UpdateSchoolDTO,
    requesterRole: string,
    newLogoPath?: string
  ): Promise<SchoolResponse> {
    // Permission check
    this.checkUpdatePermission(requesterRole);

    // Check if school exists
    const existingSchool = await db(TABLE.SCHOOLS).where("id", id).first();
    if (!existingSchool) {
      throw new SchoolError("School not found", 404);
    }

    const { name, slug, address, subscription_status } = data;

    // Check slug uniqueness if updating
    if (slug && slug !== existingSchool.slug) {
      await this.ensureSlugNotExists(slug, id);
    }

    // Build update data
    const updateData: Record<string, string | null> = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;
    if (address !== undefined) updateData.address = address;
    if (subscription_status) updateData.subscription_status = subscription_status;

    // Handle logo update
    if (newLogoPath) {
      this.deleteOldLogo(existingSchool.logo_url);
      updateData.logo_url = newLogoPath;
    }

    const [updatedSchool] = await db(TABLE.SCHOOLS)
      .where("id", id)
      .update(updateData)
      .returning("*");

    return this.formatSchoolResponse(updatedSchool);
  }

  /**
   * Delete school
   */
  async deleteSchool(id: number, requesterRole: string): Promise<void> {
    // Only Super Admin or Super Sub-Admin can delete
    if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
      throw new SchoolError("Only Super Admin or Super Sub-Admin can delete schools", 403);
    }

    const school = await db(TABLE.SCHOOLS).where("id", id).first();
    if (!school) {
      throw new SchoolError("School not found", 404);
    }

    // Delete logo file
    this.deleteOldLogo(school.logo_url);

    // Delete school (cascade handles related data)
    await db(TABLE.SCHOOLS).where("id", id).del();
  }

  /**
   * Toggle school subscription status
   */
  async toggleStatus(id: number, requesterRole: string): Promise<{ subscription_status: string }> {
    this.checkUpdatePermission(requesterRole);

    const school = await db(TABLE.SCHOOLS).where("id", id).first();
    if (!school) {
      throw new SchoolError("School not found", 404);
    }

    const newStatus = school.subscription_status === "active" ? "inactive" : "active";
    await db(TABLE.SCHOOLS).where("id", id).update({ subscription_status: newStatus });

    return { subscription_status: newStatus };
  }

  /**
   * Submit school registration request (for admin signup flow)
   */
  async submitSchoolRequest(
    data: SchoolRequestDTO,
    user: { id: number; email: string; first_name: string; last_name: string; password_hash: string; school_id?: number },
    logoPath?: string
  ): Promise<SchoolRequestResponse> {
    // Check if admin already has a school
    if (user.school_id) {
      throw new SchoolError("You already have a school assigned", 400);
    }

    // Check for pending request
    const existingRequest = await db(TABLE.SCHOOL_REQUESTS)
      .where({ admin_email: user.email, status: "pending" })
      .first();

    if (existingRequest) {
      throw new SchoolError("You already have a pending school registration request", 400);
    }

    const { name, slug, address } = data;
    const finalSlug = this.generateSlug(name, slug);

    // Check if school with slug exists
    await this.ensureSlugNotExists(finalSlug);

    // Check if slug exists in pending requests
    const existingSlugRequest = await db(TABLE.SCHOOL_REQUESTS)
      .where({ school_slug: finalSlug, status: "pending" })
      .first();

    if (existingSlugRequest) {
      throw new SchoolError("School slug already taken. Please choose another.", 400);
    }

    // Create request
    const [newRequest] = await db(TABLE.SCHOOL_REQUESTS)
      .insert({
        admin_email: user.email,
        admin_first_name: user.first_name,
        admin_last_name: user.last_name,
        admin_password_hash: user.password_hash,
        school_name: name,
        school_slug: finalSlug,
        school_address: address || null,
        school_logo_url: logoPath || null,
        status: "pending",
        email_verified: true,
        user_id: user.id,
      })
      .returning("*");

    return {
      request_id: newRequest.id,
      status: "pending",
    };
  }

  // ============ PRIVATE HELPER METHODS ============

  private checkCreatePermission(role: string): void {
    if (role !== UserRole.SUPER_ADMIN && role !== UserRole.SUPER_SUB_ADMIN && role !== UserRole.ADMIN) {
      throw new SchoolError("You don't have permission to create schools", 403);
    }
  }

  private checkUpdatePermission(role: string): void {
    if (role !== UserRole.SUPER_ADMIN && role !== UserRole.SUPER_SUB_ADMIN && role !== UserRole.ADMIN) {
      throw new SchoolError("You don't have permission to update schools", 403);
    }
  }

  private generateSlug(name: string, slug?: string): string {
    return slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  private async ensureSlugNotExists(slug: string, excludeId?: number): Promise<void> {
    let query = db(TABLE.SCHOOLS).where({ slug });
    if (excludeId) {
      query = query.whereNot("id", excludeId);
    }
    const existing = await query.first();
    if (existing) {
      throw new SchoolError("School with this slug already exists", 400);
    }
  }

private async getClassesCount(schoolId: number): Promise<number> {
  const result = await db(TABLE.CLASSES)
    .join(TABLE.STUDENTS, `${TABLE.STUDENTS}.class_id`, `${TABLE.CLASSES}.id`)
    .where(`${TABLE.STUDENTS}.school_id`, schoolId)
    .countDistinct(`${TABLE.CLASSES}.id as count`)
    .first();

  return parseInt(result?.count as string) || 0;
}


private async getStudentsCount(schoolId: number): Promise<number> {
  const result = await db(TABLE.STUDENTS)
    .where("school_id", schoolId)
    .count({ count: "*" })
    .first();

  return parseInt(result?.count as string) || 0;
}



  private async getStaffCount(schoolId: number): Promise<number> {
    const result = await db(TABLE.STAFF)
      .where("school_id", schoolId)
      .count({ count: "*" })
      .first();
    return parseInt(result?.count as string) || 0;
  }

  private deleteOldLogo(logoUrl: string | null): void {
    if (logoUrl) {
      try {
        fs.unlinkSync(`public${logoUrl}`);
      } catch (e) {
        // Ignore - file might not exist
      }
    }
  }

  private formatSchoolResponse(school: SchoolRow): SchoolResponse {
    return {
      ...school,
      logo_url: school.logo_url ? process.env.BASE_URL + school.logo_url : null,
    };
  }
}

export { SchoolError } from "../utils/errors";

// Export singleton instance
export const schoolService = new SchoolService();

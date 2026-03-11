import bcrypt from "bcryptjs";
import { generatePassword } from "../utils/helperFunctions/passwordHelper";
import { Knex } from "knex";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { TeacherError } from "../utils/errors";
import {
  CreateTeacherDTO,
  UpdateTeacherDTO,
  TeacherFilters,
  TeacherResponse,
  TeacherWithStatsResponse,
} from "../dto/teacher.dto";
import { PaginationDTO, PaginatedResponse } from "../dto/user.dto";
import { EmailService } from "../utils/services/emailService";
import { getErrorMessage } from "../utils/helperFunctions/errorHelper";
import { buildSearchTerm } from "../utils/helperFunctions/searchHelper";
import { randomInt } from "crypto";
import logger from "../utils/logger";

/** Raw row shape returned by the base teacher query join */
interface TeacherRow {
  id: number;
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  avatar_url: string | null;
  school_id: number;
  school_name: string;
  created_at: string;
  [key: string]: unknown;
}

/**
 * TeacherService - Handles all teacher management business logic
 */
export class TeacherService {
  private readonly SALT_ROUNDS = 10;

  /**
   * Create a new teacher
   */
  async createTeacher(data: CreateTeacherDTO): Promise<TeacherResponse> {
    const { email, first_name, last_name, school_id } = data;
    const password = generatePassword();

    // Check email exists
    await this.ensureEmailNotExists(email);

    // Verify school exists
    await this.ensureSchoolExists(school_id);

    // Get teacher role
    const teacherRole = await db(TABLE.ROLES).where({ name: UserRole.TEACHER }).first();
    if (!teacherRole) {
      throw new TeacherError("Teacher role not found", 500);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Transaction
    const result = await this.withTransaction(async (trx) => {
      // Create user
      const [newUser] = await trx(TABLE.USERS)
        .insert({
          email,
          password_hash: hashedPassword,
          role_id: teacherRole.id,
          first_name,
          last_name,
          is_active: true,
          school_id,
        })
        .returning("*");

      // Create staff profile
      await trx(TABLE.STAFF).insert({
        user_id: newUser.id,
        school_id,
      });

      return newUser;
    });

    // Send welcome email outside transaction so email failure doesn't rollback teacher creation
    try {
      const emailService = new EmailService();
      const fullName = last_name ? `${first_name} ${last_name}` : first_name;
      emailService.queueWelcomeEmail(email, password, fullName, UserRole.TEACHER);
      await emailService.sendQueuedEmails();
    } catch (emailError) {
      logger.error("Failed to send teacher welcome email:", emailError);
    }

    return this.getTeacherById(result.id);
  }

  /**
   * Get all teachers with pagination
   * Visibility rules:
   * - Super admins can see teachers across all schools (can filter by school via query)
   * - Non-super-admins (admins, sub-admins, students, etc.) can only see teachers from their own school
   */
  async getAllTeachers(
    filters: TeacherFilters,
    pagination: PaginationDTO,
    requesterRole: string,
    requesterSchoolId?: number
  ): Promise<PaginatedResponse<TeacherResponse>> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.baseTeacherQuery();

    // Restrict visibility based on requester role
    if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
      // Non-super-admins can only see teachers for their own school
      if (!requesterSchoolId) {
        throw new TeacherError("Your account is not associated with a school", 403);
      }
      query = query.where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
    } else {
      // Super admin/Super sub-admin may optionally filter by school
      if (filters.school_id) {
        query = query.where(`${TABLE.STAFF}.school_id`, filters.school_id);
      }
    }

    if (filters.search) {
      const searchTerm = buildSearchTerm(filters.search);
      query = query.where((builder) => {
        builder
          .where(`${TABLE.USERS}.first_name`, "ilike", searchTerm)
          .orWhere(`${TABLE.USERS}.last_name`, "ilike", searchTerm)
          .orWhere(`${TABLE.USERS}.email`, "ilike", searchTerm)
          .orWhere(`${TABLE.STAFF}.contact_number`, "ilike", searchTerm)
          .orWhereRaw(
            `concat(${TABLE.USERS}.first_name, ' ', ${TABLE.USERS}.last_name) ilike ?`,
            [searchTerm]
          );
      });
    }

    if (filters.is_active !== undefined) {
      query = query.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    // Build a separate count query to avoid GROUP BY issues with selected columns
    let countQuery = db(TABLE.STAFF)
      .join(TABLE.USERS, `${TABLE.STAFF}.user_id`, `${TABLE.USERS}.id`)
      .join(TABLE.SCHOOLS, `${TABLE.STAFF}.school_id`, `${TABLE.SCHOOLS}.id`)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
      .where(`${TABLE.USERS}.is_deleted`, false);

    // Apply the same filters to count query
    if (requesterRole !== UserRole.SUPER_ADMIN && requesterRole !== UserRole.SUPER_SUB_ADMIN) {
      if (requesterSchoolId) {
        countQuery = countQuery.where(`${TABLE.STAFF}.school_id`, requesterSchoolId);
      }
    } else {
      if (filters.school_id) {
        countQuery = countQuery.where(`${TABLE.STAFF}.school_id`, filters.school_id);
      }
    }

    if (filters.search) {
      const searchTerm = buildSearchTerm(filters.search);
      countQuery = countQuery.where((builder) => {
        builder
          .where(`${TABLE.USERS}.first_name`, "ilike", searchTerm)
          .orWhere(`${TABLE.USERS}.last_name`, "ilike", searchTerm)
          .orWhere(`${TABLE.USERS}.email`, "ilike", searchTerm)
          .orWhere(`${TABLE.STAFF}.contact_number`, "ilike", searchTerm)
          .orWhereRaw(
            `concat(${TABLE.USERS}.first_name, ' ', ${TABLE.USERS}.last_name) ilike ?`,
            [searchTerm]
          );
      });
    }

    if (filters.is_active !== undefined) {
      countQuery = countQuery.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    // Get paginated data
    const teachers = await query
      .clone()
      .offset(offset)
      .limit(limit)
      .orderBy(`${TABLE.USERS}.created_at`, "desc");

    // Format teachers
    const formattedTeachers = teachers.map((teacher: TeacherRow) =>
      this.formatTeacherResponse(teacher)
    );

    return {
      data: formattedTeachers,
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
   * Get teacher by ID with stats
   */
  async getTeacherById(id: number): Promise<TeacherWithStatsResponse> {
    const userId = Number(id);
    if (Number.isNaN(userId)) {
      throw new TeacherError("Invalid teacher id", 400);
    }

    const teacher = await this.baseTeacherQuery()
      .where(`${TABLE.STAFF}.user_id`, userId)
      .first();

    if (!teacher) {
      throw new TeacherError("Teacher not found", 404);
    }

    return {
      ...this.formatTeacherResponse(teacher),
      students_count: 0,
    };
  }

  /**
   * Update teacher
   */
  async updateTeacher(
    id: number,
    data: UpdateTeacherDTO
  ): Promise<TeacherResponse> {
    // Check if teacher exists
    await this.ensureTeacherExists(id);

    const { first_name, last_name, is_active, email } = data;

    await this.withTransaction(async (trx) => {
      // Update user table
      const userUpdateData: Record<string, string | boolean> = {};
      if (email !== undefined) {
        await this.ensureEmailNotExists(email, id);
        userUpdateData.email = email;
      }
      if (first_name !== undefined) userUpdateData.first_name = first_name;
      if (last_name !== undefined) userUpdateData.last_name = last_name;
      if (is_active !== undefined) userUpdateData.is_active = is_active;

      if (Object.keys(userUpdateData).length > 0) {
        await trx(TABLE.USERS).where("id", id).update(userUpdateData);
      }
    });

    return this.getTeacherById(id);
  }

  /**
   * Delete teacher (soft delete)
   */
  async deleteTeacher(id: number): Promise<void> {
    await this.ensureTeacherExists(id);

    // Soft delete: set is_deleted = true and deleted_at timestamp
    await db(TABLE.USERS)
      .where("id", id)
      .update({
        is_deleted: true,
        deleted_at: db.fn.now(),
      });
  }

  // ============ PRIVATE HELPER METHODS ============

  private async withTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    return await db.transaction(async (trx) => {
      return await callback(trx);
    });
  }

  private checkPermission(role: string, action: string): void {
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.SUPER_SUB_ADMIN, UserRole.ADMIN, UserRole.SUB_ADMIN];

    if (action === "delete") {
      // Only Super Admin, Super Sub-Admin, and Admin can delete
      if (role !== UserRole.SUPER_ADMIN && role !== UserRole.SUPER_SUB_ADMIN && role !== UserRole.ADMIN) {
        throw new TeacherError("You don't have permission to delete teachers", 403);
      }
    } else {
      if (!allowedRoles.includes(role as UserRole)) {
        throw new TeacherError(`You don't have permission to ${action} teachers`, 403);
      }
    }
  }

  private async ensureEmailNotExists(email: string, excludeUserId?: number): Promise<void> {
    const query = db(TABLE.USERS).where("email", email).where("is_deleted", false);
    if (excludeUserId !== undefined) {
      query.andWhereNot("id", excludeUserId);
    }

    const existing = await query.first();
    if (existing) {
      throw new TeacherError("Email already registered", 400);
    }
  }

  private async ensureSchoolExists(schoolId: number): Promise<void> {
    const school = await db(TABLE.SCHOOLS).where("id", schoolId).first();
    if (!school) {
      throw new TeacherError("School not found", 404);
    }
  }

  private async ensureTeacherExists(userId: number): Promise<void> {
    const uid = Number(userId);
    if (Number.isNaN(uid)) {
      throw new TeacherError("Invalid teacher id", 400);
    }

    const teacher = await db(TABLE.STAFF)
      .join(TABLE.USERS, `${TABLE.STAFF}.user_id`, `${TABLE.USERS}.id`)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.STAFF}.user_id`, uid)
      .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .first();

    if (!teacher) {
      throw new TeacherError("Teacher not found", 404);
    }
  }

  private baseTeacherQuery() {
    return db(TABLE.STAFF)
      .select(
        `${TABLE.STAFF}.*`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.SCHOOLS}.name as school_name`
      )
      .join(TABLE.USERS, `${TABLE.STAFF}.user_id`, `${TABLE.USERS}.id`)
      .join(TABLE.SCHOOLS, `${TABLE.STAFF}.school_id`, `${TABLE.SCHOOLS}.id`)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
      .where(`${TABLE.USERS}.is_deleted`, false);
  }

  private formatTeacherResponse(teacher: TeacherRow): TeacherResponse {
    return {
      id: teacher.id,
      user_id: teacher.user_id,
      email: teacher.email,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      is_active: teacher.is_active,
      avatar_url: teacher.avatar_url ? process.env.BASE_URL + teacher.avatar_url : null,
      school_id: teacher.school_id,
      school_name: teacher.school_name,
      created_at: teacher.created_at,
    };
  }

  /**
   * Bulk upload teachers from CSV/XLSX file
   */
  async bulkUploadTeachers(
    fileBuffer: Buffer,
    fileName: string,
    userRole: string,
    userSchoolId?: number
  ): Promise<{ success: number; errors: Array<{ row: number; error: string }> }> {
    try {
      // 1. Parse the file
      const parsedData = await this.parseUploadFile(fileBuffer, fileName);

      // 2. Check row limit to prevent memory exhaustion
      const MAX_ROWS = 500;
      if (parsedData.length > MAX_ROWS) {
        throw new TeacherError(
          `File contains ${parsedData.length} rows. Maximum allowed is ${MAX_ROWS}`,
          400
        );
      }

      // 3. Validate parsed data
      const { errors: validationErrors, totalErrors } = this.validateUploadData(parsedData);

      if (totalErrors > 0) {
        throw new TeacherError(
          `Validation failed: ${totalErrors} error(s) found in the uploaded file`,
          400,
          { errors: validationErrors }
        );
      }

      // 4. Determine school ID
      const schoolId = this.determineSchoolId(userRole, userSchoolId);

      // 5. Ensure school exists
      await this.ensureSchoolExists(schoolId);

      // 6. Validate emails against database
      const { dbErrors, totalDbErrors } = await this.validateEmails(parsedData);

      if (totalDbErrors > 0) {
        throw new TeacherError(
          `Database validation failed: ${totalDbErrors} error(s) found`,
          400,
          { errors: dbErrors }
        );
      }

      // 7. Insert teachers
      const result = await this.insertTeachers(parsedData, schoolId);

      return result;
    } catch (error: unknown) {
      if (error instanceof TeacherError) throw error;
      throw new TeacherError(getErrorMessage(error), 500);
    }
  }

  private async parseUploadFile(
    fileBuffer: Buffer,
    fileName: string
  ): Promise<Array<{ name: string; email: string; contactNumber: string; rowNumber: number }>> {
    const XLSX = await import("xlsx");
    const requiredHeaders = ["name", "email", "contact number"];

    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      throw new TeacherError("Invalid file format. Only CSV and XLSX files are allowed", 400);
    }

    const isCSV = fileName.toLowerCase().endsWith(".csv");

    const workbook = XLSX.read(
      isCSV ? fileBuffer.toString("utf8") : fileBuffer,
      { type: isCSV ? "string" : "buffer" }
    );

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new TeacherError("The uploaded file is empty or has no sheets", 400);
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as Array<Array<string | number>>;

    if (jsonData.length === 0) throw new TeacherError("The uploaded file contains no data", 400);

    // Normalize headers to lowercase for case-insensitive matching
    const actualHeaders = jsonData[0]!.map((header) => String(header || "").trim().toLowerCase());
    const missingHeaders = requiredHeaders.filter((h) => !actualHeaders.includes(h));

    if (missingHeaders.length > 0) {
      throw new TeacherError(
        `Missing required headers: ${missingHeaders.join(", ")}. Expected headers: Name, Email, Contact Number`,
        400
      );
    }

    // Get column indices
    const nameIndex = actualHeaders.indexOf("name");
    const emailIndex = actualHeaders.indexOf("email");
    const contactIndex = actualHeaders.indexOf("contact number");

    return jsonData
      .slice(1)
      .filter((row) => {
        // Filter out completely empty rows
        return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
      })
      .map((row, index) => {
        const name = String(row[nameIndex] || "").trim();
        const email = String(row[emailIndex] || "").trim().toLowerCase();
        const contactNumber = String(row[contactIndex] || "").trim();

        return {
          name,
          email,
          contactNumber,
          rowNumber: index + 2, // +2 because: +1 for header row, +1 for 1-based indexing
        };
      });
  }

  private validateUploadData(
    data: Array<{ name: string; email: string; contactNumber: string; rowNumber: number }>
  ): { errors: Array<{ row: number; errors: string[] }>; totalErrors: number } {
    const errors: Array<{ row: number; errors: string[] }> = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let totalErrors = 0;
    const MAX_ERRORS_TO_SHOW = 5;

    for (const row of data) {
      const rowErrors: string[] = [];

      // Validate name
      if (!row.name || row.name.trim() === "") {
        rowErrors.push("Name is required");
      }

      // Validate email
      if (!row.email || row.email.trim() === "") {
        rowErrors.push("Email is required");
      } else if (!emailRegex.test(row.email)) {
        rowErrors.push("Invalid email format");
      }

      // Validate contact number (optional field)
      if (row.contactNumber && row.contactNumber.length > 0) {
        // Only validate format if provided
        const cleanContact = row.contactNumber.replace(/[\s\-\(\)]/g, "");
        if (!/^\+?[\d]{7,15}$/.test(cleanContact)) {
          rowErrors.push("Invalid contact number format");
        }
      }

      if (rowErrors.length > 0) {
        totalErrors++;
        if (errors.length < MAX_ERRORS_TO_SHOW) {
          errors.push({ row: row.rowNumber, errors: rowErrors });
        }
      }
    }

    return { errors, totalErrors };
  }

  private determineSchoolId(userRole: string, userSchoolId?: number): number {
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.SUPER_SUB_ADMIN) {
      if (!userSchoolId) {
        throw new TeacherError("Super admin/Super sub-admin must provide school_id for bulk upload", 400);
      }
      return userSchoolId;
    } else if (userRole === UserRole.ADMIN || userRole === UserRole.SUB_ADMIN) {
      if (!userSchoolId) {
        throw new TeacherError("Your account is not associated with a school", 403);
      }
      return userSchoolId;
    } else {
      throw new TeacherError("You don't have permission to bulk upload teachers", 403);
    }
  }

  private async validateEmails(
    data: Array<{ name: string; email: string; rowNumber: number }>
  ): Promise<{
    dbErrors: Array<{ row: number; errors: string[] }>;
    totalDbErrors: number;
  }> {
    const dbErrors: Array<{ row: number; errors: string[] }> = [];
    let totalDbErrors = 0;
    const MAX_ERRORS_TO_SHOW = 5;

    // Batch query: Get all existing emails at once
    const uniqueEmails = data.map((r) => r.email);
    const existingUsers = await db(TABLE.USERS).whereIn("email", uniqueEmails).select("email");
    const existingEmailSet = new Set(existingUsers.map((u) => u.email));

    // Track duplicate emails within file
    const emailSet = new Set<string>();

    for (const row of data) {
      const rowErrors: string[] = [];

      // Check for duplicate email in the file
      if (emailSet.has(row.email)) {
        rowErrors.push(`Duplicate email in file: ${row.email}`);
      } else {
        emailSet.add(row.email);
      }

      // Check if email already exists in database
      if (existingEmailSet.has(row.email)) {
        rowErrors.push(`Email already exists in database: ${row.email}`);
      }

      if (rowErrors.length > 0) {
        totalDbErrors++;
        if (dbErrors.length < MAX_ERRORS_TO_SHOW) {
          dbErrors.push({ row: row.rowNumber, errors: rowErrors });
        }
      }
    }

    return { dbErrors, totalDbErrors };
  }

  private async insertTeachers(
    data: Array<{ name: string; email: string; contactNumber: string; rowNumber: number }>,
    schoolId: number
  ): Promise<{ success: number; errors: Array<{ row: number; error: string }> }> {
    const teacherRole = await db(TABLE.ROLES).where({ name: UserRole.TEACHER }).first();
    if (!teacherRole) throw new TeacherError("Teacher role not found in database", 500);

    const emailService = new EmailService();

    // All-or-nothing transaction - any error will rollback all inserts
    await this.withTransaction(async (trx) => {
      for (const row of data) {
        // Split name into first and last name
        const nameParts = row.name.trim().split(/\s+/);
        const first_name = nameParts[0];
        const last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        // Generate random password
        const password = this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        // Insert user
        const [newUser] = await trx(TABLE.USERS)
          .insert({
            email: row.email,
            password_hash: hashedPassword,
            role_id: teacherRole.id,
            first_name,
            last_name,
            is_active: true,
            school_id: schoolId,
          })
          .returning("*");

        // Insert staff profile
        await trx(TABLE.STAFF).insert({
          user_id: newUser.id,
          school_id: schoolId,
          contact_number: row.contactNumber || null,
        });

        // Queue welcome email (will be sent after transaction commits)
        emailService.queueWelcomeEmail(row.email, password, row.name, UserRole.TEACHER);
      }
    });

    // Send all queued emails after transaction commits successfully
    await emailService.sendQueuedEmails();

    return { success: data.length, errors: [] };
  }

  private generateRandomPassword(length: number = 12): string {
     // Define character classes matching password validation regex
     const lowercase = "abcdefghijklmnopqrstuvwxyz";
     const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
     const digits = "0123456789";
     const specialChars = "!@#$%*?&"; // Only allowed special chars from regex
     
     // Ensure minimum length to accommodate all required classes
     if (length < 4) length = 12;
     
     // Guarantee at least one character from each required class
     const password = [
       lowercase.charAt(randomInt(lowercase.length)),
       uppercase.charAt(randomInt(uppercase.length)),
       digits.charAt(randomInt(digits.length)),
       specialChars.charAt(randomInt(specialChars.length)),
     ];
     
     // Fill remaining length with random characters from all classes
     const allChars = lowercase + uppercase + digits + specialChars;
     for (let i = password.length; i < length; i++) {
       password.push(allChars.charAt(randomInt(allChars.length)));
     }
     
     // Shuffle the password array to avoid predictable pattern
     for (let i = password.length - 1; i > 0; i--) {
       const j = randomInt(i + 1);
       [password[i], password[j]] = [password[j]!, password[i]!];
     }
     
     return password.join("");
   }
}

export { TeacherError } from "../utils/errors";

// Export singleton instance
export const teacherService = new TeacherService();

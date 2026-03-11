import bcrypt from "bcryptjs";
import { Knex } from "knex";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { sendWelcomeEmail } from "../utils/services/nodemailer/welcomeEmail";
import {
  CreateUserDTO,
  UpdateUserDTO,
  UserFilters,
  PaginationDTO,
  UserResponse,
  PaginatedResponse,
  SchoolUsersPaginatedResponse,
  SchoolUserDetailResponse,
  SchoolUserStatsResponse,
  ExportUserRow,
  ExtendedUserFilters,
  StatsRow,
  BadgeCountRow,
  ActivityStatsRow,
  UserQueryRow,
  WeeklyPointsRow,
  ActivityBreakdownRow,
  RecentBadgeRow,
  RecentActivityRow,
  SchoolRankRow,
} from "../dto/user.dto";
import { BaseService } from "./base/BaseService";
import { invalidateUser, invalidateUserComplete } from "../utils/services/redis/cacheInvalidation";
import { UserError } from "../utils/errors";
import { getErrorMessage } from "../utils/helperFunctions/errorHelper";
import logger from "../utils/logger";

/**
 * UserService - Handles all user management business logic
 */
export class UserService extends BaseService {
  private readonly SALT_ROUNDS = 10;

  /**
   * Create a new user with profile
   */
  async createUser(data: CreateUserDTO): Promise<UserResponse> {
    const { email, password, first_name, last_name, role, school_id, section_id } = data;

    // Check if email already exists
    await this.ensureEmailNotExists(email);

    // Get role record
    const roleName = role || UserRole.STUDENT;
    const roleRecord = await this.getRoleByName(roleName);

    if (!roleRecord) {
      throw new UserError("Invalid role", 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Use transaction for atomic operations
    const newUser = await this.withTransaction(async (trx) => {
      // Create user
      const [user] = await trx(TABLE.USERS)
        .insert({
          email,
          password_hash: hashedPassword,
          first_name,
          last_name,
          role_id: roleRecord.id,
          is_active: true,
        })
        .returning(["id", "email", "first_name", "last_name", "is_active", "created_at"]);

      // Create profile based on role
      await this.createUserProfile(trx, user.id, roleName, school_id, section_id);

      // Send welcome email
      await this.sendWelcomeEmailSafe(email, password, first_name, last_name, roleName);

      return { ...user, role: roleName };
    });

    return newUser;
  }

  /**
   * Update user
   */
  async updateUser(id: number, data: UpdateUserDTO): Promise<UserResponse> {
    const { email, first_name, last_name } = data;

    // Check if email is unique (exclude current user)
    if (email) {
      const existingUser = await db(TABLE.USERS)
        .where({ email })
        .whereNot("id", id)
        .first();

      if (existingUser) {
        throw new UserError("Email already exists", 400);
      }
    }

    // Build update data
    const updateData: Record<string, string | boolean> = {};
    if (email) updateData.email = email;
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;

    // Update role if provided
    if (data.is_active !== undefined) {
      updateData.is_active = data.is_active;
    }

    const [updatedUser] = await db(TABLE.USERS)
      .where({ id })
      .update(updateData)
      .returning(["id", "email", "first_name", "last_name", "is_active", "created_at"]);

    if (!updatedUser) {
      throw new UserError("User not found", 404);
    }

    await invalidateUser(id);

    const userWithRole = await this.getUserById(id);
    return userWithRole;
  }

  /**
   * Get all users with pagination and filters
   */
  async getAllUsers(
    filters: UserFilters,
    pagination: PaginationDTO
  ): Promise<PaginatedResponse<UserResponse>> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    let query = db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .select(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.ROLES}.name as role`
      )
      .where(`${TABLE.USERS}.is_deleted`, false); // Exclude soft-deleted users

    // Apply filters
    if (filters.search) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.USERS}.first_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.last_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.email`, "ilike", `%${filters.search}%`);
      });
    }

    if (filters.role) {
      query = query.where(`${TABLE.ROLES}.name`, filters.role);
    }

    if (filters.is_active !== undefined) {
      query = query.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    // Get total count - create a separate query to avoid GROUP BY issues
    let countQuery = db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.USERS}.is_deleted`, false);

    if (filters.search) {
      countQuery = countQuery.where((builder) => {
        builder
          .where(`${TABLE.USERS}.first_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.last_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.email`, "ilike", `%${filters.search}%`);
      });
    }

    if (filters.role) {
      countQuery = countQuery.where(`${TABLE.ROLES}.name`, filters.role);
    }

    if (filters.is_active !== undefined) {
      countQuery = countQuery.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    // Get paginated data
    const users = await query
      .offset(offset)
      .limit(limit)
      .orderBy(`${TABLE.USERS}.created_at`, "desc");

    // Add base URL to avatar
    const usersWithAvatar = users.map((user: UserResponse) => ({
      ...user,
      avatar_url: user.avatar_url ? process.env.BASE_URL + user.avatar_url : null,
    }));

    return {
      data: usersWithAvatar,
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
   * Get all users of a specific school with pagination and filters
   */
  async getSchoolUsers(
    schoolId: number,
    filters: ExtendedUserFilters,
    pagination: PaginationDTO
  ): Promise<SchoolUsersPaginatedResponse> {
    const { page = 1, limit = 10 } = pagination;

    // Use BaseService helper for offset
    const { offset } = this.paginate(page, limit);

    const classId = Number(filters.class_id);
    const sectionId = Number(filters.section_id);
    const sortByRaw = String(filters.sort_by || "name").toLowerCase();
    const sortOrderRaw = String(filters.sort_order || "asc").toLowerCase();
    const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";

    let baseQuery = this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CLASSES, `${TABLE.CLASSES}.id`, `${TABLE.STUDENTS}.class_id`)
      .leftJoin(TABLE.SECTIONS, `${TABLE.SECTIONS}.id`, `${TABLE.STUDENTS}.section_id`)
      .leftJoin(TABLE.LEVELS, `${TABLE.LEVELS}.id`, `${TABLE.STUDENTS}.level`)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false);

    if (filters.role) {
      baseQuery = baseQuery.where(`${TABLE.ROLES}.name`, filters.role);
    }

    // Search filter using BaseService helper
    if (filters.search) {
      baseQuery = baseQuery.where((builder) => {
        builder
          .where(`${TABLE.USERS}.first_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.last_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.email`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.CLASSES}.name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.SECTIONS}.name`, "ilike", `%${filters.search}%`);
      });
    }

    if (Number.isFinite(classId) && classId > 0) {
      baseQuery = baseQuery.where(`${TABLE.STUDENTS}.class_id`, classId);
    }

    if (Number.isFinite(sectionId) && sectionId > 0) {
      baseQuery = baseQuery.where(`${TABLE.STUDENTS}.section_id`, sectionId);
    }

    // Stats should include both active and inactive counts for current dataset
    const statsRow = await baseQuery
      .clone()
      .clearSelect()
      .select(
        this.db.raw(`COUNT(DISTINCT ??)::int as total_students`, [`${TABLE.USERS}.id`]),
        this.db.raw(`SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END)::int as active_students`, [`${TABLE.USERS}.is_active`]),
        this.db.raw(`SUM(CASE WHEN ?? = false THEN 1 ELSE 0 END)::int as inactive_students`, [`${TABLE.USERS}.is_active`]),
        this.db.raw(`COALESCE(ROUND(AVG(COALESCE(??, 0))), 0)::int as avg_points`, [`${TABLE.STUDENTS}.total_points`])
      )
      .first<StatsRow>();

    // Status filter applies only to list rows
    let listQuery = baseQuery.clone();
    if (filters.is_active !== undefined) {
      listQuery = listQuery.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    const totalCountResult = await listQuery
      .clone()
      .clearSelect()
      .countDistinct<{ count: string }>(`${TABLE.USERS}.id as count`)
      .first();
    const totalCount = totalCountResult ? parseInt(totalCountResult.count) : 0;

    // Fetch paginated users
    let usersQuery = listQuery
      .clone()
      .select<UserQueryRow[]>(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.ROLES}.name as role`,
        `${TABLE.STUDENTS}.level as level_id`,
        `${TABLE.STUDENTS}.total_points`,
        `${TABLE.STUDENTS}.streak_days`,
        `${TABLE.STUDENTS}.class_id`,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.CLASSES}.name as class_name`,
        `${TABLE.SECTIONS}.name as section_name`,
        `${TABLE.LEVELS}.title as level_title`
      )
      .orderBy(`${TABLE.USERS}.id`, "desc")
      .offset(offset)
      .limit(limit);

    if (sortByRaw === "name") {
      usersQuery = usersQuery
        .clearOrder()
        .orderBy(`${TABLE.USERS}.first_name`, sortOrder)
        .orderBy(`${TABLE.USERS}.last_name`, sortOrder)
        .orderBy(`${TABLE.USERS}.id`, "desc");
    } else if (sortByRaw === "points") {
      usersQuery = usersQuery
        .clearOrder()
        .orderBy(`${TABLE.STUDENTS}.total_points`, sortOrder)
        .orderBy(`${TABLE.USERS}.id`, "desc");
    } else if (sortByRaw === "level") {
      usersQuery = usersQuery
        .clearOrder()
        .orderBy(`${TABLE.STUDENTS}.level`, sortOrder)
        .orderBy(`${TABLE.USERS}.id`, "desc");
    } else if (sortByRaw === "recent") {
      usersQuery = usersQuery
        .clearOrder()
        .orderBy(`${TABLE.USERS}.created_at`, "desc");
    }

    const users = await usersQuery;
    const userIds = users.map((u) => Number(u.id)).filter(Number.isFinite);

    const [badgeRows, activityRows] = await Promise.all([
      userIds.length > 0
        ? this.db(TABLE.STUDENT_BADGES)
            .select("user_id")
            .count({ badges_count: "*" })
            .whereIn("user_id", userIds)
            .groupBy("user_id")
        : Promise.resolve<BadgeCountRow[]>([]),
      userIds.length > 0
        ? this.db(TABLE.ACTIVITIES)
            .select("user_id")
            .count({ activities_count: "*" })
            .max({ last_activity_at: "created_at" })
            .whereIn("user_id", userIds)
            .groupBy("user_id")
        : Promise.resolve<ActivityStatsRow[]>([]),
    ]);

    const badgeCountMap = new Map<number, number>(
      (badgeRows as BadgeCountRow[]).map((row) => [Number(row.user_id), Number(row.badges_count) || 0])
    );
    const activityStatsMap = new Map<number, { activities_count: number; last_activity_at: string | null }>(
      (activityRows as ActivityStatsRow[]).map((row) => [
        Number(row.user_id),
        {
          activities_count: Number(row.activities_count) || 0,
          last_activity_at: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
        },
      ])
    );

    // Add full avatar URL
    const usersWithAvatar = users.map((user) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      created_at: new Date(user.created_at).toISOString(),
      avatar_url: user.avatar_url ? process.env.BASE_URL + user.avatar_url : null,
      role: user.role || "student",
      name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email,
      level: {
        id: Number(user.level_id) || 1,
        title: user.level_title || `Level ${Number(user.level_id) || 1}`,
      },
      grade: {
        class_id: user.class_id ? Number(user.class_id) : null,
        class_name: user.class_name || null,
      },
      section: {
        section_id: user.section_id ? Number(user.section_id) : null,
        section_name: user.section_name || null,
      },
      level_id: Number(user.level_id) || 1,
      level_title: user.level_title || `Level ${Number(user.level_id) || 1}`,
      class_id: user.class_id ? Number(user.class_id) : null,
      class_name: user.class_name || null,
      section_id: user.section_id ? Number(user.section_id) : null,
      section_name: user.section_name || null,
      points: Number(user.total_points) || 0,
      total_points: Number(user.total_points) || 0,
      activities_count: activityStatsMap.get(Number(user.id))?.activities_count || 0,
      badges_count: badgeCountMap.get(Number(user.id)) || 0,
      streak_days: Number(user.streak_days) || 0,
      last_activity_at: activityStatsMap.get(Number(user.id))?.last_activity_at || null,
    }));

    const paginationResult = this.buildPaginationResponse(usersWithAvatar, totalCount, page, limit);

    return {
      ...paginationResult,
      stats: {
        total_students: Number(statsRow?.total_students) || 0,
        active_students: Number(statsRow?.active_students) || 0,
        inactive_students: Number(statsRow?.inactive_students) || 0,
        avg_points: Number(statsRow?.avg_points) || 0,
      },
    };
  }

  async getSchoolUserById(
    schoolId: number,
    userId: number
  ): Promise<SchoolUserDetailResponse> {
    const userIdNum = Number(userId);
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      throw new UserError("Invalid student id", 400);
    }

    const student = await this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CLASSES, `${TABLE.CLASSES}.id`, `${TABLE.STUDENTS}.class_id`)
      .leftJoin(TABLE.SECTIONS, `${TABLE.SECTIONS}.id`, `${TABLE.STUDENTS}.section_id`)
      .leftJoin(TABLE.LEVELS, `${TABLE.LEVELS}.id`, `${TABLE.STUDENTS}.level`)
      .where(`${TABLE.USERS}.id`, userIdNum)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
      .select(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.STUDENTS}.level as level_id`,
        `${TABLE.STUDENTS}.total_points`,
        `${TABLE.STUDENTS}.streak_days`,
        `${TABLE.STUDENTS}.class_id`,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.CLASSES}.name as class_name`,
        `${TABLE.SECTIONS}.name as section_name`,
        `${TABLE.LEVELS}.title as level_title`
      )
      .first();

    if (!student) {
      throw new UserError("Student not found", 404);
    }

    const [badgesRow, activitiesRow] = await Promise.all([
      this.db(TABLE.STUDENT_BADGES)
        .where("user_id", userIdNum)
        .count({ badges_count: "*" })
        .first(),
      this.db(TABLE.ACTIVITIES)
        .where("user_id", userIdNum)
        .count({ activities_count: "*" })
        .max({ last_activity_at: "created_at" })
        .first(),
    ]);

    const baseUrl = process.env.BASE_URL || "";
    const fullName = [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
    const joinedLabel = [student.class_name, student.section_name].filter(Boolean).join(" • ");

    return {
      id: Number(student.id),
      name: fullName || student.email,
      email: student.email,
      is_active: !!student.is_active,
      avatar_url: student.avatar_url ? `${baseUrl}${student.avatar_url}` : null,
      joined_at: student.created_at ? new Date(student.created_at).toISOString() : null,
      level: {
        id: Number(student.level_id) || 1,
        title: student.level_title || `Level ${Number(student.level_id) || 1}`,
      },
      grade: {
        class_id: student.class_id ? Number(student.class_id) : null,
        class_name: student.class_name || null,
      },
      section: {
        section_id: student.section_id ? Number(student.section_id) : null,
        section_name: student.section_name || null,
      },
      class_section_label: joinedLabel || null,
      stats: {
        total_points: Number(student.total_points) || 0,
        activities_count: Number(activitiesRow?.activities_count) || 0,
        badges_count: Number(badgesRow?.badges_count) || 0,
        current_streak_days: Number(student.streak_days) || 0,
        last_activity_at: activitiesRow?.last_activity_at
          ? new Date(String(activitiesRow.last_activity_at)).toISOString()
          : null,
      },
    };
  }

  async getSchoolUserStatsById(
    schoolId: number,
    userId: number
  ): Promise<SchoolUserStatsResponse> {
    const userIdNum = Number(userId);
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      throw new UserError("Invalid student id", 400);
    }

    const student = await this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CLASSES, `${TABLE.CLASSES}.id`, `${TABLE.STUDENTS}.class_id`)
      .leftJoin(TABLE.SECTIONS, `${TABLE.SECTIONS}.id`, `${TABLE.STUDENTS}.section_id`)
      .leftJoin(TABLE.LEVELS, `${TABLE.LEVELS}.id`, `${TABLE.STUDENTS}.level`)
      .where(`${TABLE.USERS}.id`, userIdNum)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
      .select(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.STUDENTS}.level as level_id`,
        `${TABLE.STUDENTS}.total_points`,
        `${TABLE.STUDENTS}.streak_days`,
        `${TABLE.STUDENTS}.class_id`,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.CLASSES}.name as class_name`,
        `${TABLE.SECTIONS}.name as section_name`,
        `${TABLE.LEVELS}.title as level_title`
      )
      .first();

    if (!student) {
      throw new UserError("Student not found", 404);
    }

    const now = new Date();
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const dayOfWeek = startOfTodayUtc.getUTCDay(); // 0=sun .. 6=sat
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const startOfWeekUtc = new Date(startOfTodayUtc);
    startOfWeekUtc.setUTCDate(startOfWeekUtc.getUTCDate() - daysSinceMonday);
    const endOfWeekUtc = new Date(startOfWeekUtc);
    endOfWeekUtc.setUTCDate(endOfWeekUtc.getUTCDate() + 7);

    const startOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    const endOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
    );

    const [
      badgesRow,
      activitiesRow,
      thisWeekActivitiesRow,
      thisMonthActivitiesRow,
      completedChallengesRow,
      articlesReadRow,
      schoolRankRow,
      weeklyPointsRows,
      activityBreakdownRows,
      recentBadgesRows,
      recentActivitiesRows,
    ] = await Promise.all([
      this.db(TABLE.STUDENT_BADGES)
        .where("user_id", userIdNum)
        .count({ badges_count: "*" })
        .first(),
      this.db(TABLE.ACTIVITIES)
        .where("user_id", userIdNum)
        .count({ activities_count: "*" })
        .max({ last_activity_at: "created_at" })
        .first(),
      this.db(TABLE.ACTIVITIES)
        .where("user_id", userIdNum)
        .where("created_at", ">=", startOfWeekUtc)
        .where("created_at", "<", endOfWeekUtc)
        .count({ count: "*" })
        .first(),
      this.db(TABLE.ACTIVITIES)
        .where("user_id", userIdNum)
        .where("created_at", ">=", startOfMonthUtc)
        .where("created_at", "<", endOfMonthUtc)
        .count({ count: "*" })
        .first(),
      this.db(TABLE.CHALLENGE_PROGRESS)
        .where("user_id", userIdNum)
        .where("status", "completed")
        .count({ count: "*" })
        .first(),
      this.db(TABLE.ARTICLE_READS)
        .where("user_id", userIdNum)
        .count({ count: "*" })
        .first(),
      this.db
        .from(
          this.db(TABLE.STUDENTS)
            .select(
              "user_id",
              this.db.raw(
                "RANK() OVER (ORDER BY COALESCE(total_points, 0) DESC, user_id ASC)::int AS position"
              ),
              this.db.raw("COUNT(*) OVER ()::int AS total_students")
            )
            .where("school_id", schoolId)
            .as("ranked_students")
        )
        .where("user_id", userIdNum)
        .first<SchoolRankRow>(),
      this.db(TABLE.ACTIVITIES)
        .where("user_id", userIdNum)
        .where("status", "approved")
        .where("points", ">", 0)
        .whereRaw("COALESCE(??, ??) >= ?", [
          `${TABLE.ACTIVITIES}.reviewed_at`,
          `${TABLE.ACTIVITIES}.created_at`,
          startOfWeekUtc,
        ])
        .whereRaw("COALESCE(??, ??) < ?", [
          `${TABLE.ACTIVITIES}.reviewed_at`,
          `${TABLE.ACTIVITIES}.created_at`,
          endOfWeekUtc,
        ])
        .select(
          this.db.raw(
            "DATE_TRUNC('day', COALESCE(??, ??))::date AS day",
            [`${TABLE.ACTIVITIES}.reviewed_at`, `${TABLE.ACTIVITIES}.created_at`]
          )
        )
        .sum({ points: `${TABLE.ACTIVITIES}.points` })
        .groupByRaw("DATE_TRUNC('day', COALESCE(??, ??))", [
          `${TABLE.ACTIVITIES}.reviewed_at`,
          `${TABLE.ACTIVITIES}.created_at`,
        ]),
      this.db(TABLE.ACTIVITIES)
        .join(
          TABLE.CATEGORIES,
          `${TABLE.CATEGORIES}.id`,
          `${TABLE.ACTIVITIES}.category_id`
        )
        .where(`${TABLE.ACTIVITIES}.user_id`, userIdNum)
        .where(`${TABLE.ACTIVITIES}.status`, "approved")
        .select(
          `${TABLE.CATEGORIES}.id as category_id`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .count<{ activities_count: string }[]>({
          activities_count: `${TABLE.ACTIVITIES}.id`,
        })
        .sum<{ points: string }[]>({
          points: `${TABLE.ACTIVITIES}.points`,
        })
        .groupBy(`${TABLE.CATEGORIES}.id`, `${TABLE.CATEGORIES}.name`)
        .orderBy("points", "desc")
        .orderBy("activities_count", "desc"),
      this.db(TABLE.STUDENT_BADGES)
        .join(TABLE.BADGES, `${TABLE.BADGES}.id`, `${TABLE.STUDENT_BADGES}.badge_id`)
        .where(`${TABLE.STUDENT_BADGES}.user_id`, userIdNum)
        .select(
          `${TABLE.BADGES}.id`,
          `${TABLE.BADGES}.name`,
          `${TABLE.BADGES}.icon_url`,
          `${TABLE.STUDENT_BADGES}.earned_at`
        )
        .orderBy(`${TABLE.STUDENT_BADGES}.earned_at`, "desc")
        .limit(5),
      this.db(TABLE.ACTIVITIES)
        .leftJoin(
          TABLE.CATEGORIES,
          `${TABLE.CATEGORIES}.id`,
          `${TABLE.ACTIVITIES}.category_id`
        )
        .where(`${TABLE.ACTIVITIES}.user_id`, userIdNum)
        .select(
          `${TABLE.ACTIVITIES}.id`,
          `${TABLE.ACTIVITIES}.title`,
          `${TABLE.ACTIVITIES}.status`,
          `${TABLE.ACTIVITIES}.points`,
          `${TABLE.ACTIVITIES}.created_at`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .orderBy(`${TABLE.ACTIVITIES}.created_at`, "desc")
        .limit(5),
    ]);

    const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekDates = weekdayLabels.map((_, idx) => {
      const d = new Date(startOfWeekUtc);
      d.setUTCDate(startOfWeekUtc.getUTCDate() + idx);
      return d.toISOString().slice(0, 10);
    });

    const pointsByDate = new Map<string, number>(
      (weeklyPointsRows as WeeklyPointsRow[]).map((row) => [
        row.day ? new Date(row.day).toISOString().slice(0, 10) : "",
        Number(row.points) || 0,
      ])
    );

    const weeklyActivity = weekDates.map((date, idx) => ({
      day: weekdayLabels[idx]!,
      date,
      points: pointsByDate.get(date) || 0,
    }));
    const weeklyTotalPoints = weeklyActivity.reduce(
      (sum, item) => sum + item.points,
      0
    );

    const baseUrl = process.env.BASE_URL || "";
    const fullName = [student.first_name, student.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const classSectionLabel = [student.class_name, student.section_name]
      .filter(Boolean)
      .join(" - ");

    return {
      id: Number(student.id),
      name: fullName || student.email,
      email: student.email,
      is_active: !!student.is_active,
      avatar_url: student.avatar_url ? `${baseUrl}${student.avatar_url}` : null,
      joined_at: student.created_at ? new Date(student.created_at).toISOString() : null,
      level: {
        id: Number(student.level_id) || 1,
        title: student.level_title || `Level ${Number(student.level_id) || 1}`,
      },
      grade: {
        class_id: student.class_id ? Number(student.class_id) : null,
        class_name: student.class_name || null,
      },
      section: {
        section_id: student.section_id ? Number(student.section_id) : null,
        section_name: student.section_name || null,
      },
      class_section_label: classSectionLabel || null,
      stats: {
        total_points: Number(student.total_points) || 0,
        activities_count: Number(activitiesRow?.activities_count) || 0,
        badges_count: Number(badgesRow?.badges_count) || 0,
        current_streak_days: Number(student.streak_days) || 0,
        last_activity_at: activitiesRow?.last_activity_at
          ? new Date(String(activitiesRow.last_activity_at)).toISOString()
          : null,
      },
      performance_overview: {
        this_week_activities: Number(thisWeekActivitiesRow?.count) || 0,
        this_month_activities: Number(thisMonthActivitiesRow?.count) || 0,
        completed_challenges: Number(completedChallengesRow?.count) || 0,
        articles_read: Number(articlesReadRow?.count) || 0,
        school_rank: schoolRankRow
          ? {
              position: Number(schoolRankRow.position) || 0,
              total_students: Number(schoolRankRow.total_students) || 0,
            }
          : null,
      },
      weekly_activity: {
        total_points: weeklyTotalPoints,
        points_by_day: weeklyActivity,
      },
      activity_breakdown: (activityBreakdownRows as ActivityBreakdownRow[]).map((row) => ({
        category_id: Number(row.category_id),
        category_name: row.category_name,
        activities_count: Number(row.activities_count) || 0,
        points: Number(row.points) || 0,
      })),
      recent_badges: (recentBadgesRows as RecentBadgeRow[]).map((row) => ({
        id: Number(row.id),
        name: row.name,
        icon_url: row.icon_url ? `${baseUrl}${row.icon_url}` : null,
        earned_at: row.earned_at ? new Date(row.earned_at).toISOString() : null,
      })),
      recent_activities: (recentActivitiesRows as RecentActivityRow[]).map((row) => ({
        id: Number(row.id),
        title: row.title,
        category_name: row.category_name || null,
        status: row.status,
        points: Number(row.points) || 0,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      })),
    };
  }

  async getSchoolUsersForExport(
    schoolId: number,
    filters: ExtendedUserFilters
  ): Promise<ExportUserRow[]> {
    const classId = Number(filters.class_id);
    const sectionId = Number(filters.section_id);
    const sortByRaw = String(filters.sort_by || "name").toLowerCase();
    const sortOrderRaw = String(filters.sort_order || "asc").toLowerCase();
    const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";

    let query = this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CLASSES, `${TABLE.CLASSES}.id`, `${TABLE.STUDENTS}.class_id`)
      .leftJoin(TABLE.SECTIONS, `${TABLE.SECTIONS}.id`, `${TABLE.STUDENTS}.section_id`)
      .leftJoin(TABLE.LEVELS, `${TABLE.LEVELS}.id`, `${TABLE.STUDENTS}.level`)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
      .select(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.STUDENTS}.level as level_id`,
        `${TABLE.STUDENTS}.total_points`,
        `${TABLE.STUDENTS}.streak_days`,
        `${TABLE.STUDENTS}.class_id`,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.CLASSES}.name as class_name`,
        `${TABLE.SECTIONS}.name as section_name`,
        `${TABLE.LEVELS}.title as level_title`
      );

    if (filters.search) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.USERS}.first_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.last_name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.USERS}.email`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.CLASSES}.name`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.SECTIONS}.name`, "ilike", `%${filters.search}%`);
      });
    }

    if (filters.is_active !== undefined) {
      query = query.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    if (Number.isFinite(classId) && classId > 0) {
      query = query.where(`${TABLE.STUDENTS}.class_id`, classId);
    }

    if (Number.isFinite(sectionId) && sectionId > 0) {
      query = query.where(`${TABLE.STUDENTS}.section_id`, sectionId);
    }

    if (sortByRaw === "name") {
      query = query
        .orderBy(`${TABLE.USERS}.first_name`, sortOrder)
        .orderBy(`${TABLE.USERS}.last_name`, sortOrder)
        .orderBy(`${TABLE.USERS}.id`, "desc");
    } else if (sortByRaw === "points") {
      query = query
        .orderBy(`${TABLE.STUDENTS}.total_points`, sortOrder)
        .orderBy(`${TABLE.USERS}.id`, "desc");
    } else if (sortByRaw === "level") {
      query = query
        .orderBy(`${TABLE.STUDENTS}.level`, sortOrder)
        .orderBy(`${TABLE.USERS}.id`, "desc");
    } else if (sortByRaw === "recent") {
      query = query.orderBy(`${TABLE.USERS}.created_at`, "desc");
    } else {
      query = query.orderBy(`${TABLE.USERS}.id`, "desc");
    }


    const users = await query;
    const userIds = users.map((u: UserQueryRow) => Number(u.id)).filter(Number.isFinite);

    const [badgeRows, activityRows] = await Promise.all([
      userIds.length > 0
        ? this.db(TABLE.STUDENT_BADGES)
            .select("user_id")
            .count({ badges_count: "*" })
            .whereIn("user_id", userIds)
            .groupBy("user_id")
        : Promise.resolve<BadgeCountRow[]>([]),
      userIds.length > 0
        ? this.db(TABLE.ACTIVITIES)
            .select("user_id")
            .count({ activities_count: "*" })
            .max({ last_activity_at: "created_at" })
            .whereIn("user_id", userIds)
            .groupBy("user_id")
        : Promise.resolve<ActivityStatsRow[]>([]),
    ]);

    const badgeCountMap = new Map<number, number>(
      (badgeRows as BadgeCountRow[]).map((row) => [Number(row.user_id), Number(row.badges_count) || 0])
    );
    const activityStatsMap = new Map<number, { activities_count: number; last_activity_at: string | null }>(
      (activityRows as ActivityStatsRow[]).map((row) => [
        Number(row.user_id),
        {
          activities_count: Number(row.activities_count) || 0,
          last_activity_at: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
        },
      ])
    );

    return (users as UserQueryRow[]).map((user): ExportUserRow => ({
      id: Number(user.id),
      name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email,
      email: user.email,
      is_active: !!user.is_active,
      level_id: Number(user.level_id) || 1,
      level_title: user.level_title || `Level ${Number(user.level_id) || 1}`,
      class_id: user.class_id ? Number(user.class_id) : null,
      class_name: user.class_name || null,
      section_id: user.section_id ? Number(user.section_id) : null,
      section_name: user.section_name || null,
      total_points: Number(user.total_points) || 0,
      activities_count: activityStatsMap.get(Number(user.id))?.activities_count || 0,
      badges_count: badgeCountMap.get(Number(user.id)) || 0,
      streak_days: Number(user.streak_days) || 0,
      last_activity_at: activityStatsMap.get(Number(user.id))?.last_activity_at || null,
      joined_at: user.created_at ? new Date(user.created_at).toISOString() : null,
    }));
  }

  async flagSchoolUserByTeacher(params: {
    schoolId: number;
    teacherUserId: number;
    studentUserId: number;
    reason: "Suspicious activity" | "Inappropriate content" | "Gaming the system";
    note?: string;
  }): Promise<{
    id: number;
    student_user_id: number;
    teacher_user_id: number;
    school_id: number;
    reason: string;
    note: string | null;
    created_at: string | null;
    updated_at: string | null;
    is_new: boolean;
  }> {
    const { schoolId, teacherUserId, studentUserId, reason, note } = params;

    const teacher = await this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.USERS}.id`, teacherUserId)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
      .select(`${TABLE.USERS}.id`)
      .first();

    if (!teacher) {
      throw new UserError("Teacher not found in this school", 404);
    }

    const student = await this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.USERS}.id`, studentUserId)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
      .select(`${TABLE.USERS}.id`)
      .first();

    if (!student) {
      throw new UserError("Student not found", 404);
    }

    if (teacherUserId === studentUserId) {
      throw new UserError("You cannot flag yourself", 400);
    }

    const existing = await this.db(TABLE.USER_FLAGS)
      .where("student_user_id", studentUserId)
      .where("teacher_user_id", teacherUserId)
      .first();

    if (existing) {
      const [updated] = await this.db(TABLE.USER_FLAGS)
        .where("id", existing.id)
        .update({
          reason: reason.trim(),
          note: note?.trim() || null,
          updated_at: new Date(),
        })
        .returning("*");

      return {
        id: Number(updated.id),
        student_user_id: Number(updated.student_user_id),
        teacher_user_id: Number(updated.teacher_user_id),
        school_id: Number(updated.school_id),
        reason: String(updated.reason),
        note: updated.note || null,
        created_at: updated.created_at
          ? new Date(updated.created_at).toISOString()
          : null,
        updated_at: updated.updated_at
          ? new Date(updated.updated_at).toISOString()
          : null,
        is_new: false,
      };
    }

    const [created] = await this.db(TABLE.USER_FLAGS)
      .insert({
        student_user_id: studentUserId,
        teacher_user_id: teacherUserId,
        school_id: schoolId,
        reason: reason.trim(),
        note: note?.trim() || null,
      })
      .returning("*");

    return {
      id: Number(created.id),
      student_user_id: Number(created.student_user_id),
      teacher_user_id: Number(created.teacher_user_id),
      school_id: Number(created.school_id),
      reason: String(created.reason),
      note: created.note || null,
      created_at: created.created_at ? new Date(created.created_at).toISOString() : null,
      updated_at: created.updated_at ? new Date(created.updated_at).toISOString() : null,
      is_new: true,
    };
  }

  async exportSchoolUsersCsv(
    schoolId: number,
    params: {
      mode?: string;
      search?: string;
      is_active?: string;
      class_id?: string;
      section_id?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<{ fileName: string; csv: string }> {
    const exportMode = String(params.mode || "full_csv").toLowerCase();
    if (!["individual", "class_summary", "full_csv"].includes(exportMode)) {
      throw new UserError(
        "Invalid mode. Use 'individual', 'class_summary', or 'full_csv'",
        400
      );
    }

    const rows = await this.getSchoolUsersForExport(schoolId, {
      search: params.search,
      role: "student",
      is_active:
        params.is_active === "true"
          ? true
          : params.is_active === "false"
          ? false
          : undefined,
      ...(params.class_id ? { class_id: Number(params.class_id) } : {}),
      ...(params.section_id ? { section_id: Number(params.section_id) } : {}),
      ...(params.sort_by ? { sort_by: String(params.sort_by) } : {}),
      ...(params.sort_order ? { sort_order: String(params.sort_order) } : {}),
    } as ExtendedUserFilters);

    let csvRows: Record<string, unknown>[] = [];
    let fileSuffix = "full_data";

    if (exportMode === "individual") {
      fileSuffix = "individual_reports";
      csvRows = rows.map((item) => ({
        student_id: item.id,
        name: item.name,
        email: item.email,
        status: item.is_active ? "active" : "inactive",
        level: item.level_title,
        grade: item.class_name || "",
        section: item.section_name || "",
        total_points: item.total_points,
        activities_count: item.activities_count,
        badges_count: item.badges_count,
        streak_days: item.streak_days,
        last_activity_at: item.last_activity_at || "",
      }));
    } else if (exportMode === "class_summary") {
      fileSuffix = "class_summary";
      const grouped = new Map<
        string,
        {
          class_name: string;
          students_count: number;
          active_students: number;
          inactive_students: number;
          total_points: number;
          total_activities: number;
          total_badges: number;
        }
      >();

      for (const item of rows) {
        const className = item.class_name || "Unassigned";
        const current = grouped.get(className) || {
          class_name: className,
          students_count: 0,
          active_students: 0,
          inactive_students: 0,
          total_points: 0,
          total_activities: 0,
          total_badges: 0,
        };

        current.students_count += 1;
        current.active_students += item.is_active ? 1 : 0;
        current.inactive_students += item.is_active ? 0 : 1;
        current.total_points += Number(item.total_points) || 0;
        current.total_activities += Number(item.activities_count) || 0;
        current.total_badges += Number(item.badges_count) || 0;
        grouped.set(className, current);
      }

      csvRows = Array.from(grouped.values())
        .sort((a, b) => a.class_name.localeCompare(b.class_name))
        .map((item) => ({
          class_name: item.class_name,
          students_count: item.students_count,
          active_students: item.active_students,
          inactive_students: item.inactive_students,
          avg_points:
            item.students_count > 0 ? Math.round(item.total_points / item.students_count) : 0,
          avg_activities:
            item.students_count > 0
              ? Math.round(item.total_activities / item.students_count)
              : 0,
          avg_badges:
            item.students_count > 0 ? Math.round(item.total_badges / item.students_count) : 0,
        }));
    } else {
      csvRows = rows.map((item) => ({
        student_id: item.id,
        name: item.name,
        email: item.email,
        status: item.is_active ? "active" : "inactive",
        level_id: item.level_id,
        level_title: item.level_title,
        class_id: item.class_id || "",
        class_name: item.class_name || "",
        section_id: item.section_id || "",
        section_name: item.section_name || "",
        total_points: item.total_points,
        activities_count: item.activities_count,
        badges_count: item.badges_count,
        streak_days: item.streak_days,
        last_activity_at: item.last_activity_at || "",
        joined_at: item.joined_at || "",
      }));
    }

    const csv = this.toCsv(csvRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `students_${fileSuffix}_${timestamp}.csv`;

    return { fileName, csv };
  }

  async exportSchoolUserByIdCsv(
    schoolId: number,
    userId: number
  ): Promise<{ fileName: string; csv: string }> {
    const userIdNum = Number(userId);
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      throw new UserError("Invalid student id", 400);
    }

    const student = await this.db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CLASSES, `${TABLE.CLASSES}.id`, `${TABLE.STUDENTS}.class_id`)
      .leftJoin(TABLE.SECTIONS, `${TABLE.SECTIONS}.id`, `${TABLE.STUDENTS}.section_id`)
      .leftJoin(TABLE.LEVELS, `${TABLE.LEVELS}.id`, `${TABLE.STUDENTS}.level`)
      .where(`${TABLE.USERS}.id`, userIdNum)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
      .select(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.STUDENTS}.level as level_id`,
        `${TABLE.STUDENTS}.total_points`,
        `${TABLE.STUDENTS}.streak_days`,
        `${TABLE.STUDENTS}.class_id`,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.CLASSES}.name as class_name`,
        `${TABLE.SECTIONS}.name as section_name`,
        `${TABLE.LEVELS}.title as level_title`
      )
      .first();

    if (!student) {
      throw new UserError("Student not found", 404);
    }

    const [badgesRow, activitiesRow] = await Promise.all([
      this.db(TABLE.STUDENT_BADGES)
        .where("user_id", userIdNum)
        .count({ badges_count: "*" })
        .first(),
      this.db(TABLE.ACTIVITIES)
        .where("user_id", userIdNum)
        .count({ activities_count: "*" })
        .max({ last_activity_at: "created_at" })
        .first(),
    ]);

    const csvRows: Record<string, unknown>[] = [
      {
        student_id: Number(student.id),
        name:
          [student.first_name, student.last_name].filter(Boolean).join(" ").trim() ||
          student.email,
        email: student.email,
        status: student.is_active ? "active" : "inactive",
        level_id: Number(student.level_id) || 1,
        level_title: student.level_title || `Level ${Number(student.level_id) || 1}`,
        class_id: student.class_id ? Number(student.class_id) : "",
        class_name: student.class_name || "",
        section_id: student.section_id ? Number(student.section_id) : "",
        section_name: student.section_name || "",
        total_points: Number(student.total_points) || 0,
        activities_count: Number(activitiesRow?.activities_count) || 0,
        badges_count: Number(badgesRow?.badges_count) || 0,
        streak_days: Number(student.streak_days) || 0,
        last_activity_at: activitiesRow?.last_activity_at
          ? new Date(String(activitiesRow.last_activity_at)).toISOString()
          : "",
        joined_at: student.created_at ? new Date(student.created_at).toISOString() : "",
      },
    ];

    const csv = this.toCsv(csvRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `student_${userIdNum}_report_${timestamp}.csv`;

    return { fileName, csv };
  }

  private csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  }

  private toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]!);
    const lines = [headers.map((h) => this.csvEscape(h)).join(",")];
    for (const row of rows) {
      lines.push(headers.map((key) => this.csvEscape(row[key])).join(","));
    }
    return lines.join("\n");
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<UserResponse> {
    const user = await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .select(
        `${TABLE.USERS}.id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.is_active`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.USERS}.created_at`,
        `${TABLE.ROLES}.name as role`
      )
      .where(`${TABLE.USERS}.id`, id)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .first();

    if (!user) {
      throw new UserError("User not found", 404);
    }

    return {
      ...user,
      avatar_url: user.avatar_url ? process.env.BASE_URL + user.avatar_url : null,
    };
  }

  /**
   * Delete user by ID (soft delete)
   */
  async deleteUser(id: number): Promise<UserResponse> {
    const user = await db(TABLE.USERS)
      .where("id", id)
      .where("is_deleted", false)
      .first();

    if (!user) {
      throw new UserError("User not found", 404);
    }

    // Soft delete: set is_deleted = true and deleted_at timestamp
    await db(TABLE.USERS)
      .where("id", id)
      .update({
        is_deleted: true,
        deleted_at: db.fn.now(),
      });

    await invalidateUserComplete(id);

    return user;
  }

 
  async toggleUserStatus(id: number): Promise<UserResponse> {
    const user = await db(TABLE.USERS).where("id", id).first();

    if (!user) {
      throw new UserError("User not found", 404);
    }

    const [updatedUser] = await db(TABLE.USERS)
      .where("id", id)
      .update({ is_active: !user.is_active })
      .returning("*");

    await invalidateUser(id);
    return this.getUserById(updatedUser.id);
  }


  async softDeleteAccount(
    userId: number,
    password: string,
    userRole: string
  ): Promise<void> {
    const user = await db(TABLE.USERS)
      .select("*")
      .where("id", userId)
      .first();

    if (!user) {
      throw new UserError("User not found", 404);
    }


    if (user.is_deleted) {
      throw new UserError("Account is already deleted", 400);
    }

    if (userRole === UserRole.SUPER_ADMIN) {
      throw new UserError(
        "Super admin cannot delete their own account",
        403
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UserError("Invalid password", 400);
    }

    await db(TABLE.USERS)
      .where("id", userId)
      .update({
        is_deleted: true,
        deleted_at: db.fn.now(),
      });

    await invalidateUserComplete(userId);
  }

  // ============ PRIVATE HELPER METHODS ============

  protected async withTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    return await db.transaction(async (trx) => {
      return await callback(trx);
    });
  }

  protected async ensureEmailNotExists(email: string): Promise<void> {
    const existingUser = await db(TABLE.USERS)
      .where({ email })
      .where("is_deleted", false)
      .first();
    if (existingUser) {
      throw new UserError("Email already exists", 400);
    }
  }

  protected async getRoleByName(roleName: string) {
    return await db(TABLE.ROLES).where({ name: roleName }).first();
  }

  protected async createUserProfile(
    trx: Knex.Transaction,
    userId: number,
    roleName: string,
    schoolId?: number,
    sectionId?: number
  ): Promise<void> {
    // Get default school/section if not provided
    const school = schoolId
      ? { id: schoolId }
      : await trx(TABLE.SCHOOLS).first();
    const section = sectionId
      ? { id: sectionId }
      : await trx(TABLE.SECTIONS).first();

    if (roleName === UserRole.STUDENT) {
      await trx(TABLE.STUDENTS).insert({
        user_id: userId,
        school_id: school?.id || 1,
        section_id: section?.id || 1,
      });
    } else if (roleName === UserRole.TEACHER) {
      await trx(TABLE.STAFF).insert({
        user_id: userId,
        school_id: school?.id || 1,
      });
    }
  }

  protected async sendWelcomeEmailSafe(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string
  ): Promise<void> {
    try {
      await sendWelcomeEmail({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role,
      });
    } catch (emailError: unknown) {
      logger.error("Failed to send welcome email:", emailError);
      throw new UserError(
        `Failed to send welcome email: ${getErrorMessage(emailError)}`,
        500
      );
    }
  }
}

// Re-export UserError from centralized errors for backward compatibility
export { UserError } from "../utils/errors";

// Export singleton instance
export const userService = new UserService();

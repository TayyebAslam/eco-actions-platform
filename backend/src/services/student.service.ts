import bcrypt from "bcryptjs";
import { generatePassword } from "../utils/helperFunctions/passwordHelper";
import { Knex } from "knex";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { hasColumn } from "./base/BaseService";
import { UserRole } from "../utils/enums/users.enum";
import { StudentError } from "../utils/errors";
import { EmailService } from "../utils/services/emailService";
import { buildSearchTerm } from "../utils/helperFunctions/searchHelper";
import {
  CreateStudentDTO,
  UpdateStudentDTO,
  StudentFilters,
  StudentResponse,
  StudentWithBadgesResponse,
  BadgeResponse,
  GetStudentLeaderboardParams,
  StudentLeaderboardResponse,
  GetSchoolsLeaderboardParams,
  SchoolsLeaderboardResponse,
  LeaderboardPeriod,
  StudentDashboardResponse,
} from "../dto/student.dto";
import { PaginationDTO, PaginatedResponse } from "../dto/user.dto";
import { getErrorMessage } from "../utils/helperFunctions/errorHelper";

/** Raw row shape from student leaderboard query */
interface StudentLeaderboardRow {
  user_id: number;
  name: string | null;
  email: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  total_points: number;
  period_points: number;
  [key: string]: unknown;
}

/** Raw row shape from school leaderboard query */
interface SchoolLeaderboardRow {
  school_id: number;
  school_name: string;
  logo_url: string | null;
  level: number;
  members_count: number;
  period_points: number;
  [key: string]: unknown;
}

export class StudentService {
  private readonly SALT_ROUNDS = 10;

  async getStudentLeaderboard(
    params: GetStudentLeaderboardParams
  ): Promise<StudentLeaderboardResponse> {
    const {
      schoolId,
      userId,
      page = 1,
      limit = 10,
      period = "semester",
      categoryId,
    } = params;
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;
    const offset = (safePage - 1) * safeLimit;

    const hasStudentName = await hasColumn(TABLE.STUDENTS, "name");
    const hasUserFirstName = await hasColumn(TABLE.USERS, "first_name");
    const hasUserLastName = await hasColumn(TABLE.USERS, "last_name");

    const nameSelect = this.buildLeaderboardNameSelect({
      hasStudentName,
      hasUserFirstName,
      hasUserLastName,
    });

    const periodRange = this.getDateRangeForPeriod(period, new Date());

    const activityPointsSubquery = db(TABLE.ACTIVITIES)
      .select(`${TABLE.ACTIVITIES}.user_id`)
      .sum({ points_earned: `${TABLE.ACTIVITIES}.points` })
      .where(`${TABLE.ACTIVITIES}.status`, "approved")
      .where(`${TABLE.ACTIVITIES}.points`, ">", 0)
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .groupBy(`${TABLE.ACTIVITIES}.user_id`);

    if (periodRange) {
      activityPointsSubquery.whereRaw("COALESCE(??, ??) BETWEEN ? AND ?", [
        `${TABLE.ACTIVITIES}.reviewed_at`,
        `${TABLE.ACTIVITIES}.created_at`,
        periodRange.start,
        periodRange.end,
      ]);
    }

    if (categoryId) {
      activityPointsSubquery.where(`${TABLE.ACTIVITIES}.category_id`, categoryId);
    }

    const articlePointsSubquery = db(TABLE.ARTICLE_READS)
      .select(`${TABLE.ARTICLE_READS}.user_id`)
      .sum({ points_earned: db.raw("COALESCE(??, 0)", [`${TABLE.ARTICLES}.points`]) })
      .join(TABLE.ARTICLES, `${TABLE.ARTICLE_READS}.article_id`, `${TABLE.ARTICLES}.id`)
      .whereRaw("COALESCE(??, 0) > 0", [`${TABLE.ARTICLES}.points`])
      .groupBy(`${TABLE.ARTICLE_READS}.user_id`);

    if (periodRange) {
      articlePointsSubquery.whereBetween(`${TABLE.ARTICLE_READS}.read_at`, [
        periodRange.start,
        periodRange.end,
      ]);
    }

    if (categoryId) {
      articlePointsSubquery.where(`${TABLE.ARTICLES}.category_id`, categoryId);
    }

    const challengePointsSubquery = db(TABLE.CHALLENGE_PROGRESS)
      .select(`${TABLE.CHALLENGE_PROGRESS}.user_id`)
      .sum({
        points_earned: db.raw("COALESCE(??, 0)", [`${TABLE.CHALLENGE_VARIANTS}.points`]),
      })
      .join(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .join(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.id`
      )
      .where(`${TABLE.CHALLENGE_PROGRESS}.status`, "completed")
      .whereNotNull(`${TABLE.CHALLENGE_PROGRESS}.completed_at`)
      .whereRaw("COALESCE(??, 0) > 0", [`${TABLE.CHALLENGE_VARIANTS}.points`])
      .groupBy(`${TABLE.CHALLENGE_PROGRESS}.user_id`);

    if (periodRange) {
      challengePointsSubquery.whereBetween(`${TABLE.CHALLENGE_PROGRESS}.completed_at`, [
        periodRange.start,
        periodRange.end,
      ]);
    }

    if (categoryId) {
      challengePointsSubquery.where(`${TABLE.CHALLENGES}.category_id`, categoryId);
    }

    let query = db(TABLE.STUDENTS)
      .select(
        `${TABLE.STUDENTS}.user_id`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.STUDENTS}.level`,
        `${TABLE.STUDENTS}.xp`,
        `${TABLE.STUDENTS}.total_points`,
        nameSelect,
        db.raw(
          "COALESCE(??, 0) + COALESCE(??, 0) + COALESCE(??, 0) as period_points",
          [
            "activity_points.points_earned",
            "article_points.points_earned",
            "challenge_points.points_earned",
          ]
        )
      )
      .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(activityPointsSubquery.as("activity_points"), "activity_points.user_id", `${TABLE.STUDENTS}.user_id`)
      .leftJoin(articlePointsSubquery.as("article_points"), "article_points.user_id", `${TABLE.STUDENTS}.user_id`)
      .leftJoin(challengePointsSubquery.as("challenge_points"), "challenge_points.user_id", `${TABLE.STUDENTS}.user_id`)
      .where(`${TABLE.STUDENTS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .orderBy("period_points", "desc")
      .orderBy(`${TABLE.STUDENTS}.total_points`, "desc")
      .orderBy(`${TABLE.STUDENTS}.xp`, "desc")
      .orderBy(`${TABLE.STUDENTS}.user_id`, "asc");

    const rows = await query;
    const baseUrl = process.env.BASE_URL || "";

    const ranked = rows.map((row: StudentLeaderboardRow, index: number) => ({
      user_id: row.user_id,
      name: row.name || row.email,
      avatar_url: row.avatar_url ? `${baseUrl}${row.avatar_url}` : null,
      level: Number(row.level) || 1,
      xp: Number(row.xp) || 0,
      total_points: Number(row.total_points) || 0,
      period_points: Number(row.period_points) || 0,
      position: index + 1,
    }));

    const topThree = ranked.slice(0, 3);
    const othersAll = ranked.slice(3);
    const others = othersAll.slice(offset, offset + safeLimit);
    const me = ranked.find((entry) => entry.user_id === userId) || null;

    return {
      period,
      period_range: periodRange
        ? {
            start: periodRange.start.toISOString(),
            end: periodRange.end.toISOString(),
          }
        : null,
      category_id: categoryId || null,
      top_three: topThree,
      others,
      me,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalCount: othersAll.length,
        totalPages: Math.ceil(othersAll.length / safeLimit) || 1,
        hasNextPage: safePage * safeLimit < othersAll.length,
        hasPrevPage: safePage > 1,
      },
    };
  }

  async getSchoolsLeaderboard(
    params: GetSchoolsLeaderboardParams
  ): Promise<SchoolsLeaderboardResponse> {
    const {
      userSchoolId,
      page = 1,
      limit = 10,
      period = "semester",
      categoryId,
    } = params;

    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;
    const offset = (safePage - 1) * safeLimit;
    const periodRange = this.getDateRangeForPeriod(period, new Date());
    const hasSchoolIsActive = await hasColumn(TABLE.SCHOOLS, "is_active");
    const baseUrl = process.env.BASE_URL || "";

    const studentsStatsSubquery = db(TABLE.STUDENTS)
      .select(`${TABLE.STUDENTS}.school_id`)
      .count<{ members_count: string }[]>({ members_count: "*" })
      .avg<{ avg_level: string }[]>(`${TABLE.STUDENTS}.level as avg_level`)
      .groupBy(`${TABLE.STUDENTS}.school_id`);

    const activityPointsSubquery = db(TABLE.ACTIVITIES)
      .select(`${TABLE.ACTIVITIES}.school_id`)
      .sum({ points_earned: `${TABLE.ACTIVITIES}.points` })
      .where(`${TABLE.ACTIVITIES}.status`, "approved")
      .where(`${TABLE.ACTIVITIES}.points`, ">", 0)
      .groupBy(`${TABLE.ACTIVITIES}.school_id`);

    if (periodRange) {
      activityPointsSubquery.whereRaw("COALESCE(??, ??) BETWEEN ? AND ?", [
        `${TABLE.ACTIVITIES}.reviewed_at`,
        `${TABLE.ACTIVITIES}.created_at`,
        periodRange.start,
        periodRange.end,
      ]);
    }

    if (categoryId) {
      activityPointsSubquery.where(`${TABLE.ACTIVITIES}.category_id`, categoryId);
    }

    const articlePointsSubquery = db(TABLE.ARTICLE_READS)
      .join(TABLE.ARTICLES, `${TABLE.ARTICLE_READS}.article_id`, `${TABLE.ARTICLES}.id`)
      .join(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.ARTICLE_READS}.user_id`)
      .select(`${TABLE.STUDENTS}.school_id`)
      .sum({ points_earned: db.raw("COALESCE(??, 0)", [`${TABLE.ARTICLES}.points`]) })
      .whereRaw("COALESCE(??, 0) > 0", [`${TABLE.ARTICLES}.points`])
      .groupBy(`${TABLE.STUDENTS}.school_id`);

    if (periodRange) {
      articlePointsSubquery.whereBetween(`${TABLE.ARTICLE_READS}.read_at`, [
        periodRange.start,
        periodRange.end,
      ]);
    }

    if (categoryId) {
      articlePointsSubquery.where(`${TABLE.ARTICLES}.category_id`, categoryId);
    }

    const challengePointsSubquery = db(TABLE.CHALLENGE_PROGRESS)
      .join(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .join(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.id`
      )
      .join(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.CHALLENGE_PROGRESS}.user_id`)
      .select(`${TABLE.STUDENTS}.school_id`)
      .sum({
        points_earned: db.raw("COALESCE(??, 0)", [`${TABLE.CHALLENGE_VARIANTS}.points`]),
      })
      .where(`${TABLE.CHALLENGE_PROGRESS}.status`, "completed")
      .whereNotNull(`${TABLE.CHALLENGE_PROGRESS}.completed_at`)
      .whereRaw("COALESCE(??, 0) > 0", [`${TABLE.CHALLENGE_VARIANTS}.points`])
      .groupBy(`${TABLE.STUDENTS}.school_id`);

    if (periodRange) {
      challengePointsSubquery.whereBetween(`${TABLE.CHALLENGE_PROGRESS}.completed_at`, [
        periodRange.start,
        periodRange.end,
      ]);
    }

    if (categoryId) {
      challengePointsSubquery.where(`${TABLE.CHALLENGES}.category_id`, categoryId);
    }

    let query = db(TABLE.SCHOOLS)
      .select(
        `${TABLE.SCHOOLS}.id as school_id`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.SCHOOLS}.logo_url`,
        db.raw("COALESCE(??, 0)::int as members_count", ["school_stats.members_count"]),
        db.raw("COALESCE(ROUND(COALESCE(??, 1)), 1)::int as level", ["school_stats.avg_level"]),
        db.raw(
          "(COALESCE(??, 0) + COALESCE(??, 0) + COALESCE(??, 0))::int as period_points",
          [
            "activity_points.points_earned",
            "article_points.points_earned",
            "challenge_points.points_earned",
          ]
        )
      )
      .leftJoin(studentsStatsSubquery.as("school_stats"), "school_stats.school_id", `${TABLE.SCHOOLS}.id`)
      .leftJoin(activityPointsSubquery.as("activity_points"), "activity_points.school_id", `${TABLE.SCHOOLS}.id`)
      .leftJoin(articlePointsSubquery.as("article_points"), "article_points.school_id", `${TABLE.SCHOOLS}.id`)
      .leftJoin(challengePointsSubquery.as("challenge_points"), "challenge_points.school_id", `${TABLE.SCHOOLS}.id`)
      .where(`${TABLE.SCHOOLS}.subscription_status`, "active")
      .whereRaw("COALESCE(??, 0) > 0", ["school_stats.members_count"])
      .orderBy("period_points", "desc")
      .orderBy("members_count", "desc")
      .orderBy(`${TABLE.SCHOOLS}.id`, "asc");

    if (hasSchoolIsActive) {
      query = query.where(`${TABLE.SCHOOLS}.is_active`, true);
    }

    const rows = await query;
    const ranked = rows.map((row: SchoolLeaderboardRow, index: number) => ({
      school_id: Number(row.school_id),
      school_name: row.school_name,
      logo_url: row.logo_url ? `${baseUrl}${row.logo_url}` : null,
      level: Number(row.level) || 1,
      members_count: Number(row.members_count) || 0,
      period_points: Number(row.period_points) || 0,
      position: index + 1,
      is_my_school: Number(row.school_id) === userSchoolId,
    }));

    const topThree = ranked.slice(0, 3);
    const othersAll = ranked.slice(3);
    const others = othersAll.slice(offset, offset + safeLimit);
    const mySchool = ranked.find((entry) => entry.school_id === userSchoolId) || null;

    return {
      period,
      period_range: periodRange
        ? {
            start: periodRange.start.toISOString(),
            end: periodRange.end.toISOString(),
          }
        : null,
      category_id: categoryId || null,
      top_three: topThree,
      others,
      my_school: mySchool,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalCount: othersAll.length,
        totalPages: Math.ceil(othersAll.length / safeLimit) || 1,
        hasNextPage: safePage * safeLimit < othersAll.length,
        hasPrevPage: safePage > 1,
      },
    };
  }

  async getStudentDashboard(
    userId: number,
    schoolId: number
  ): Promise<StudentDashboardResponse> {
    const semesterRange = this.getCurrentSemesterRange(new Date());

    const student = await db(TABLE.STUDENTS)
      .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.LEVELS, `${TABLE.STUDENTS}.level`, `${TABLE.LEVELS}.id`)
      .where(`${TABLE.STUDENTS}.user_id`, userId)
      .where(`${TABLE.STUDENTS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .select(
        `${TABLE.STUDENTS}.user_id`,
        `${TABLE.STUDENTS}.level`,
        `${TABLE.STUDENTS}.xp`,
        `${TABLE.STUDENTS}.total_points`,
        `${TABLE.STUDENTS}.streak_days`,
        `${TABLE.STUDENTS}.name as student_name`,
        `${TABLE.USERS}.email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.avatar_url`,
        `${TABLE.LEVELS}.title as level_title`,
        `${TABLE.LEVELS}.min_xp as level_min_xp`
      )
      .first();

    if (!student) {
      throw new StudentError("Student not found", 404);
    }

    const [nextLevel, semesterPointsRow, badgesRow, challengeStats] = await Promise.all([
      db(TABLE.LEVELS)
        .where("min_xp", ">", Number(student.xp) || 0)
        .orderBy("min_xp", "asc")
        .first(),
      db(TABLE.POINTS_LOG)
        .where("user_id", userId)
        .whereBetween("created_at", [semesterRange.start, semesterRange.end])
        .sum({ total: "amount" })
        .first(),
      db(TABLE.STUDENT_BADGES)
        .where("user_id", userId)
        .count({ count: "*" })
        .first(),
      db(TABLE.CHALLENGE_PROGRESS)
        .where("user_id", userId)
        .select(
          db.raw(
            "SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END)::int as in_progress"
          ),
          db.raw(
            "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed"
          )
        )
        .first(),
    ]);

    const pointsByCategoryResult = await db.raw(
      `
        SELECT
          c.id AS category_id,
          c.name AS category_name,
          c.icon_url AS category_icon,
          COALESCE(SUM(src.points), 0)::int AS points
        FROM ${TABLE.CATEGORIES} c
        JOIN (
          SELECT
            a.category_id,
            a.points::int AS points
          FROM ${TABLE.ACTIVITIES} a
          WHERE a.user_id = ?
            AND a.status = 'approved'
            AND a.points > 0
            AND COALESCE(a.reviewed_at, a.created_at) BETWEEN ? AND ?

          UNION ALL

          SELECT
            ar.category_id,
            COALESCE(ar.points, 0)::int AS points
          FROM ${TABLE.ARTICLE_READS} r
          JOIN ${TABLE.ARTICLES} ar ON ar.id = r.article_id
          WHERE r.user_id = ?
            AND COALESCE(ar.points, 0) > 0
            AND r.read_at BETWEEN ? AND ?

          UNION ALL

          SELECT
            ch.category_id,
            COALESCE(cv.points, 0)::int AS points
          FROM ${TABLE.CHALLENGE_PROGRESS} cp
          JOIN ${TABLE.CHALLENGE_VARIANTS} cv ON cv.id = cp.challenge_variant_id
          JOIN ${TABLE.CHALLENGES} ch ON ch.id = cv.challenge_id
          WHERE cp.user_id = ?
            AND cp.status = 'completed'
            AND cp.completed_at IS NOT NULL
            AND COALESCE(cv.points, 0) > 0
            AND cp.completed_at BETWEEN ? AND ?
        ) src ON src.category_id = c.id
        GROUP BY c.id, c.name, c.icon_url
        ORDER BY points DESC, c.name ASC
      `,
      [
        userId,
        semesterRange.start,
        semesterRange.end,
        userId,
        semesterRange.start,
        semesterRange.end,
        userId,
        semesterRange.start,
        semesterRange.end,
      ]
    );

    const currentXp = Number(student.xp) || 0;
    const currentLevelMinXp = Number(student.level_min_xp) || 0;
    const nextLevelMinXp = nextLevel ? Number(nextLevel.min_xp) || 0 : null;
    const xpNeededForNextLevel =
      nextLevelMinXp === null ? 0 : Math.max(nextLevelMinXp - currentXp, 0);

    const progressPercent =
      nextLevelMinXp && nextLevelMinXp > currentLevelMinXp
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(((currentXp - currentLevelMinXp) / (nextLevelMinXp - currentLevelMinXp)) * 100)
            )
          )
        : 100;

    const baseUrl = process.env.BASE_URL || "";
    const pointsByCategoryRows: any[] = pointsByCategoryResult?.rows || [];
    const pointsByCategory = pointsByCategoryRows.map((row: any) => ({
      category_id: Number(row.category_id),
      category_name: row.category_name,
      category_icon: row.category_icon ? `${baseUrl}${row.category_icon}` : null,
      points: Number(row.points) || 0,
    }));

    const displayName =
      student.student_name ||
      [student.first_name, student.last_name].filter(Boolean).join(" ").trim() ||
      student.email;

    return {
      student: {
        user_id: Number(student.user_id),
        name: displayName,
        avatar_url: student.avatar_url ? `${baseUrl}${student.avatar_url}` : null,
      },
      points: {
        total_points: Number(student.total_points) || 0,
        semester_points: Number(semesterPointsRow?.total) || 0,
      },
      level: {
        current_level_id: Number(student.level) || 1,
        current_level_title: student.level_title || `Level ${Number(student.level) || 1}`,
        current_xp: currentXp,
        next_level_id: nextLevel ? Number(nextLevel.id) : null,
        next_level_title: nextLevel?.title || null,
        next_level_min_xp: nextLevelMinXp,
        xp_needed_for_next_level: xpNeededForNextLevel,
        progress_percent: progressPercent,
      },
      streak_days: Number(student.streak_days) || 0,
      badges_count: Number(badgesRow?.count) || 0,
      challenges: {
        in_progress: Number((challengeStats as any)?.in_progress) || 0,
        completed: Number((challengeStats as any)?.completed) || 0,
      },
      points_by_category: pointsByCategory,
      semester_range: {
        start: semesterRange.start.toISOString(),
        end: semesterRange.end.toISOString(),
      },
    };
  }

  async createStudent(data: CreateStudentDTO): Promise<StudentResponse> {
    const { email, name, school_id, class_id, section_id } = data;
    const password = generatePassword();

    await this.ensureEmailNotExists(email);

    const studentRole = await db(TABLE.ROLES).where({ name: UserRole.STUDENT }).first();
    if (!studentRole) {
      throw new StudentError("Student role not found", 500);
    }

    await this.validateSchoolAndClass(school_id, class_id);

    if (section_id) {
      await this.validateSectionBelongsToClass(section_id, class_id);
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    const hasNameColumn = await hasColumn(TABLE.STUDENTS, "name");
    const hasFirstName = await hasColumn(TABLE.STUDENTS, "first_name");
    const hasLastName = await hasColumn(TABLE.STUDENTS, "last_name");

    const student = await this.withTransaction(async (trx) => {
      const [user] = await trx(TABLE.USERS)
        .insert({
          email,
          password_hash: hashedPassword,
          role_id: studentRole.id,
          is_active: true,
          school_id,
        })
        .returning(["id", "email", "is_active", "avatar_url", "created_at"]);

      const studentInsert: Record<string, string | number | null> = {
        user_id: user.id,
        school_id,
        class_id,
        section_id: section_id || null,
      };

      if (hasNameColumn) {
        studentInsert.name = name;
      } else if (hasFirstName || hasLastName) {
        const { first_name, last_name } = this.splitName(name);
        if (hasFirstName) studentInsert.first_name = first_name || null;
        if (hasLastName) studentInsert.last_name = last_name || null;
      }

      const [studentRecord] = await trx(TABLE.STUDENTS)
        .insert(studentInsert)
        .returning("*");

      return { user, studentRecord };
    });

    // Send welcome email outside transaction so email failure doesn't rollback student creation
    try {
      const emailSvc = new EmailService();
      emailSvc.queueWelcomeEmail(email, password, name, UserRole.STUDENT);
      await emailSvc.sendQueuedEmails();
    } catch (emailError) {
      console.error("Failed to send student welcome email:", emailError);
    }

    return this.getStudentById(student.user.id);
  }

  async updateStudent(id: number, data: UpdateStudentDTO): Promise<StudentResponse> {
    const studentRecord = await db(TABLE.STUDENTS).where("user_id", id).first();
    if (!studentRecord) {
      throw new StudentError("Student not found", 404);
    }

    if (data.email) {
      const existingUser = await db(TABLE.USERS)
        .where({ email: data.email })
        .whereNot("id", studentRecord.user_id)
        .first();

      if (existingUser) {
        throw new StudentError("Email already exists", 400);
      }
    }

    if (data.school_id || data.class_id) {
      const schoolId = data.school_id || studentRecord.school_id;
      const classId = data.class_id || studentRecord.class_id;
      await this.validateSchoolAndClass(schoolId, classId);
    }

    // Validate section belongs to class if section_id is provided
    const classIdForSection = data.class_id || studentRecord.class_id;
    if (data.section_id) {
      await this.validateSectionBelongsToClass(data.section_id, classIdForSection);
    }

    // If class changes, clear section_id (section might not belong to new class)
    const shouldClearSection = data.class_id && data.class_id !== studentRecord.class_id && data.section_id === undefined;

    const hasNameColumn = await hasColumn(TABLE.STUDENTS, "name");
    const hasFirstName = await hasColumn(TABLE.STUDENTS, "first_name");
    const hasLastName = await hasColumn(TABLE.STUDENTS, "last_name");

    await this.withTransaction(async (trx) => {
      const userUpdateData: Record<string, string | boolean> = {};
      if (data.email) userUpdateData.email = data.email;
      if (data.is_active !== undefined) userUpdateData.is_active = data.is_active;

      if (Object.keys(userUpdateData).length > 0) {
        await trx(TABLE.USERS)
          .where("id", studentRecord.user_id)
          .update(userUpdateData);
      }

      const studentUpdateData: Record<string, string | number | null> = {};
      if (data.name) {
        if (hasNameColumn) {
          studentUpdateData.name = data.name;
        } else if (hasFirstName || hasLastName) {
          const { first_name, last_name } = this.splitName(data.name);
          if (hasFirstName) studentUpdateData.first_name = first_name || null;
          if (hasLastName) studentUpdateData.last_name = last_name || null;
        }
      }
      if (data.school_id) studentUpdateData.school_id = data.school_id;
      if (data.class_id) studentUpdateData.class_id = data.class_id;

      // Handle section_id: can be set, cleared (null), or auto-cleared on class change
      if (data.section_id !== undefined) {
        studentUpdateData.section_id = data.section_id;
      } else if (shouldClearSection) {
        studentUpdateData.section_id = null;
      }

      if (Object.keys(studentUpdateData).length > 0) {
        await trx(TABLE.STUDENTS)
          .where("user_id", id)
          .update(studentUpdateData);
      }
    });

    return this.getStudentById(id);
  }

  async getAllStudents(
    filters: StudentFilters,
    pagination: PaginationDTO,
    user?: { id: number; role?: string; school_id?: number }
  ): Promise<PaginatedResponse<StudentResponse>> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const hasSectionId = await hasColumn(TABLE.STUDENTS, "section_id");
    const hasSectionsTable = await db.schema.hasTable(TABLE.SECTIONS);
    const hasNameColumn = await hasColumn(TABLE.STUDENTS, "name");
    const hasFirstName = await hasColumn(TABLE.STUDENTS, "first_name");
    const hasLastName = await hasColumn(TABLE.STUDENTS, "last_name");

    const selectFields: Array<string | Knex.Raw> = [
      `${TABLE.STUDENTS}.user_id as id`,
      `${TABLE.STUDENTS}.user_id`,
      `${TABLE.STUDENTS}.school_id`,
      `${TABLE.STUDENTS}.class_id`,
      `${TABLE.STUDENTS}.level`,
      `${TABLE.STUDENTS}.total_points`,
      `${TABLE.STUDENTS}.streak_days`,
      `${TABLE.USERS}.email`,
      `${TABLE.USERS}.is_active`,
      `${TABLE.USERS}.avatar_url`,
      `${TABLE.USERS}.created_at`,
      `${TABLE.CLASSES}.name as class_name`,
      `${TABLE.SCHOOLS}.name as school_name`,
    ];

    if (hasNameColumn) {
      selectFields.push(`${TABLE.STUDENTS}.name`);
    } else if (hasFirstName && hasLastName) {
      selectFields.push(
        db.raw("concat_ws(' ', ??, ??) as name", [
          `${TABLE.STUDENTS}.first_name`,
          `${TABLE.STUDENTS}.last_name`,
        ])
      );
    } else if (hasFirstName) {
      selectFields.push(db.raw("?? as name", [`${TABLE.STUDENTS}.first_name`]));
    } else if (hasLastName) {
      selectFields.push(db.raw("?? as name", [`${TABLE.STUDENTS}.last_name`]));
    } else {
      selectFields.push(db.raw("null as name"));
    }

    if (hasSectionId) {
      selectFields.push(`${TABLE.STUDENTS}.section_id`);
    } else {
      selectFields.push(db.raw("null as section_id"));
    }
    if (hasSectionId && hasSectionsTable) {
      selectFields.push(`${TABLE.SECTIONS}.name as section_name`);
    } else {
      selectFields.push(db.raw("null as section_name"));
    }

    let query = db(TABLE.STUDENTS).select(selectFields)
      .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .join(TABLE.CLASSES, `${TABLE.STUDENTS}.class_id`, `${TABLE.CLASSES}.id`)
      .join(TABLE.SCHOOLS, `${TABLE.STUDENTS}.school_id`, `${TABLE.SCHOOLS}.id`)
      .where(`${TABLE.USERS}.is_deleted`, false);

    if (hasSectionId && hasSectionsTable) {
      query = query.leftJoin(
        TABLE.SECTIONS,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.SECTIONS}.id`
      );
    }

    if (user && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SUPER_SUB_ADMIN && user.school_id) {
      query = query.where(`${TABLE.STUDENTS}.school_id`, user.school_id);
    } else if (filters.school_id) {
      query = query.where(`${TABLE.STUDENTS}.school_id`, filters.school_id);
    }

    if (filters.search) {
      const safeTerm = buildSearchTerm(filters.search);
      query = query.where((builder) => {
        builder.where(`${TABLE.USERS}.email`, "ilike", safeTerm);

        if (hasNameColumn) {
          builder.orWhere(`${TABLE.STUDENTS}.name`, "ilike", safeTerm);
        } else if (hasFirstName && hasLastName) {
          builder.orWhereRaw("concat_ws(' ', ??, ??) ilike ?", [
            `${TABLE.STUDENTS}.first_name`,
            `${TABLE.STUDENTS}.last_name`,
            safeTerm,
          ]);
        } else if (hasFirstName) {
          builder.orWhere(`${TABLE.STUDENTS}.first_name`, "ilike", safeTerm);
        } else if (hasLastName) {
          builder.orWhere(`${TABLE.STUDENTS}.last_name`, "ilike", safeTerm);
        }
      });
    }

    if (filters.class_id) {
      query = query.where(`${TABLE.STUDENTS}.class_id`, filters.class_id);
    }

    if (filters.section_id && hasSectionId) {
      query = query.where(`${TABLE.STUDENTS}.section_id`, filters.section_id);
    }

    if (filters.is_active !== undefined) {
      query = query.where(`${TABLE.USERS}.is_active`, filters.is_active);
    }

    const countQuery = query.clone().clearSelect().clearOrder();
    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const students = await query
      .offset(offset)
      .limit(limit)
      .orderBy(`${TABLE.USERS}.created_at`, "desc");

    const studentsWithAvatar = students.map((student: StudentResponse) => ({
      ...student,
      avatar_url: student.avatar_url ? process.env.BASE_URL + student.avatar_url : null,
    }));

    return {
      data: studentsWithAvatar,
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

  async getStudentById(id: number): Promise<StudentResponse> {
    const hasSectionId = await hasColumn(TABLE.STUDENTS, "section_id");
    const hasSectionsTable = await db.schema.hasTable(TABLE.SECTIONS);
    const hasNameColumn = await hasColumn(TABLE.STUDENTS, "name");
    const hasFirstName = await hasColumn(TABLE.STUDENTS, "first_name");
    const hasLastName = await hasColumn(TABLE.STUDENTS, "last_name");

    const selectFields: Array<string | Knex.Raw> = [
      `${TABLE.STUDENTS}.user_id as id`,
      `${TABLE.STUDENTS}.user_id`,
      `${TABLE.STUDENTS}.school_id`,
      `${TABLE.STUDENTS}.class_id`,
      `${TABLE.STUDENTS}.level`,
      `${TABLE.STUDENTS}.total_points`,
      `${TABLE.STUDENTS}.streak_days`,
      `${TABLE.USERS}.email`,
      `${TABLE.USERS}.is_active`,
      `${TABLE.USERS}.avatar_url`,
      `${TABLE.USERS}.created_at`,
      `${TABLE.CLASSES}.name as class_name`,
      `${TABLE.SCHOOLS}.name as school_name`,
    ];

    if (hasNameColumn) {
      selectFields.push(`${TABLE.STUDENTS}.name`);
    } else if (hasFirstName && hasLastName) {
      selectFields.push(
        db.raw("concat_ws(' ', ??, ??) as name", [
          `${TABLE.STUDENTS}.first_name`,
          `${TABLE.STUDENTS}.last_name`,
        ])
      );
    } else if (hasFirstName) {
      selectFields.push(db.raw("?? as name", [`${TABLE.STUDENTS}.first_name`]));
    } else if (hasLastName) {
      selectFields.push(db.raw("?? as name", [`${TABLE.STUDENTS}.last_name`]));
    } else {
      selectFields.push(db.raw("null as name"));
    }

    if (hasSectionId) {
      selectFields.push(`${TABLE.STUDENTS}.section_id`);
    } else {
      selectFields.push(db.raw("null as section_id"));
    }
    if (hasSectionId && hasSectionsTable) {
      selectFields.push(`${TABLE.SECTIONS}.name as section_name`);
    } else {
      selectFields.push(db.raw("null as section_name"));
    }

    let studentQuery = db(TABLE.STUDENTS).select(selectFields)
      .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
      .join(TABLE.CLASSES, `${TABLE.STUDENTS}.class_id`, `${TABLE.CLASSES}.id`)
      .join(TABLE.SCHOOLS, `${TABLE.STUDENTS}.school_id`, `${TABLE.SCHOOLS}.id`)
      .where(`${TABLE.USERS}.is_deleted`, false);

    if (hasSectionId && hasSectionsTable) {
      studentQuery = studentQuery.leftJoin(
        TABLE.SECTIONS,
        `${TABLE.STUDENTS}.section_id`,
        `${TABLE.SECTIONS}.id`
      );
    }

    const student = await studentQuery
      .where(`${TABLE.STUDENTS}.user_id`, id)
      .first();

    if (!student) {
      throw new StudentError("Student not found", 404);
    }

    return {
      ...student,
      avatar_url: student.avatar_url ? process.env.BASE_URL + student.avatar_url : null,
    };
  }

  async getStudentWithDetails(id: number): Promise<StudentWithBadgesResponse> {
    const student = await this.getStudentById(id);

    const badges = await db(TABLE.STUDENT_BADGES)
      .select(
        `${TABLE.BADGES}.id`,
        `${TABLE.BADGES}.name`,
        `${TABLE.BADGES}.criteria`,
        `${TABLE.BADGES}.icon_url`,
        `${TABLE.STUDENT_BADGES}.earned_at`
      )
      .join(TABLE.BADGES, `${TABLE.STUDENT_BADGES}.badge_id`, `${TABLE.BADGES}.id`)
      .where(`${TABLE.STUDENT_BADGES}.user_id`, student.user_id);

    const activitiesCountResult = await db(TABLE.ACTIVITIES)
      .where("user_id", student.user_id)
      .count({ count: "*" })
      .first();
    const activitiesCount = parseInt(activitiesCountResult?.count as string) || 0;

    const levelInfo = student.level
      ? await db(TABLE.LEVELS).where("id", student.level).first()
      : null;

    return {
      ...student,
      badges: badges.map((badge: BadgeResponse) => ({
        ...badge,
        icon_url: badge.icon_url ? `${process.env.BASE_URL}${badge.icon_url}` : badge.icon_url,
      })),
      activitiesCount,
      levelInfo,
    };
  }

  async deleteStudent(id: number): Promise<StudentResponse> {
    const student = await this.getStudentById(id);
    
    // Soft delete: set is_deleted = true and deleted_at timestamp
    await db(TABLE.USERS)
      .where("id", student.user_id)
      .update({
        is_deleted: true,
        deleted_at: db.fn.now(),
      });

    return student;
  }

  async assignToClass(studentId: number, classId: number): Promise<StudentResponse> {
    const student = await db(TABLE.STUDENTS).where("user_id", studentId).first();
    if (!student) {
      throw new StudentError("Student not found", 404);
    }

    const classRecord = await db(TABLE.CLASSES).where("id", classId).first();
    if (!classRecord) {
      throw new StudentError("Class not found", 404);
    }

    await db(TABLE.STUDENTS)
      .where("user_id", studentId)
      .update({ class_id: classId });

    return this.getStudentById(studentId);
  }

  private getCurrentSemesterRange(currentDate: Date): { start: Date; end: Date } {
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth();
    const firstHalf = month < 6;

    const start = firstHalf
      ? new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
      : new Date(Date.UTC(year, 6, 1, 0, 0, 0, 0));
    const end = firstHalf
      ? new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999))
      : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    return { start, end };
  }

  private getDateRangeForPeriod(
    period: LeaderboardPeriod,
    currentDate: Date
  ): { start: Date; end: Date } | null {
    if (period === "all_time") {
      return null;
    }

    const nowUtc = new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        currentDate.getUTCHours(),
        currentDate.getUTCMinutes(),
        currentDate.getUTCSeconds(),
        currentDate.getUTCMilliseconds()
      )
    );

    if (period === "week") {
      // Week starts Monday and ends Sunday (UTC).
      const day = nowUtc.getUTCDay(); // 0=Sun,1=Mon,...6=Sat
      const diffToMonday = day === 0 ? 6 : day - 1;
      const start = new Date(nowUtc);
      start.setUTCDate(nowUtc.getUTCDate() - diffToMonday);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);

      return { start, end };
    }

    if (period === "month") {
      const start = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return { start, end };
    }

    return this.getCurrentSemesterRange(nowUtc);
  }

  private buildLeaderboardNameSelect(params: {
    hasStudentName: boolean;
    hasUserFirstName: boolean;
    hasUserLastName: boolean;
  }): Knex.Raw {
    const { hasStudentName, hasUserFirstName, hasUserLastName } = params;

    const userFullNameExpr = hasUserFirstName && hasUserLastName
      ? `NULLIF(TRIM(CONCAT(COALESCE(${TABLE.USERS}.first_name, ''), ' ', COALESCE(${TABLE.USERS}.last_name, ''))), '')`
      : hasUserFirstName
      ? `NULLIF(TRIM(${TABLE.USERS}.first_name), '')`
      : hasUserLastName
      ? `NULLIF(TRIM(${TABLE.USERS}.last_name), '')`
      : "NULL";

    if (hasStudentName) {
      return db.raw(
        `COALESCE(NULLIF(TRIM(${TABLE.STUDENTS}.name), ''), ${userFullNameExpr}, ${TABLE.USERS}.email) as name`
      );
    }

    return db.raw(`COALESCE(${userFullNameExpr}, ${TABLE.USERS}.email) as name`);
  }

  private async withTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    return await db.transaction(async (trx) => {
      return await callback(trx);
    });
  }

  private async ensureEmailNotExists(email: string): Promise<void> {
    const existingUser = await db(TABLE.USERS).where({ email }).first();
    if (existingUser) {
      throw new StudentError("Email already exists", 400);
    }
  }

  private async validateSchoolAndClass(schoolId: number, classId: number): Promise<void> {
    const school = await db(TABLE.SCHOOLS).where("id", schoolId).first();
    if (!school) {
      throw new StudentError("School not found", 404);
    }

    const classRecord = await db(TABLE.CLASSES).where("id", classId).first();
    if (!classRecord) {
      throw new StudentError("Class not found", 404);
    }
  }

  private async validateSectionBelongsToClass(sectionId: number, classId: number): Promise<void> {
    // Sections are now global, so just verify the section exists
    const section = await db(TABLE.SECTIONS)
      .where("id", sectionId)
      .first();

    if (!section) {
      throw new StudentError("Section not found", 400);
    }
  }

  private splitName(fullName?: string): { first_name?: string; last_name?: string } {
    if (!fullName) {
      return {};
    }

    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { first_name: parts[0] };
    }

    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(" "),
    };
  }

  /**
   * Bulk upload students from CSV/XLSX file
   */
  async bulkUploadStudents(
    fileBuffer: Buffer,
    fileName: string,
    userRole: string,
    userSchoolId?: number
  ): Promise<{ success: number; errors: Array<{ row: number; errors: string[] }> }> {
    try {
      const parsedData = await this.parseUploadFile(fileBuffer, fileName);
      const { errors, totalErrors } = this.validateUploadData(parsedData);

      if (totalErrors > 0) {
        const message = totalErrors > 5 
          ? `Validation failed for ${totalErrors} rows. Showing first 5 errors. Please fill the data properly and try again.`
          : "Validation failed for some rows";
        throw new StudentError(message, 400, { errors, totalErrors });
      }

      const schoolId = this.determineSchoolId(userRole, userSchoolId);
      await this.ensureSchoolExists(schoolId);

      const { classMapping, sectionMapping, dbErrors, totalDbErrors } = await this.validateAndMapClassesSections(
        parsedData,
        schoolId
      );

      if (totalDbErrors > 0) {
        const message = totalDbErrors > 5 
          ? `Validation failed for ${totalDbErrors} rows. Showing first 5 errors. Please fill the data properly and try again.`
          : "Validation failed for some rows";
        throw new StudentError(message, 400, { errors: dbErrors, totalErrors: totalDbErrors });
      }

      const successCount = await this.insertStudents(
        parsedData,
        schoolId,
        classMapping,
        sectionMapping
      );

      return { success: successCount, errors: [] };
    } catch (error: unknown) {
      if (error instanceof StudentError) throw error;
      console.error("Bulk upload error:", error);
      throw new StudentError(`Bulk upload failed: ${getErrorMessage(error)}`, 500);
    }
  }

  private async parseUploadFile(
    fileBuffer: Buffer,
    fileName: string
  ): Promise<Array<{ name: string; email: string; class: string; section: string; contactNumber: string; rowNumber: number }>> {
    const XLSX = await import("xlsx");
    // Accept either 'contact number' or 'phone number' for phone column
    const requiredHeaders = ["student name", "class", "section", "school email"];
    const contactHeaderAliases = ["contact number", "phone number"];

    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      throw new StudentError("Invalid file format. Only .csv and .xlsx files are allowed", 400);
    }
    const isCSV = fileName.toLowerCase().endsWith(".csv");

    const workbook = XLSX.read(
      isCSV ? fileBuffer.toString("utf8") : fileBuffer,
      { type: isCSV ? "string" : "buffer" }
    );
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new StudentError("File is empty or invalid", 400);
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as Array<Array<string | number>>;

    if (jsonData.length === 0) throw new StudentError("File is empty", 400);

    // Normalize headers to lowercase for case-insensitive matching
    const actualHeaders = jsonData[0]!.map((header) => String(header || "").trim().toLowerCase());
    const headerMap = new Map<string, string>();

    // Create mapping from normalized headers to original headers
    jsonData[0]!.forEach((header, index) => {
      const normalized = String(header || "").trim().toLowerCase();
      headerMap.set(normalized, String(header || "").trim());
    });

    const missingHeaders = requiredHeaders.filter((h) => !actualHeaders.includes(h));
    const hasContactHeader = contactHeaderAliases.some((h) => actualHeaders.includes(h));
    if (!hasContactHeader) {
      missingHeaders.push("contact number (or phone number)");
    }

    if (missingHeaders.length > 0) {
      throw new StudentError(
        `Missing required headers: ${missingHeaders.join(", ")}. Required: ${[...requiredHeaders, 'contact number (or phone number)'].join(", ")} (case-insensitive)`,
        400
      );
    }

    return jsonData.slice(1)
      .filter((row) => {
        // Skip completely empty rows
        return row.some((cell) => String(cell || "").trim() !== "");
      })
      .map((row, index) => {
        const obj: Record<string, string | number> = {};
        actualHeaders.forEach((normalizedHeader, i) => {
          obj[normalizedHeader] = row[i] !== undefined ? row[i] : "";
        });
        return {
          name: String(obj["student name"] || "").trim(),
          email: String(obj["school email"] || "").trim().toLowerCase(),
          class: String(obj["class"] || "").trim(),
          section: String(obj["section"] || "").trim(),
          contactNumber: String(obj["contact number"] || obj["phone number"] || "").trim(),
          rowNumber: index + 2,
        };
      });
  }

  private validateUploadData(
    data: Array<{ name: string; email: string; class: string; section: string; contactNumber: string; rowNumber: number }>
  ): { errors: Array<{ row: number; errors: string[] }>; totalErrors: number } {
    const errors: Array<{ row: number; errors: string[] }> = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let totalErrors = 0;
    const MAX_ERRORS_TO_SHOW = 5;

    for (const row of data) {
      const rowErrors: string[] = [];

      if (!row.name) rowErrors.push("Student Name is required");
      if (!row.class) rowErrors.push("Class is required");
      if (!row.section) rowErrors.push("Section is required");
      if (!row.contactNumber) rowErrors.push("Contact Number is required");
      if (!row.email) {
        rowErrors.push("School Email is required");
      } else if (!emailRegex.test(row.email)) {
        rowErrors.push("School Email is not a valid email address");
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
        throw new StudentError("Super Admin/Super Sub-Admin must specify school_id for bulk upload", 400);
      }
      return userSchoolId;
    } else if (userRole === UserRole.ADMIN || userRole === UserRole.SUB_ADMIN) {
      if (!userSchoolId) {
        throw new StudentError("User is not associated with any school", 400);
      }
      return userSchoolId;
    } else {
      throw new StudentError("Insufficient permissions for bulk upload", 403);
    }
  }

  private async ensureSchoolExists(schoolId: number): Promise<void> {
    const school = await db(TABLE.SCHOOLS).where("id", schoolId).first();
    if (!school) throw new StudentError("School not found", 404);
  }

  private async validateAndMapClassesSections(
    data: Array<{ name: string; email: string; class: string; section: string; rowNumber: number }>,
    schoolId: number
  ): Promise<{
    classMapping: Map<string, number>;
    sectionMapping: Map<string, number>;
    dbErrors: Array<{ row: number; errors: string[] }>;
    totalDbErrors: number;
  }> {
    const classMapping = new Map<string, number>();
    const sectionMapping = new Map<string, number>();
    const dbErrors: Array<{ row: number; errors: string[] }> = [];
    let totalDbErrors = 0;
    const MAX_ERRORS_TO_SHOW = 5;

    // Batch query 1: Get all unique classes at once
    const uniqueClasses = [...new Set(data.map((r) => r.class))];
    const allClasses = await db(TABLE.CLASSES).whereIn("name", uniqueClasses).select("id", "name");
    const classMap = new Map(allClasses.map((c) => [c.name, c.id]));

    // Batch query 2: Get all existing emails at once
    const uniqueEmails = data.map((r) => r.email);
    const existingUsers = await db(TABLE.USERS).whereIn("email", uniqueEmails).select("email");
    const existingEmailSet = new Set(existingUsers.map((u) => u.email));

    // Batch query 3: Get all sections for the school at once
    const existingSections = await db(TABLE.SECTIONS)
      .where({ school_id: schoolId })
      .whereIn("class_id", Array.from(classMap.values()))
      .select("id", "name", "class_id");
    
    const sectionLookup = new Map<string, number>();
    existingSections.forEach((s) => {
      const key = `${s.class_id}::${s.name}`;
      sectionLookup.set(key, s.id);
    });

    // Track duplicate emails within file
    const emailSet = new Set<string>();

    // Now validate in loop without queries
    for (const row of data) {
      const rowErrors: string[] = [];

      // Check duplicate email in file
      if (emailSet.has(row.email)) {
        rowErrors.push(`Duplicate email in file: ${row.email}`);
      }
      emailSet.add(row.email);

      // Check if class exists (using pre-loaded map)
      const classId = classMap.get(row.class);
      if (!classId) {
        rowErrors.push(`Class '${row.class}' not found`);
      } else {
        classMapping.set(row.class, classId);
      }

      // Check section (using pre-loaded lookup)
      const sectionKey = `${row.class}::${row.section}`;
      if (classId) {
        const sectionLookupKey = `${classId}::${row.section}`;
        const sectionId = sectionLookup.get(sectionLookupKey);
        sectionMapping.set(sectionKey, sectionId || -1);
      }

      // Check if email exists in database (using pre-loaded set)
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

    return { classMapping, sectionMapping, dbErrors, totalDbErrors };
  }

  private async insertStudents(
    data: Array<{ name: string; email: string; class: string; section: string; contactNumber: string; rowNumber: number }>,
    schoolId: number,
    classMapping: Map<string, number>,
    sectionMapping: Map<string, number>
  ): Promise<number> {
    const studentRole = await db(TABLE.ROLES).where({ name: UserRole.STUDENT }).first();
    if (!studentRole) throw new StudentError("Student role not found in database", 500);

    const hasNameColumn = await hasColumn(TABLE.STUDENTS, "name");
    const hasFirstName = await hasColumn(TABLE.STUDENTS, "first_name");
    const hasLastName = await hasColumn(TABLE.STUDENTS, "last_name");

    let successCount = 0;
    const emailService = new EmailService();

    await this.withTransaction(async (trx) => {
      // Create missing sections
      for (const [sectionKey, sectionId] of sectionMapping.entries()) {
        if (sectionId === -1) {
          const separatorIndex = sectionKey.indexOf('::');
          const className = sectionKey.substring(0, separatorIndex);
          const sectionName = sectionKey.substring(separatorIndex + 2);
          const [newSection] = await trx(TABLE.SECTIONS)
            .insert({
              name: sectionName,
              class_id: classMapping.get(className)!,
              school_id: schoolId,
            })
            .returning(["id"]);
          sectionMapping.set(sectionKey, newSection.id);
        }
      }

      // Insert students
      for (const row of data) {
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        const [user] = await trx(TABLE.USERS)
          .insert({
            email: row.email,
            password_hash: hashedPassword,
            role_id: studentRole.id,
            is_active: true,
            school_id: schoolId,
          })
          .returning(["id"]);

        const studentInsert: Record<string, string | number | null> = {
          user_id: user.id,
          school_id: schoolId,
          class_id: classMapping.get(row.class)!,
          section_id: sectionMapping.get(`${row.class}::${row.section}`)!,
          contact_number: row.contactNumber || null,
        };

        if (hasNameColumn) {
          studentInsert.name = row.name;
        } else if (hasFirstName || hasLastName) {
          const { first_name, last_name } = this.splitName(row.name);
          if (hasFirstName) studentInsert.first_name = first_name || null;
          if (hasLastName) studentInsert.last_name = last_name || null;
        }

        await trx(TABLE.STUDENTS).insert(studentInsert);

        // Queue email for sending after transaction
        emailService.queueWelcomeEmail(row.email, password, row.name, UserRole.STUDENT);
        successCount++;
      }
    });

    // Send all queued emails after transaction commits
    await emailService.sendQueuedEmails();

    return successCount;
  }

}

export { StudentError } from "../utils/errors";

export const studentService = new StudentService();

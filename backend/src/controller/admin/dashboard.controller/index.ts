import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { getUserPermissionsMap } from "../../../middlewares/permissionMiddleware";
import { ModuleKey } from "../../../utils/enums/permissions.enum";

interface ActivityRow {
  photos?: string | string[];
  [key: string]: unknown;
}

interface StudentRow {
  avatar_url?: string;
  [key: string]: unknown;
}

interface SchoolRow {
  id: number;
  name: string;
  subscription_status: string;
  [key: string]: unknown;
}

export const getDashboardStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const userSchoolId = req.user?.school_id;
      const userId = req.user?.id;

      // Build base query conditions based on role
      const isGlobalAdmin = requesterRole === UserRole.SUPER_ADMIN;

      // Get user permissions (skip for super admin)
      let userPermissions: Record<string, Record<string, boolean>> = {};
      if (!isGlobalAdmin && userId) {
        userPermissions = await getUserPermissionsMap(userId);
        console.log(`[Dashboard] User ${userId} permissions:`, JSON.stringify(userPermissions, null, 2));
      }

      // Helper function to check if user has read permission for a module
      const hasReadPermission = (moduleKey: string): boolean => {
        if (isGlobalAdmin) return true;
        const hasPermission = userPermissions[moduleKey]?.can_read || false;
        console.log(`[Dashboard] Check permission for ${moduleKey}: ${hasPermission}`);
        return hasPermission;
      };

      // Initialize stats object
      const stats: Record<string, number> = {};

      // Total system users count (Super Sub-Admin and Sub-Admin)
      let systemUsersQuery = db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .where(`${TABLE.USERS}.is_deleted`, false);

      if (isGlobalAdmin) {
        // Super Admin sees both Super Sub-Admins and Sub-Admins
        systemUsersQuery = systemUsersQuery.whereIn(`${TABLE.ROLES}.name`, [UserRole.SUPER_SUB_ADMIN, UserRole.SUB_ADMIN]);
      } else if (requesterRole === UserRole.SUPER_SUB_ADMIN) {
        // Super Sub-Admin sees only Sub-Admins (all schools)
        systemUsersQuery = systemUsersQuery.where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN);
      } else if (requesterRole === UserRole.ADMIN) {
        // Admin sees only Sub-Admins from their school
        if (!userSchoolId) {
          sendResponse(res, 403, "Admin must have a school assigned", false);
          return;
        }
        systemUsersQuery = systemUsersQuery
          .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
          .where(`${TABLE.ROLES}.name`, UserRole.SUB_ADMIN)
          .where(`${TABLE.STAFF}.school_id`, userSchoolId);
      } else {
        // For other roles (e.g., Sub-Admin), don't show system users count
        systemUsersQuery = systemUsersQuery.where(`${TABLE.ROLES}.name`, 'NONE');
      }

      const totalSystemUsersResult = await systemUsersQuery.count({ count: "*" });
      stats.totalSystemUsers = parseInt(totalSystemUsersResult[0]?.count as string) || 0;

      // Total schools count (ONLY for super admin)
      if (isGlobalAdmin) {
        const schoolsResult = await db(TABLE.SCHOOLS).count({ count: "*" });
        const totalSchools = parseInt(schoolsResult[0]?.count as string) || 0;
        stats.totalSchools = totalSchools;
      }

      // Total students count (only if user has students read permission)
      if (hasReadPermission(ModuleKey.STUDENTS)) {
        let studentsQuery = db(TABLE.STUDENTS)
          .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
          .where(`${TABLE.USERS}.is_deleted`, false)
          .count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          studentsQuery = studentsQuery.where(`${TABLE.STUDENTS}.school_id`, userSchoolId);
        }
        const totalStudentsResult = await studentsQuery;
        stats.totalStudents = parseInt(totalStudentsResult[0]?.count as string) || 0;
      }

      // Total teachers count (only if user has teachers read permission)
      if (hasReadPermission(ModuleKey.TEACHERS)) {
        let teachersQuery = db(TABLE.STAFF)
          .join(TABLE.USERS, `${TABLE.STAFF}.user_id`, `${TABLE.USERS}.id`)
          .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
          .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
          .where(`${TABLE.USERS}.is_deleted`, false)
          .count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          teachersQuery = teachersQuery.where(`${TABLE.STAFF}.school_id`, userSchoolId);
        }
        const totalTeachersResult = await teachersQuery;
        stats.totalTeachers = parseInt(totalTeachersResult[0]?.count as string) || 0;
      }

      // Activities stats (only if user has activities read permission)
      if (hasReadPermission(ModuleKey.ACTIVITIES)) {
        // Total activities count
        let activitiesQuery = db(TABLE.ACTIVITIES).count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          activitiesQuery = activitiesQuery.where("school_id", userSchoolId);
        }
        const totalActivitiesResult = await activitiesQuery;
        stats.totalActivities = parseInt(totalActivitiesResult[0]?.count as string) || 0;

        // Pending activities count
        let pendingActivitiesQuery = db(TABLE.ACTIVITIES)
          .where("status", "pending")
          .count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          pendingActivitiesQuery = pendingActivitiesQuery.where("school_id", userSchoolId);
        }
        const pendingActivitiesResult = await pendingActivitiesQuery;
        stats.pendingActivities = parseInt(pendingActivitiesResult[0]?.count as string) || 0;

        // Approved activities count
        let approvedActivitiesQuery = db(TABLE.ACTIVITIES)
          .where("status", "approved")
          .count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          approvedActivitiesQuery = approvedActivitiesQuery.where("school_id", userSchoolId);
        }
        const approvedActivitiesResult = await approvedActivitiesQuery;
        stats.approvedActivities = parseInt(approvedActivitiesResult[0]?.count as string) || 0;
      }

      // Challenges stats (only if user has challenges read permission)
      if (hasReadPermission(ModuleKey.CHALLENGES)) {
        // Total challenges count
        let challengesQuery = db(TABLE.CHALLENGES).count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          challengesQuery = challengesQuery.where((builder) => {
            builder.where("school_id", userSchoolId).orWhereNull("school_id");
          });
        }
        const totalChallengesResult = await challengesQuery;
        stats.totalChallenges = parseInt(totalChallengesResult[0]?.count as string) || 0;

        // Active challenges count
        let activeChallengesQuery = db(TABLE.CHALLENGES)
          .where("is_active", true)
          .count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          activeChallengesQuery = activeChallengesQuery.where((builder) => {
            builder.where("school_id", userSchoolId).orWhereNull("school_id");
          });
        }
        const activeChallengesResult = await activeChallengesQuery;
        stats.activeChallenges = parseInt(activeChallengesResult[0]?.count as string) || 0;
      }

      // Total articles count (only if user has articles read permission)
      if (hasReadPermission(ModuleKey.ARTICLES)) {
        let articlesQuery = db(TABLE.ARTICLES).count({ count: "*" });
        if (!isGlobalAdmin && userSchoolId) {
          articlesQuery = articlesQuery.where((builder) => {
            builder.where("school_id", userSchoolId).orWhereNull("school_id");
          });
        }
        const totalArticlesResult = await articlesQuery;
        stats.totalArticles = parseInt(totalArticlesResult[0]?.count as string) || 0;
      }

      // Total categories count (only if user has categories read permission)
      if (hasReadPermission(ModuleKey.CATEGORIES)) {
        const totalCategoriesResult = await db(TABLE.CATEGORIES).count({ count: "*" });
        stats.totalCategories = parseInt(totalCategoriesResult[0]?.count as string) || 0;
      }

      // Total badges count (only if user has badges read permission)
      if (hasReadPermission(ModuleKey.BADGES)) {
        const totalBadgesResult = await db(TABLE.BADGES).count({ count: "*" });
        stats.totalBadges = parseInt(totalBadgesResult[0]?.count as string) || 0;
      }

      // Total points distributed (only if user has students read permission)
      if (hasReadPermission(ModuleKey.STUDENTS)) {
        let pointsQuery = db(TABLE.POINTS_LOG).sum({ total: "amount" });
        if (!isGlobalAdmin && userSchoolId) {
          pointsQuery = pointsQuery
            .join(TABLE.STUDENTS, `${TABLE.POINTS_LOG}.user_id`, `${TABLE.STUDENTS}.user_id`)
            .where(`${TABLE.STUDENTS}.school_id`, userSchoolId);
        }
        const totalPointsResult = await pointsQuery;
        stats.totalPointsDistributed = parseInt(totalPointsResult[0]?.total as string) || 0;
      }

      console.log(`[Dashboard] Final stats object:`, JSON.stringify(stats, null, 2));
      sendResponse(res, 200, "Dashboard stats fetched successfully", true, stats);
      return;
    } catch (error: unknown) {
      console.error("Error fetching dashboard stats:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getRecentActivities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const userSchoolId = req.user?.school_id;
      const { limit } = req.query;

      const recordLimit = parseInt(limit as string) || 10;

      const isGlobalAdmin = requesterRole === UserRole.SUPER_ADMIN;

      let query = db(TABLE.ACTIVITIES)
        .select(
          `${TABLE.ACTIVITIES}.*`,
          `${TABLE.USERS}.email as user_email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.CATEGORIES}.name as category_name`,
          `${TABLE.SCHOOLS}.name as school_name`
        )
        .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
        .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
        .leftJoin(TABLE.SCHOOLS, `${TABLE.ACTIVITIES}.school_id`, `${TABLE.SCHOOLS}.id`)
        .where(function() {
          this.where(`${TABLE.USERS}.is_deleted`, false).orWhereNull(`${TABLE.USERS}.id`);
        });

      if (!isGlobalAdmin && userSchoolId) {
        query = query.where(`${TABLE.ACTIVITIES}.school_id`, userSchoolId);
      }

      const activities = await query
        .orderBy(`${TABLE.ACTIVITIES}.created_at`, "desc")
        .limit(recordLimit);

      // Parse photos JSON and add base URL
      activities.forEach((activity: ActivityRow) => {
        if (activity.photos) {
          try {
            const photos = typeof activity.photos === "string"
              ? JSON.parse(activity.photos)
              : activity.photos;
            activity.photos = photos.map((photo: string) =>
              photo.startsWith("http") ? photo : process.env.BASE_URL + photo
            );
          } catch (e) {
            activity.photos = [];
          }
        }
      });

      sendResponse(res, 200, "Recent activities fetched successfully", true, activities);
      return;
    } catch (error: unknown) {
      console.error("Error fetching recent activities:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getTopStudents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const userSchoolId = req.user?.school_id;
      const { limit } = req.query;

      const recordLimit = parseInt(limit as string) || 10;

      const isGlobalAdmin = requesterRole === UserRole.SUPER_ADMIN;

      let query = db(TABLE.STUDENTS)
        .select(
          `${TABLE.STUDENTS}.*`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.avatar_url`,
          `${TABLE.SCHOOLS}.name as school_name`,
          `${TABLE.SECTIONS}.name as section_name`,
          `${TABLE.CLASSES}.name as class_name`
        )
        .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
        .where(`${TABLE.USERS}.is_deleted`, false)
        .join(TABLE.SCHOOLS, `${TABLE.STUDENTS}.school_id`, `${TABLE.SCHOOLS}.id`)
        .join(TABLE.SECTIONS, `${TABLE.STUDENTS}.section_id`, `${TABLE.SECTIONS}.id`)
        .join(TABLE.CLASSES, `${TABLE.STUDENTS}.class_id`, `${TABLE.CLASSES}.id`);

      if (!isGlobalAdmin && userSchoolId) {
        query = query.where(`${TABLE.STUDENTS}.school_id`, userSchoolId);
      }

      const students = await query
        .orderBy(`${TABLE.STUDENTS}.total_points`, "desc")
        .limit(recordLimit);

      // Add base URL to avatar
      students.forEach((student: StudentRow) => {
        if (student.avatar_url) {
          student.avatar_url = process.env.BASE_URL + student.avatar_url;
        }
      });

      sendResponse(res, 200, "Top students fetched successfully", true, students);
      return;
    } catch (error: unknown) {
      console.error("Error fetching top students:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

// Get schools progress data for charts (Super Admin only)
// Get monthly growth trends (Super Admin only)
export const getGrowthTrends = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (requesterRole !== UserRole.SUPER_ADMIN) {
        sendResponse(res, 403, "Access denied. Super Admin only.", false);
        return;
      }

      const { months = 6 } = req.query;
      const monthsCount = Math.min(parseInt(months as string) || 6, 12);

      // Generate last N months
      const monthsData = [];
      const now = new Date();

      for (let i = monthsCount - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        monthsData.push({
          month: date.toLocaleString("default", { month: "short" }),
          year: date.getFullYear(),
          startDate: startOfMonth,
          endDate: endOfMonth,
        });
      }

      // Get schools registered per month
      const schoolsTrend = await Promise.all(
        monthsData.map(async (m) => {
          const result = await db(TABLE.SCHOOLS)
            .whereBetween("created_at", [m.startDate, m.endDate])
            .count({ count: "*" });
          return {
            month: m.month,
            year: m.year,
            count: parseInt(result[0]?.count as string) || 0,
          };
        })
      );

      // Get students registered per month (use users.created_at since students table doesn't have created_at)
      const studentsTrend = await Promise.all(
        monthsData.map(async (m) => {
          const result = await db(TABLE.USERS)
            .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
            .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
            .where(`${TABLE.USERS}.is_deleted`, false)
            .whereBetween(`${TABLE.USERS}.created_at`, [m.startDate, m.endDate])
            .count({ count: "*" });
          return {
            month: m.month,
            year: m.year,
            count: parseInt(result[0]?.count as string) || 0,
          };
        })
      );

      // Get activities submitted per month
      const activitiesTrend = await Promise.all(
        monthsData.map(async (m) => {
          const result = await db(TABLE.ACTIVITIES)
            .whereBetween("created_at", [m.startDate, m.endDate])
            .count({ count: "*" });
          return {
            month: m.month,
            year: m.year,
            count: parseInt(result[0]?.count as string) || 0,
          };
        })
      );

      // Get teachers registered per month
      const teachersTrend = await Promise.all(
        monthsData.map(async (m) => {
          const result = await db(TABLE.STAFF)
            .join(TABLE.USERS, `${TABLE.STAFF}.user_id`, `${TABLE.USERS}.id`)
            .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
            .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
            .where(`${TABLE.USERS}.is_deleted`, false)
            .whereBetween(`${TABLE.USERS}.created_at`, [m.startDate, m.endDate])
            .count({ count: "*" });
          return {
            month: m.month,
            year: m.year,
            count: parseInt(result[0]?.count as string) || 0,
          };
        })
      );

      // Calculate totals and growth percentage
      const currentMonth = schoolsTrend[schoolsTrend.length - 1]?.count || 0;
      const previousMonth = schoolsTrend[schoolsTrend.length - 2]?.count || 0;
      const schoolsGrowth = previousMonth > 0
        ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
        : 0;

      const currentStudents = studentsTrend[studentsTrend.length - 1]?.count || 0;
      const previousStudents = studentsTrend[studentsTrend.length - 2]?.count || 0;
      const studentsGrowth = previousStudents > 0
        ? Math.round(((currentStudents - previousStudents) / previousStudents) * 100)
        : 0;

      sendResponse(res, 200, "Growth trends fetched successfully", true, {
        schools: {
          trend: schoolsTrend,
          totalThisMonth: currentMonth,
          growthPercent: schoolsGrowth,
        },
        students: {
          trend: studentsTrend,
          totalThisMonth: currentStudents,
          growthPercent: studentsGrowth,
        },
        activities: {
          trend: activitiesTrend,
          totalThisMonth: activitiesTrend[activitiesTrend.length - 1]?.count || 0,
        },
        teachers: {
          trend: teachersTrend,
          totalThisMonth: teachersTrend[teachersTrend.length - 1]?.count || 0,
        },
      });
      return;
    } catch (error: unknown) {
      console.error("Error fetching growth trends:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

// Get weekly activity stats (last 4 weeks)
export const getWeeklyStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;
      const userSchoolId = req.user?.school_id;

      const isGlobalAdmin = requesterRole === UserRole.SUPER_ADMIN;

      const weeksData = [];
      const now = new Date();

      for (let i = 3; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(now.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);

        weeksData.push({
          week: `Week ${4 - i}`,
          startDate: new Date(startDate.setHours(0, 0, 0, 0)),
          endDate: new Date(endDate.setHours(23, 59, 59, 999)),
        });
      }

      const weeklyActivities = await Promise.all(
        weeksData.map(async (w) => {
          let query = db(TABLE.ACTIVITIES)
            .whereBetween("created_at", [w.startDate, w.endDate]);

          if (!isGlobalAdmin && userSchoolId) {
            query = query.where("school_id", userSchoolId);
          }

          const total = await query.clone().count({ count: "*" });
          const approved = await query.clone().where("status", "approved").count({ count: "*" });
          const pending = await query.clone().where("status", "pending").count({ count: "*" });

          return {
            week: w.week,
            total: parseInt(total[0]?.count as string) || 0,
            approved: parseInt(approved[0]?.count as string) || 0,
            pending: parseInt(pending[0]?.count as string) || 0,
          };
        })
      );

      sendResponse(res, 200, "Weekly stats fetched successfully", true, weeklyActivities);
      return;
    } catch (error: unknown) {
      console.error("Error fetching weekly stats:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getSchoolsProgress = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      // Only super admin can access this endpoint
      if (requesterRole !== UserRole.SUPER_ADMIN) {
        sendResponse(res, 403, "Access denied. Super Admin only.", false);
        return;
      }

      // Get all schools with their stats
      const schools = await db(TABLE.SCHOOLS)
        .select(
          `${TABLE.SCHOOLS}.id`,
          `${TABLE.SCHOOLS}.name`,
          `${TABLE.SCHOOLS}.subscription_status`
        )
        .orderBy(`${TABLE.SCHOOLS}.name`, "asc");

      // Get stats for each school
      const schoolsProgress = await Promise.all(
        schools.map(async (school: SchoolRow) => {
          // Students count
          const studentsResult = await db(TABLE.STUDENTS)
            .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
            .where(`${TABLE.STUDENTS}.school_id`, school.id)
            .where(`${TABLE.USERS}.is_deleted`, false)
            .count({ count: "*" });
          const totalStudents = parseInt(studentsResult[0]?.count as string) || 0;

          // Teachers count
          const teachersResult = await db(TABLE.STAFF)
            .join(TABLE.USERS, `${TABLE.STAFF}.user_id`, `${TABLE.USERS}.id`)
            .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
            .where(`${TABLE.STAFF}.school_id`, school.id)
            .where(`${TABLE.ROLES}.name`, UserRole.TEACHER)
            .where(`${TABLE.USERS}.is_deleted`, false)
            .count({ count: "*" });
          const totalTeachers = parseInt(teachersResult[0]?.count as string) || 0;

          // Activities count
          const activitiesResult = await db(TABLE.ACTIVITIES)
            .where("school_id", school.id)
            .count({ count: "*" });
          const totalActivities = parseInt(activitiesResult[0]?.count as string) || 0;

          // Approved activities count
          const approvedResult = await db(TABLE.ACTIVITIES)
            .where("school_id", school.id)
            .where("status", "approved")
            .count({ count: "*" });
          const approvedActivities = parseInt(approvedResult[0]?.count as string) || 0;

          // Total points earned by students
          const pointsResult = await db(TABLE.POINTS_LOG)
            .join(TABLE.STUDENTS, `${TABLE.POINTS_LOG}.user_id`, `${TABLE.STUDENTS}.user_id`)
            .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
            .where(`${TABLE.STUDENTS}.school_id`, school.id)
            .where(`${TABLE.USERS}.is_deleted`, false)
            .sum({ total: `${TABLE.POINTS_LOG}.amount` });
          const totalPoints = parseInt(pointsResult[0]?.total as string) || 0;

          return {
            id: school.id,
            name: school.name,
            students: totalStudents,
            teachers: totalTeachers,
            activities: totalActivities,
            approvedActivities,
            points: totalPoints,
          };
        })
      );

      sendResponse(res, 200, "Schools progress fetched successfully", true, schoolsProgress);
      return;
    } catch (error: unknown) {
      console.error("Error fetching schools progress:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

import { Knex } from "knex";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { ActivityError } from "../utils/errors";
import {
  ActivityFilters,
  ApproveActivityDTO,
  RejectActivityDTO,
  CreateActivityDTO,
  ActivityResponse,
  ActivityWithStatsResponse,
  FeedComment,
  FeedCommentWithUser,
  ReportFeedActivityParams,
  ReportFeedActivityResponse,
  GetReportedActivitiesForTeacherParams,
  GetReportedActivitiesForTeacherResponse,
  ModerateReportedActivityForTeacherParams,
  ModerateReportedActivityForTeacherResponse,
  GetReportedActivityDetailForTeacherParams,
  GetReportedActivityDetailForTeacherResponse,
} from "../dto/activity.dto";
import { PaginationDTO, PaginatedResponse } from "../dto/user.dto";
import { calculateXpFromPoints } from "../utils/helperFunctions/xpHelper";

/** Row returned by COUNT(*) grouped by activity_id */
interface ActivityCountRow {
  activity_id: number;
  count: string;
}

/** Minimal row identifying an activity */
interface ActivityIdRow {
  activity_id: number;
}

/** Accumulator for count-by-activity lookups */
interface CountByActivityMap {
  [activityId: number]: number;
}

/** Raw activity row coming from a Knex join query */
interface RawActivityRow extends Record<string, unknown> {
  id: number;
  photos: unknown;
}

/** Feed item row including feed-specific fields */
interface FeedItemRow extends RawActivityRow {
  feed_id: number;
  feed_created_at: string;
  bio: string | null;
}

/**
 * ActivityService - Handles all activity management business logic
 */
export class ActivityService {
  /* ===================== PUBLIC METHODS ===================== */

  async getAllActivities(
    filters: ActivityFilters,
    pagination: PaginationDTO
  ): Promise<PaginatedResponse<ActivityResponse>> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.baseActivityQuery();

    // Apply filters
    if (filters.status) query = query.where(`${TABLE.ACTIVITIES}.status`, filters.status);
    if (filters.school_id) query = query.where(`${TABLE.ACTIVITIES}.school_id`, filters.school_id);
    if (filters.category_id) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.category_id`, filters.category_id)
          .orWhere(`${TABLE.CHALLENGES}.category_id`, filters.category_id);
      });
    }
    if (filters.user_id) query = query.where(`${TABLE.ACTIVITIES}.user_id`, filters.user_id);
    if (filters.search) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.title`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.ACTIVITIES}.description`, "ilike", `%${filters.search}%`);
      });
    }

    const countQuery = this.buildCountQuery(filters);
    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const activities = await query
      .clone()
      .offset(offset)
      .limit(limit)
      .orderBy(`${TABLE.ACTIVITIES}.created_at`, "desc");

    const formattedActivities = activities.map((activity: RawActivityRow) => this.formatActivityResponse(activity));

    return {
      data: formattedActivities,
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


  async createActivity(
    data: CreateActivityDTO,
    userId: number,
    schoolId: number
  ): Promise<ActivityResponse> {
    const category = await db(TABLE.CATEGORIES).where("id", data.category_id).first();
    if (!category) throw new ActivityError("Invalid category", 400);

    const [newActivity] = await db(TABLE.ACTIVITIES)
      .insert({
        user_id: userId,
        school_id: schoolId,
        category_id: data.category_id,
        title: data.title,
        description: data.description || null,
        photos: data.photos ? JSON.stringify(data.photos) : null,
        status: "pending",
        points: 0,
      })
      .returning("*");

    return this.formatActivityResponse({
      ...newActivity,
      user_email: null,
      first_name: null,
      last_name: null,
      category_name: category.name,
      category_icon: category.icon_url,
      school_name: null,
    });
  }

  async shareActivityToFeed(params: {
    activityId: number;
    userId: number;
    schoolId: number;
    bio?: string | null;
  }): Promise<{
    feed: {
      id: number;
      activity_id: number;
      user_id: number;
      school_id: number;
      created_at: string;
      bio?: string | null;
    };
    activity: ActivityResponse;
  }> {
    const { activityId, userId, schoolId, bio } = params;

    const activity = await db(TABLE.ACTIVITIES)
      .select(
        `${TABLE.ACTIVITIES}.*`,
        `${TABLE.USERS}.email as user_email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.CATEGORIES}.icon_url as category_icon`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CHALLENGES}.title as challenge_title`,
        `${TABLE.CHALLENGES}.description as challenge_description`
      )
      .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ACTIVITIES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.ACTIVITIES}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .leftJoin(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.id`
      )
      .where(`${TABLE.ACTIVITIES}.id`, activityId)
      .first();

    if (!activity) throw new ActivityError("Activity not found", 404);
    if (activity.user_id !== userId) {
      throw new ActivityError("You can only share your own activity", 403);
    }
    if (activity.school_id !== schoolId) {
      throw new ActivityError("Activity does not belong to your school", 403);
    }
    if (activity.status !== "approved") {
      throw new ActivityError("Only approved activities can be shared", 400);
    }

    const existing = await db(TABLE.ACTIVITY_FEED)
      .where("activity_id", activityId)
      .where("user_id", userId)
      .first();
    if (existing) {
      throw new ActivityError("Activity already shared", 400);
    }

    const [feed] = await db(TABLE.ACTIVITY_FEED)
      .insert({
        activity_id: activityId,
        user_id: userId,
        school_id: schoolId,
        bio: bio ?? null,
      })
      .returning("*");

    return {
      feed,
      activity: this.formatActivityResponse(activity),
    };
  }

  async toggleLikeFeedActivity(params: {
    activityId: number;
    userId: number;
    schoolId: number;
  }): Promise<{ liked: boolean; likes_count: number }> {
    const { activityId, userId, schoolId } = params;

    await this.ensureActivityInFeed(activityId, schoolId);

    const existing = await db(TABLE.LIKES)
      .where("activity_id", activityId)
      .where("user_id", userId)
      .first();

    if (existing) {
      await db(TABLE.LIKES)
        .where("activity_id", activityId)
        .where("user_id", userId)
        .del();
    } else {
      await db(TABLE.LIKES).insert({
        activity_id: activityId,
        user_id: userId,
      });
    }

    const likesCount = await this.getLikesCount(activityId);

    return { liked: !existing, likes_count: likesCount };
  }

  async addFeedComment(params: {
    activityId: number;
    userId: number;
    schoolId: number;
    content: string;
  }): Promise<FeedComment> {
    const { activityId, userId, schoolId, content } = params;

    await this.ensureActivityInFeed(activityId, schoolId);

    const [comment] = await db(TABLE.COMMENTS)
      .insert({
        activity_id: activityId,
        user_id: userId,
        content,
      })
      .returning("*");

    return comment;
  }

  async getFeedComments(params: {
    activityId: number;
    schoolId: number;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<FeedCommentWithUser>> {
    const { activityId, schoolId, page = 1, limit = 10 } = params;
    const offset = (page - 1) * limit;

    await this.ensureActivityInFeed(activityId, schoolId);

    const baseQuery = db(TABLE.COMMENTS)
      .select(
        `${TABLE.COMMENTS}.*`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`
      )
      .leftJoin(TABLE.USERS, `${TABLE.COMMENTS}.user_id`, `${TABLE.USERS}.id`)
      .where(`${TABLE.COMMENTS}.activity_id`, activityId);

    const totalCountResult = await db(TABLE.COMMENTS)
      .where(`${TABLE.COMMENTS}.activity_id`, activityId)
      .count({ count: "*" })
      .first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const comments = await baseQuery
      .clone()
      .orderBy(`${TABLE.COMMENTS}.created_at`, "desc")
      .offset(offset)
      .limit(limit);

    return {
      data: comments,
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

  async toggleBookmarkFeedActivity(params: {
    activityId: number;
    userId: number;
    schoolId: number;
  }): Promise<{ bookmarked: boolean }> {
    const { activityId, userId, schoolId } = params;

    await this.ensureActivityInFeed(activityId, schoolId);

    const existing = await db(TABLE.ACTIVITY_BOOKMARKS)
      .where("activity_id", activityId)
      .where("user_id", userId)
      .first();

    if (existing) {
      await db(TABLE.ACTIVITY_BOOKMARKS)
        .where("activity_id", activityId)
        .where("user_id", userId)
        .del();
    } else {
      await db(TABLE.ACTIVITY_BOOKMARKS).insert({
        activity_id: activityId,
        user_id: userId,
      });
    }

    return { bookmarked: !existing };
  }

  async reportFeedActivity(
    params: ReportFeedActivityParams
  ): Promise<ReportFeedActivityResponse> {
    const { activityId, userId, schoolId, reason, description } = params;

    await this.ensureActivityInFeed(activityId, schoolId);

    const activity = await db(TABLE.ACTIVITIES)
      .select("id", "user_id")
      .where("id", activityId)
      .first();

    if (!activity) {
      throw new ActivityError("Activity not found", 404);
    }

    if (Number(activity.user_id) === userId) {
      throw new ActivityError("You cannot report your own activity", 400);
    }

    const existingReport = await db(TABLE.ACTIVITY_REPORTS)
      .where("activity_id", activityId)
      .where("user_id", userId)
      .first();

    if (existingReport) {
      throw new ActivityError("You have already reported this activity", 400);
    }

    const [report] = await db(TABLE.ACTIVITY_REPORTS)
      .insert({
        activity_id: activityId,
        user_id: userId,
        school_id: schoolId,
        reason: reason.trim(),
        description: description?.trim() || null,
      })
      .returning(["id", "activity_id", "reason"]);

    return {
      report_id: Number(report.id),
      activity_id: Number(report.activity_id),
      reason: String(report.reason),
    };
  }

  async getFeedActivities(params: {
    schoolId: number;
    userId: number;
    page?: number;
    limit?: number;
    category_id?: number;
    search?: string;
  }): Promise<
    PaginatedResponse<
      ActivityResponse & {
        feed_id: number;
        feed_created_at: string;
        bio: string | null;
        likes_count: number;
        comments_count: number;
        is_liked: boolean;
        is_bookmarked: boolean;
      }
    >
  > {
    const { schoolId, userId, page = 1, limit = 10, category_id, search } = params;
    const offset = (page - 1) * limit;

    let query = db(TABLE.ACTIVITY_FEED)
      .select(
        `${TABLE.ACTIVITY_FEED}.id as feed_id`,
        `${TABLE.ACTIVITY_FEED}.created_at as feed_created_at`,
        `${TABLE.ACTIVITY_FEED}.bio`,
        `${TABLE.ACTIVITIES}.*`,
        `${TABLE.USERS}.email as user_email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.CATEGORIES}.icon_url as category_icon`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CHALLENGES}.title as challenge_title`,
        `${TABLE.CHALLENGES}.description as challenge_description`
      )
      .join(TABLE.ACTIVITIES, `${TABLE.ACTIVITY_FEED}.activity_id`, `${TABLE.ACTIVITIES}.id`)
      .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ACTIVITIES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.ACTIVITIES}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .leftJoin(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.id`
      )
      .where(`${TABLE.ACTIVITY_FEED}.school_id`, schoolId);

    if (category_id) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.category_id`, category_id)
          .orWhere(`${TABLE.CHALLENGES}.category_id`, category_id);
      });
    }

    if (search) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.title`, "ilike", `%${search}%`)
          .orWhere(`${TABLE.ACTIVITIES}.description`, "ilike", `%${search}%`);
      });
    }

    let countQuery = db(TABLE.ACTIVITY_FEED).where(
      `${TABLE.ACTIVITY_FEED}.school_id`,
      schoolId
    );

    if (category_id || search) {
      countQuery = countQuery.join(
        TABLE.ACTIVITIES,
        `${TABLE.ACTIVITY_FEED}.activity_id`,
        `${TABLE.ACTIVITIES}.id`
      );

      if (category_id) {
        countQuery = countQuery
          .leftJoin(
            TABLE.CHALLENGE_VARIANTS,
            `${TABLE.ACTIVITIES}.challenge_variant_id`,
            `${TABLE.CHALLENGE_VARIANTS}.id`
          )
          .leftJoin(
            TABLE.CHALLENGES,
            `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
            `${TABLE.CHALLENGES}.id`
          )
          .where((builder) => {
            builder
              .where(`${TABLE.ACTIVITIES}.category_id`, category_id)
              .orWhere(`${TABLE.CHALLENGES}.category_id`, category_id);
          });
      }

      if (search) {
        countQuery = countQuery.where((builder) => {
          builder
            .where(`${TABLE.ACTIVITIES}.title`, "ilike", `%${search}%`)
            .orWhere(`${TABLE.ACTIVITIES}.description`, "ilike", `%${search}%`);
        });
      }
    }

    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const feedItems = await query
      .clone()
      .orderBy(`${TABLE.ACTIVITY_FEED}.created_at`, "desc")
      .offset(offset)
      .limit(limit);

    const activityIds = feedItems.map((item: FeedItemRow) => item.id);

    const [likesCounts, commentsCounts, likedRows, bookmarkedRows] = await Promise.all([
      activityIds.length
        ? db(TABLE.LIKES)
            .whereIn("activity_id", activityIds)
            .select("activity_id")
            .count({ count: "*" })
            .groupBy("activity_id")
        : [],
      activityIds.length
        ? db(TABLE.COMMENTS)
            .whereIn("activity_id", activityIds)
            .select("activity_id")
            .count({ count: "*" })
            .groupBy("activity_id")
        : [],
      activityIds.length
        ? db(TABLE.LIKES)
            .whereIn("activity_id", activityIds)
            .where("user_id", userId)
            .select("activity_id")
        : [],
      activityIds.length
        ? db(TABLE.ACTIVITY_BOOKMARKS)
            .whereIn("activity_id", activityIds)
            .where("user_id", userId)
            .select("activity_id")
        : [],
    ]);

    const likesCountByActivity = (likesCounts as ActivityCountRow[]).reduce((acc: CountByActivityMap, row: ActivityCountRow) => {
      acc[row.activity_id] = parseInt(row.count as string) || 0;
      return acc;
    }, {});

    const commentsCountByActivity = (commentsCounts as ActivityCountRow[]).reduce((acc: CountByActivityMap, row: ActivityCountRow) => {
      acc[row.activity_id] = parseInt(row.count as string) || 0;
      return acc;
    }, {});

    const likedSet = new Set((likedRows as ActivityIdRow[]).map((row: ActivityIdRow) => row.activity_id));
    const bookmarkedSet = new Set(
      (bookmarkedRows as ActivityIdRow[]).map((row: ActivityIdRow) => row.activity_id)
    );

    const formatted = feedItems.map((item: FeedItemRow) => {
      const { feed_id, feed_created_at, bio, ...activity } = item;
      const formattedActivity = this.formatActivityResponse(activity);
      return {
        ...formattedActivity,
        feed_id,
        feed_created_at,
        bio: bio ?? null,
        likes_count: likesCountByActivity[activity.id] || 0,
        comments_count: commentsCountByActivity[activity.id] || 0,
        is_liked: likedSet.has(activity.id),
        is_bookmarked: bookmarkedSet.has(activity.id),
      };
    });

    return {
      data: formatted,
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

  async getBookmarkedFeedActivities(params: {
    userId: number;
    schoolId: number;
    page?: number;
    limit?: number;
    category_id?: number;
    search?: string;
  }): Promise<
    PaginatedResponse<
      ActivityResponse & {
        feed_id: number;
        feed_created_at: string;
        bio: string | null;
        likes_count: number;
        comments_count: number;
        is_liked: boolean;
        is_bookmarked: boolean;
      }
    >
  > {
    const { userId, schoolId, page = 1, limit = 10, category_id, search } = params;
    const offset = (page - 1) * limit;

    let query = db(TABLE.ACTIVITY_BOOKMARKS)
      .select(
        `${TABLE.ACTIVITY_FEED}.id as feed_id`,
        `${TABLE.ACTIVITY_FEED}.created_at as feed_created_at`,
        `${TABLE.ACTIVITY_FEED}.bio`,
        `${TABLE.ACTIVITIES}.*`,
        `${TABLE.USERS}.email as user_email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.CATEGORIES}.icon_url as category_icon`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CHALLENGES}.title as challenge_title`,
        `${TABLE.CHALLENGES}.description as challenge_description`
      )
      .join(TABLE.ACTIVITY_FEED, `${TABLE.ACTIVITY_BOOKMARKS}.activity_id`, `${TABLE.ACTIVITY_FEED}.activity_id`)
      .join(TABLE.ACTIVITIES, `${TABLE.ACTIVITY_FEED}.activity_id`, `${TABLE.ACTIVITIES}.id`)
      .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ACTIVITIES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.ACTIVITIES}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .leftJoin(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.id`
      )
      .where(`${TABLE.ACTIVITY_BOOKMARKS}.user_id`, userId)
      .where(`${TABLE.ACTIVITY_FEED}.school_id`, schoolId);

    if (category_id) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.category_id`, category_id)
          .orWhere(`${TABLE.CHALLENGES}.category_id`, category_id);
      });
    }

    if (search) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.title`, "ilike", `%${search}%`)
          .orWhere(`${TABLE.ACTIVITIES}.description`, "ilike", `%${search}%`);
      });
    }

    let countQuery = db(TABLE.ACTIVITY_BOOKMARKS)
      .join(
        TABLE.ACTIVITY_FEED,
        `${TABLE.ACTIVITY_BOOKMARKS}.activity_id`,
        `${TABLE.ACTIVITY_FEED}.activity_id`
      )
      .where(`${TABLE.ACTIVITY_BOOKMARKS}.user_id`, userId)
      .where(`${TABLE.ACTIVITY_FEED}.school_id`, schoolId);

    if (category_id || search) {
      countQuery = countQuery.join(
        TABLE.ACTIVITIES,
        `${TABLE.ACTIVITY_FEED}.activity_id`,
        `${TABLE.ACTIVITIES}.id`
      );

      if (category_id) {
        countQuery = countQuery
          .leftJoin(
            TABLE.CHALLENGE_VARIANTS,
            `${TABLE.ACTIVITIES}.challenge_variant_id`,
            `${TABLE.CHALLENGE_VARIANTS}.id`
          )
          .leftJoin(
            TABLE.CHALLENGES,
            `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
            `${TABLE.CHALLENGES}.id`
          )
          .where((builder) => {
            builder
              .where(`${TABLE.ACTIVITIES}.category_id`, category_id)
              .orWhere(`${TABLE.CHALLENGES}.category_id`, category_id);
          });
      }

      if (search) {
        countQuery = countQuery.where((builder) => {
          builder
            .where(`${TABLE.ACTIVITIES}.title`, "ilike", `%${search}%`)
            .orWhere(`${TABLE.ACTIVITIES}.description`, "ilike", `%${search}%`);
        });
      }
    }

    const totalCountResult = await countQuery.count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const items = await query
      .clone()
      .orderBy(`${TABLE.ACTIVITY_BOOKMARKS}.created_at`, "desc")
      .offset(offset)
      .limit(limit);

    const activityIds = items.map((item: FeedItemRow) => item.id);

    const [likesCounts, commentsCounts, likedRows] = await Promise.all([
      activityIds.length
        ? db(TABLE.LIKES)
            .whereIn("activity_id", activityIds)
            .select("activity_id")
            .count({ count: "*" })
            .groupBy("activity_id")
        : [],
      activityIds.length
        ? db(TABLE.COMMENTS)
            .whereIn("activity_id", activityIds)
            .select("activity_id")
            .count({ count: "*" })
            .groupBy("activity_id")
        : [],
      activityIds.length
        ? db(TABLE.LIKES)
            .whereIn("activity_id", activityIds)
            .where("user_id", userId)
            .select("activity_id")
        : [],
    ]);

    const likesCountByActivity = (likesCounts as ActivityCountRow[]).reduce((acc: CountByActivityMap, row: ActivityCountRow) => {
      acc[row.activity_id] = parseInt(row.count as string) || 0;
      return acc;
    }, {});

    const commentsCountByActivity = (commentsCounts as ActivityCountRow[]).reduce((acc: CountByActivityMap, row: ActivityCountRow) => {
      acc[row.activity_id] = parseInt(row.count as string) || 0;
      return acc;
    }, {});

    const likedSet = new Set((likedRows as ActivityIdRow[]).map((row: ActivityIdRow) => row.activity_id));

    const formatted = items.map((item: FeedItemRow) => {
      const { feed_id, feed_created_at, bio, ...activity } = item;
      const formattedActivity = this.formatActivityResponse(activity);
      return {
        ...formattedActivity,
        feed_id,
        feed_created_at,
        bio: bio ?? null,
        likes_count: likesCountByActivity[activity.id] || 0,
        comments_count: commentsCountByActivity[activity.id] || 0,
        is_liked: likedSet.has(activity.id),
        is_bookmarked: true,
      };
    });

    return {
      data: formatted,
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

  async getReportedActivitiesForTeacher(
    params: GetReportedActivitiesForTeacherParams
  ): Promise<GetReportedActivitiesForTeacherResponse> {
    const {
      schoolId,
      page = 1,
      limit = 10,
      status = "pending",
      type = "all",
      priority,
    } = params;
    const offset = (page - 1) * limit;

    if (type !== "all" && type !== "activity") {
      return {
        stats: {
          ai_flagged: 0,
          user_reported: 0,
          high_priority: 0,
          pending: 0,
          reviewed: 0,
        },
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          limit,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
      };
    }

    // Current scope has only user-reported activity items. Reviewed workflow can be added later.
    if (status === "reviewed") {
      const totalReportsResult = await db(TABLE.ACTIVITY_REPORTS)
        .where("school_id", schoolId)
        .count({ count: "*" })
        .first();
      const totalReports = parseInt(totalReportsResult?.count as string) || 0;

      const highPriorityRows = await db(TABLE.ACTIVITY_REPORTS)
        .where("school_id", schoolId)
        .select("activity_id")
        .groupBy("activity_id")
        .havingRaw("COUNT(*) >= 3");

      return {
        stats: {
          ai_flagged: 0,
          user_reported: totalReports,
          high_priority: highPriorityRows.length,
          pending: await db(TABLE.ACTIVITY_REPORTS)
            .where("school_id", schoolId)
            .countDistinct({ count: "activity_id" })
            .first()
            .then((r: any) => parseInt(r?.count as string) || 0),
          reviewed: 0,
        },
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          limit,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
      };
    }

    let summaryQuery = db(TABLE.ACTIVITY_REPORTS)
      .where("school_id", schoolId)
      .select("activity_id")
      .count({ reports_count: "*" })
      .max({ last_reported_at: "created_at" })
      .groupBy("activity_id");

    if (priority === "high") {
      summaryQuery = summaryQuery.havingRaw("COUNT(*) >= 3");
    } else if (priority === "medium") {
      summaryQuery = summaryQuery.havingRaw("COUNT(*) = 2");
    } else if (priority === "low") {
      summaryQuery = summaryQuery.havingRaw("COUNT(*) = 1");
    }

    const summaryRows = await summaryQuery;
    const sortedSummary = summaryRows.sort(
      (a: any, b: any) =>
        new Date(b.last_reported_at || 0).getTime() - new Date(a.last_reported_at || 0).getTime()
    );

    const totalCount = sortedSummary.length;
    const pagedSummary = sortedSummary.slice(offset, offset + limit);
    const activityIds = pagedSummary.map((row: any) => Number(row.activity_id)).filter(Number.isFinite);

    const [activities, reports] = await Promise.all([
      activityIds.length
        ? db(TABLE.ACTIVITIES)
            .select(
              `${TABLE.ACTIVITIES}.id`,
              `${TABLE.ACTIVITIES}.title`,
              `${TABLE.ACTIVITIES}.description`,
              `${TABLE.ACTIVITIES}.created_at`,
              `${TABLE.ACTIVITIES}.user_id`,
              `owner.first_name as owner_first_name`,
              `owner.last_name as owner_last_name`,
              `owner.email as owner_email`
            )
            .leftJoin(`${TABLE.USERS} as owner`, `owner.id`, `${TABLE.ACTIVITIES}.user_id`)
            .whereIn(`${TABLE.ACTIVITIES}.id`, activityIds)
        : Promise.resolve([] as any[]),
      activityIds.length
        ? db(`${TABLE.ACTIVITY_REPORTS} as ar`)
            .select(
              "ar.activity_id",
              "ar.reason",
              "ar.description",
              "ar.created_at",
              "ar.user_id",
              "reporter.first_name as reporter_first_name",
              "reporter.last_name as reporter_last_name",
              "reporter.email as reporter_email"
            )
            .leftJoin(`${TABLE.USERS} as reporter`, "reporter.id", "ar.user_id")
            .whereIn("ar.activity_id", activityIds)
            .orderBy("ar.created_at", "desc")
        : Promise.resolve([] as any[]),
    ]);

    const activityMap = new Map<number, any>(
      activities.map((row: any) => [Number(row.id), row])
    );

    const latestReportByActivity = new Map<number, any>();
    for (const report of reports as any[]) {
      const activityId = Number(report.activity_id);
      if (!latestReportByActivity.has(activityId)) {
        latestReportByActivity.set(activityId, report);
      }
    }

    const data = pagedSummary
      .map((summary: any) => {
        const activityId = Number(summary.activity_id);
        const reportsCount = Number(summary.reports_count) || 0;
        const activity = activityMap.get(activityId);
        const latestReport = latestReportByActivity.get(activityId);

        const itemPriority: "low" | "medium" | "high" =
          reportsCount >= 3 ? "high" : reportsCount === 2 ? "medium" : "low";

        return {
          type: "activity" as const,
          status: "pending" as const,
          priority: itemPriority,
          reports_count: reportsCount,
          activity_id: activityId,
          activity_title: activity?.title || null,
          activity_description: activity?.description || null,
          activity_created_at: activity?.created_at
            ? new Date(activity.created_at).toISOString()
            : null,
          activity_owner: {
            user_id: Number(activity?.user_id) || 0,
            first_name: activity?.owner_first_name || null,
            last_name: activity?.owner_last_name || null,
            email: activity?.owner_email || null,
          },
          latest_report: latestReport
            ? {
                reason: String(latestReport.reason),
                description: latestReport.description || null,
                reported_at: new Date(latestReport.created_at).toISOString(),
                reporter: {
                  user_id: Number(latestReport.user_id) || 0,
                  first_name: latestReport.reporter_first_name || null,
                  last_name: latestReport.reporter_last_name || null,
                  email: latestReport.reporter_email || null,
                },
              }
            : null,
        };
      })
      .filter((item: any) => !!item.activity_id);

    const [totalReportsResult, pendingCountResult, highPriorityRows] = await Promise.all([
      db(TABLE.ACTIVITY_REPORTS)
        .where("school_id", schoolId)
        .count({ count: "*" })
        .first(),
      db(TABLE.ACTIVITY_REPORTS)
        .where("school_id", schoolId)
        .countDistinct({ count: "activity_id" })
        .first(),
      db(TABLE.ACTIVITY_REPORTS)
        .where("school_id", schoolId)
        .select("activity_id")
        .groupBy("activity_id")
        .havingRaw("COUNT(*) >= 3"),
    ]);

    const totalReports = parseInt(totalReportsResult?.count as string) || 0;
    const pendingItems = parseInt((pendingCountResult as any)?.count as string) || 0;

    return {
      stats: {
        ai_flagged: 0,
        user_reported: totalReports,
        high_priority: highPriorityRows.length,
        pending: pendingItems,
        reviewed: 0,
      },
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

  async moderateReportedActivityForTeacher(
    params: ModerateReportedActivityForTeacherParams
  ): Promise<ModerateReportedActivityForTeacherResponse> {
    const { activityId, schoolId, reviewerId, action } = params;

    const activity = await db(TABLE.ACTIVITIES)
      .where("id", activityId)
      .where("school_id", schoolId)
      .first();

    if (!activity) {
      throw new ActivityError("Activity not found in your school", 404);
    }

    const reports = await db(TABLE.ACTIVITY_REPORTS)
      .where("activity_id", activityId)
      .where("school_id", schoolId);

    if (!reports.length) {
      throw new ActivityError("No pending reports found for this activity", 404);
    }

    const reportsCleared = reports.length;

    await db.transaction(async (trx) => {
      const reviewer = await trx(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.ROLES}.name as role`
        )
        .where(`${TABLE.USERS}.id`, reviewerId)
        .first();

      // Resolve reports in both flows
      await trx(TABLE.ACTIVITY_REPORTS)
        .where("activity_id", activityId)
        .where("school_id", schoolId)
        .del();

      if (action === "remove") {
        // Remove from school feed and related engagement records.
        await trx(TABLE.ACTIVITY_FEED)
          .where("activity_id", activityId)
          .where("school_id", schoolId)
          .del();

        await trx(TABLE.LIKES).where("activity_id", activityId).del();
        await trx(TABLE.COMMENTS).where("activity_id", activityId).del();
        await trx(TABLE.ACTIVITY_BOOKMARKS).where("activity_id", activityId).del();
      }

      await trx(TABLE.AUDIT_LOGS).insert({
        user_id: reviewerId,
        user_email: reviewer?.email || null,
        user_role: reviewer?.role || null,
        school_id: schoolId,
        action: action === "approve" ? "APPROVE" : "REMOVE",
        module: "activities",
        resource_id: activityId,
        resource_name: "Reported activity moderation",
        details: JSON.stringify({
          moderation_action: action,
          reports_cleared: reportsCleared,
          note: params.note?.trim() || null,
        }),
        status: "success",
      });
    });

    return {
      activity_id: activityId,
      action,
      reports_cleared: reportsCleared,
    };
  }

  async getReportedActivityDetailForTeacher(
    params: GetReportedActivityDetailForTeacherParams
  ): Promise<GetReportedActivityDetailForTeacherResponse> {
    const { activityId, schoolId } = params;

    const activity = await db(TABLE.ACTIVITIES)
      .select(
        `${TABLE.ACTIVITIES}.id`,
        `${TABLE.ACTIVITIES}.title`,
        `${TABLE.ACTIVITIES}.description`,
        `${TABLE.ACTIVITIES}.created_at`,
        `${TABLE.ACTIVITIES}.user_id`,
        `${TABLE.ACTIVITIES}.status`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.USERS}.email`
      )
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
      .where(`${TABLE.ACTIVITIES}.id`, activityId)
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .first();

    if (!activity) {
      throw new ActivityError("Reported activity not found in your school", 404);
    }

    const reportRows = await db(`${TABLE.ACTIVITY_REPORTS} as ar`)
      .select(
        "ar.id",
        "ar.reason",
        "ar.description",
        "ar.created_at",
        "ar.user_id",
        "reporter.first_name as reporter_first_name",
        "reporter.last_name as reporter_last_name",
        "reporter.email as reporter_email"
      )
      .leftJoin(`${TABLE.USERS} as reporter`, "reporter.id", "ar.user_id")
      .where("ar.activity_id", activityId)
      .where("ar.school_id", schoolId)
      .orderBy("ar.created_at", "desc");

    if (!reportRows.length) {
      throw new ActivityError("No pending reports found for this activity", 404);
    }

    const reasonCounts = new Map<string, number>();
    for (const row of reportRows as any[]) {
      const reason = String(row.reason || "");
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    let topReason: string | null = null;
    let topReasonCount = 0;
    for (const [reason, count] of reasonCounts.entries()) {
      if (count > topReasonCount) {
        topReason = reason;
        topReasonCount = count;
      }
    }

    const reportsCount = reportRows.length;
    const priority: "low" | "medium" | "high" =
      reportsCount >= 3 ? "high" : reportsCount === 2 ? "medium" : "low";

    const reports = (reportRows as any[]).map((row: any) => ({
      id: Number(row.id),
      reason: String(row.reason),
      description: row.description || null,
      created_at: new Date(row.created_at).toISOString(),
      reporter: {
        user_id: Number(row.user_id),
        first_name: row.reporter_first_name || null,
        last_name: row.reporter_last_name || null,
        email: row.reporter_email || null,
      },
    }));

    return {
      activity: {
        id: Number(activity.id),
        title: activity.title || null,
        description: activity.description || null,
        created_at: activity.created_at ? new Date(activity.created_at).toISOString() : null,
        user_id: Number(activity.user_id),
        first_name: activity.first_name || null,
        last_name: activity.last_name || null,
        email: activity.email || null,
        category_name: activity.category_name || null,
        status: activity.status || null,
      },
      moderation: {
        reports_count: reportsCount,
        priority,
        top_reason: topReason,
        latest_reported_at: reports[0]?.created_at || null,
      },
      reports,
    };
  }

  async getActivityById(id: number): Promise<ActivityWithStatsResponse> {
    const activity = await db(TABLE.ACTIVITIES)
      .select(
        `${TABLE.ACTIVITIES}.*`,
        `${TABLE.USERS}.email as user_email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.CATEGORIES}.icon_url as category_icon`,
        `${TABLE.SCHOOLS}.name as school_name`
      )
      .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ACTIVITIES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .where(`${TABLE.ACTIVITIES}.id`, id)
      .first();

    if (!activity) throw new ActivityError("Activity not found", 404);

    const [likesCount, commentsCount] = await Promise.all([
      this.getLikesCount(id),
      this.getCommentsCount(id),
    ]);

    const reviewer = activity.reviewed_by
      ? await this.getReviewerInfo(activity.reviewed_by)
      : null;

    return {
      ...this.formatActivityResponse(activity),
      category_icon: activity.category_icon ? process.env.BASE_URL + activity.category_icon : null,
      likes_count: likesCount,
      comments_count: commentsCount,
      reviewer,
    };
  }

  async approveActivity(
    id: number,
    data: ApproveActivityDTO,
    reviewerId: number,
    requesterRole: string
  ): Promise<{ points: number }> {
    this.checkReviewPermission(requesterRole);

    const activity = await db(TABLE.ACTIVITIES).where("id", id).first();
    if (!activity) throw new ActivityError("Activity not found", 404);
    if (activity.status !== "pending") throw new ActivityError("Only pending activities can be approved", 400);

    const { points } = data;
    const xpEarned = calculateXpFromPoints(points);

    await this.withTransaction(async (trx) => {
      await trx(TABLE.ACTIVITIES)
        .where("id", id)
        .update({
          status: "approved",
          points,
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
        });

      await trx(TABLE.POINTS_LOG).insert({
        user_id: activity.user_id,
        amount: points,
        reason: `Activity approved: ${activity.title || "Untitled"}`,
      });

      await trx(TABLE.STUDENTS)
        .where("user_id", activity.user_id)
        .increment("total_points", points)
        .increment("xp", xpEarned);

      await this.checkLevelProgression(trx, activity.user_id);
    });

    return { points };
  }

  async rejectActivity(
    id: number,
    data: RejectActivityDTO,
    reviewerId: number,
    requesterRole: string
  ): Promise<void> {
    this.checkReviewPermission(requesterRole);

    const activity = await db(TABLE.ACTIVITIES).where("id", id).first();
    if (!activity) throw new ActivityError("Activity not found", 404);
    if (activity.status !== "pending") throw new ActivityError("Only pending activities can be rejected", 400);

    await db(TABLE.ACTIVITIES)
      .where("id", id)
      .update({
        status: "rejected",
        rejection_reason: data.rejection_reason,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
      });
  }

  /**
   * 🔹 New: Review Activity (approve/reject) with single API
   */
  async reviewActivity(
    activityId: number,
    data:
      | { status: "approved"; points?: number }
      | { status: "rejected"; rejection_reason: string },
    reviewerId: number,
    requesterRole: string
  ): Promise<{ points?: number }> {
    this.checkReviewPermission(requesterRole);

    const activity = await db(TABLE.ACTIVITIES).where("id", activityId).first();
    if (!activity) throw new ActivityError("Activity not found", 404);
    if (activity.status !== "pending") throw new ActivityError("Only pending activities can be reviewed", 400);

    if (data.status === "approved") {
      let pointsToAward: number | undefined = data.points;

      if (activity.challenge_activity) {
        if (!activity.challenge_variant_id) {
          throw new ActivityError("Challenge variant is missing for this activity", 400);
        }

        const variant = await db(TABLE.CHALLENGE_VARIANTS)
          .select("points")
          .where("id", activity.challenge_variant_id)
          .first();

        if (!variant) throw new ActivityError("Challenge variant not found", 404);
        if (variant.points === null || variant.points === undefined) {
          throw new ActivityError("Challenge variant points are not set", 400);
        }

        pointsToAward = variant.points;
      }

      if (pointsToAward === undefined) {
        throw new ActivityError("Points are required for approval", 400);
      }

      return await this.approveActivity(activityId, { points: pointsToAward }, reviewerId, requesterRole);
    }

    await this.rejectActivity(activityId, { rejection_reason: data.rejection_reason }, reviewerId, requesterRole);
    return {};
  }

  /* ===================== PRIVATE HELPERS ===================== */

  private async withTransaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return db.transaction((trx) => callback(trx));
  }

  private checkReviewPermission(role: string) {
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUB_ADMIN, UserRole.TEACHER];
    if (!allowedRoles.includes(role as UserRole)) throw new ActivityError("You don't have permission to review activities", 403);
  }

  private async checkLevelProgression(trx: Knex.Transaction, userId: number) {
    const student = await trx(TABLE.STUDENTS).where("user_id", userId).first();
    if (!student) return;

    const nextLevel = await trx(TABLE.LEVELS)
      .where("min_xp", "<=", student.xp)
      .orderBy("min_xp", "desc")
      .first();

    if (nextLevel && nextLevel.id > student.level) {
      await trx(TABLE.STUDENTS).where("user_id", userId).update({ level: nextLevel.id });
    }
  }

  private parsePhotos(photos: unknown): string[] {
    if (!photos) return [];
    try {
      const parsed = typeof photos === "string" ? JSON.parse(photos) : photos;
      const baseUrl = process.env.BASE_URL || "";
      return parsed.map((photo: string) =>
        photo?.startsWith("http") ? photo : `${baseUrl}${photo}`
      );
    } catch (e) {
      return [];
    }
  }

  private formatActivityResponse(activity: RawActivityRow): ActivityResponse {
    return { ...activity, photos: this.parsePhotos(activity.photos) } as ActivityResponse;
  }

  private baseActivityQuery() {
    return db(TABLE.ACTIVITIES)
      .select(
        `${TABLE.ACTIVITIES}.*`,
        `${TABLE.USERS}.email as user_email`,
        `${TABLE.USERS}.first_name`,
        `${TABLE.USERS}.last_name`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CHALLENGES}.title as challenge_title`,
        `${TABLE.CHALLENGES}.description as challenge_description`
      )
      .leftJoin(TABLE.USERS, `${TABLE.ACTIVITIES}.user_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ACTIVITIES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ACTIVITIES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.ACTIVITIES}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .leftJoin(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.id`
      );
  }

  private buildCountQuery(filters: ActivityFilters) {
    let query = db(TABLE.ACTIVITIES);
    if (filters.status) query = query.where(`${TABLE.ACTIVITIES}.status`, filters.status);
    if (filters.school_id) query = query.where(`${TABLE.ACTIVITIES}.school_id`, filters.school_id);
    if (filters.category_id) {
      query = query
        .leftJoin(
          TABLE.CHALLENGE_VARIANTS,
          `${TABLE.ACTIVITIES}.challenge_variant_id`,
          `${TABLE.CHALLENGE_VARIANTS}.id`
        )
        .leftJoin(
          TABLE.CHALLENGES,
          `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
          `${TABLE.CHALLENGES}.id`
        )
        .where((builder) => {
          builder
            .where(`${TABLE.ACTIVITIES}.category_id`, filters.category_id)
            .orWhere(`${TABLE.CHALLENGES}.category_id`, filters.category_id);
        });
    }
    if (filters.user_id) query = query.where(`${TABLE.ACTIVITIES}.user_id`, filters.user_id);
    if (filters.search) {
      query = query.where((builder) => {
        builder
          .where(`${TABLE.ACTIVITIES}.title`, "ilike", `%${filters.search}%`)
          .orWhere(`${TABLE.ACTIVITIES}.description`, "ilike", `%${filters.search}%`);
      });
    }
    return query;
  }

  private async getLikesCount(activityId: number) {
    const result = await db(TABLE.LIKES).where("activity_id", activityId).count({ count: "*" }).first();
    return parseInt(result?.count as string) || 0;
  }

  private async getCommentsCount(activityId: number) {
    const result = await db(TABLE.COMMENTS).where("activity_id", activityId).count({ count: "*" }).first();
    return parseInt(result?.count as string) || 0;
  }

  private async getReviewerInfo(reviewerId: number) {
    return await db(TABLE.USERS).select("id", "email", "first_name", "last_name").where("id", reviewerId).first();
  }

  private async ensureActivityInFeed(activityId: number, schoolId: number) {
    const feed = await db(TABLE.ACTIVITY_FEED)
      .where("activity_id", activityId)
      .where("school_id", schoolId)
      .first();

    if (!feed) {
      throw new ActivityError("Activity not available in feed", 404);
    }
  }
}

export { ActivityError } from "../utils/errors";

/* ===================== SINGLETON EXPORT ===================== */
export const activityService = new ActivityService();

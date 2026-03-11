import db from "../config/db";
import { TABLE } from "../utils/Database/table";

export type TeacherAnalyticsRange = "today" | "this_week" | "this_month" | "all_time";

interface TimeRangeWindow {
  start: Date | null;
  end: Date | null;
  previousStart: Date | null;
  previousEnd: Date | null;
}

interface MetricSummary {
  value: number;
  change_percent: number;
}

interface WeeklyTrendPoint {
  day: string;
  date: string;
  users: number;
  activities: number;
}

interface CategoryBreakdownItem {
  category_id: number;
  category_name: string;
  activities: number;
  percentage: number;
}

interface FeaturedChallenge {
  challenge_id: number;
  title: string;
  participants: number;
  completion_rate: number;
  avg_progress: number;
}

interface EngagementInsights {
  peak_activity_time: string | null;
  most_popular_activity: string | null;
  avg_streak_length: number;
  most_active_class: string | null;
  top_article: string | null;
}

export interface TeacherAnalyticsDashboardResponse {
  range: TeacherAnalyticsRange;
  cards: {
    active_users: MetricSummary;
    activities: MetricSummary;
    points_awarded: MetricSummary;
    completions: MetricSummary;
  };
  weekly_trends: WeeklyTrendPoint[];
  category_breakdown: {
    total_activities: number;
    data: CategoryBreakdownItem[];
  };
  featured_challenge: FeaturedChallenge | null;
  engagement_insights: EngagementInsights;
}

export class TeacherAnalyticsService {
  async getDashboard(
    schoolId: number,
    range: TeacherAnalyticsRange
  ): Promise<TeacherAnalyticsDashboardResponse> {
    const window = this.getTimeRangeWindow(range);

    const [
      activeUsersCurrent,
      activeUsersPrevious,
      activitiesCurrent,
      activitiesPrevious,
      pointsCurrent,
      pointsPrevious,
      completionsCurrent,
      completionsPrevious,
      weeklyTrends,
      categoryBreakdown,
      featuredChallenge,
      engagementInsights,
    ] = await Promise.all([
      this.getActiveUsersCount(schoolId, window.start, window.end),
      this.getActiveUsersCount(schoolId, window.previousStart, window.previousEnd),
      this.getActivitiesCount(schoolId, window.start, window.end),
      this.getActivitiesCount(schoolId, window.previousStart, window.previousEnd),
      this.getPointsAwarded(schoolId, window.start, window.end),
      this.getPointsAwarded(schoolId, window.previousStart, window.previousEnd),
      this.getCompletionsCount(schoolId, window.start, window.end),
      this.getCompletionsCount(schoolId, window.previousStart, window.previousEnd),
      this.getWeeklyTrends(schoolId),
      this.getCategoryBreakdown(schoolId, window.start, window.end),
      this.getFeaturedChallenge(schoolId, window.start, window.end),
      this.getEngagementInsights(schoolId, window.start, window.end),
    ]);

    return {
      range,
      cards: {
        active_users: {
          value: activeUsersCurrent,
          change_percent: this.calculatePercentChange(activeUsersCurrent, activeUsersPrevious),
        },
        activities: {
          value: activitiesCurrent,
          change_percent: this.calculatePercentChange(activitiesCurrent, activitiesPrevious),
        },
        points_awarded: {
          value: pointsCurrent,
          change_percent: this.calculatePercentChange(pointsCurrent, pointsPrevious),
        },
        completions: {
          value: completionsCurrent,
          change_percent: this.calculatePercentChange(completionsCurrent, completionsPrevious),
        },
      },
      weekly_trends: weeklyTrends,
      category_breakdown: categoryBreakdown,
      featured_challenge: featuredChallenge,
      engagement_insights: engagementInsights,
    };
  }

  private getTimeRangeWindow(range: TeacherAnalyticsRange): TimeRangeWindow {
    const now = new Date();
    const todayStartUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const tomorrowStartUtc = new Date(todayStartUtc);
    tomorrowStartUtc.setUTCDate(tomorrowStartUtc.getUTCDate() + 1);

    if (range === "today") {
      const previousStart = new Date(todayStartUtc);
      previousStart.setUTCDate(previousStart.getUTCDate() - 1);
      return {
        start: todayStartUtc,
        end: tomorrowStartUtc,
        previousStart,
        previousEnd: new Date(todayStartUtc),
      };
    }

    if (range === "this_week") {
      // Use rolling 7-day window (today + previous 6 days) for better dashboard continuity.
      const weekStart = new Date(todayStartUtc);
      weekStart.setUTCDate(weekStart.getUTCDate() - 6);
      const weekEnd = new Date(tomorrowStartUtc);

      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
      const previousWeekEnd = new Date(weekStart);

      return {
        start: weekStart,
        end: weekEnd,
        previousStart: previousWeekStart,
        previousEnd: previousWeekEnd,
      };
    }

    if (range === "this_month") {
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
      );
      const nextMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
      );
      const prevMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0)
      );

      return {
        start: monthStart,
        end: nextMonthStart,
        previousStart: prevMonthStart,
        previousEnd: monthStart,
      };
    }

    return {
      start: null,
      end: null,
      previousStart: null,
      previousEnd: null,
    };
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous <= 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  private async getActiveUsersCount(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<number> {
    const query = db(TABLE.ACTIVITIES)
      .where("school_id", schoolId)
      .countDistinct({ count: "user_id" });

    if (start) query.where("created_at", ">=", start);
    if (end) query.where("created_at", "<", end);
    const row = await query.first();
    return Number(row?.count) || 0;
  }

  private async getActivitiesCount(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<number> {
    const query = db(TABLE.ACTIVITIES)
      .where("school_id", schoolId)
      .count({ count: "*" });

    if (start) query.where("created_at", ">=", start);
    if (end) query.where("created_at", "<", end);
    const row = await query.first();
    return Number(row?.count) || 0;
  }

  private async getPointsAwarded(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<number> {
    const query = db(TABLE.POINTS_LOG)
      .join(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.POINTS_LOG}.user_id`)
      .where(`${TABLE.STUDENTS}.school_id`, schoolId)
      .sum({ total: `${TABLE.POINTS_LOG}.amount` });

    if (start) query.where(`${TABLE.POINTS_LOG}.created_at`, ">=", start);
    if (end) query.where(`${TABLE.POINTS_LOG}.created_at`, "<", end);
    const row = await query.first();
    return Number(row?.total) || 0;
  }

  private async getCompletionsCount(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<number> {
    const query = db(TABLE.ACTIVITIES)
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .where(`${TABLE.ACTIVITIES}.status`, "approved")
      .count({ count: "*" });

    if (start) {
      query.whereRaw("COALESCE(??, ??) >= ?", [
        `${TABLE.ACTIVITIES}.reviewed_at`,
        `${TABLE.ACTIVITIES}.created_at`,
        start,
      ]);
    }
    if (end) {
      query.whereRaw("COALESCE(??, ??) < ?", [
        `${TABLE.ACTIVITIES}.reviewed_at`,
        `${TABLE.ACTIVITIES}.created_at`,
        end,
      ]);
    }

    const row = await query.first();
    return Number(row?.count) || 0;
  }

  private async getWeeklyTrends(schoolId: number): Promise<WeeklyTrendPoint[]> {
    const now = new Date();
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const startOfWeekUtc = new Date(startOfTodayUtc);
    startOfWeekUtc.setUTCDate(startOfWeekUtc.getUTCDate() - 6);
    const endOfWeekUtc = new Date(startOfTodayUtc);
    endOfWeekUtc.setUTCDate(endOfWeekUtc.getUTCDate() + 1);

    const rows = await db(TABLE.ACTIVITIES)
      .where("school_id", schoolId)
      .where("created_at", ">=", startOfWeekUtc)
      .where("created_at", "<", endOfWeekUtc)
      .select(
        db.raw(
          `TO_CHAR(DATE_TRUNC('day', ??), 'YYYY-MM-DD') as day`,
          [`${TABLE.ACTIVITIES}.created_at`]
        ),
        db.raw("COUNT(*)::int as activities"),
        db.raw("COUNT(DISTINCT ??)::int as users", [`${TABLE.ACTIVITIES}.user_id`])
      )
      .groupByRaw(`DATE_TRUNC('day', ??)`, [`${TABLE.ACTIVITIES}.created_at`]);

    const dateMap = new Map<string, { users: number; activities: number }>();

    rows.forEach((row: any) => {
      const key = row.day ? String(row.day) : "";
      if (!key) {
        return;
      }
      dateMap.set(key, {
        users: Number(row.users) || 0,
        activities: Number(row.activities) || 0,
      });
    });

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(startOfWeekUtc);
      date.setUTCDate(startOfWeekUtc.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const value = dateMap.get(dateKey);
      const day = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

      return {
        day,
        date: dateKey,
        users: value?.users || 0,
        activities: value?.activities || 0,
      };
    });
  }

  private async getCategoryBreakdown(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<{ total_activities: number; data: CategoryBreakdownItem[] }> {
    const query = db(TABLE.ACTIVITIES)
      .join(TABLE.CATEGORIES, `${TABLE.CATEGORIES}.id`, `${TABLE.ACTIVITIES}.category_id`)
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .select(
        `${TABLE.CATEGORIES}.id as category_id`,
        `${TABLE.CATEGORIES}.name as category_name`
      )
      .count({ activities: `${TABLE.ACTIVITIES}.id` })
      .groupBy(`${TABLE.CATEGORIES}.id`, `${TABLE.CATEGORIES}.name`)
      .orderBy("activities", "desc");

    if (start) query.where(`${TABLE.ACTIVITIES}.created_at`, ">=", start);
    if (end) query.where(`${TABLE.ACTIVITIES}.created_at`, "<", end);
    const rows = await query;

    const totalActivities = (rows as any[]).reduce(
      (sum, row) => sum + (Number(row.activities) || 0),
      0
    );

    return {
      total_activities: totalActivities,
      data: (rows as any[]).map((row) => {
        const activities = Number(row.activities) || 0;
        return {
          category_id: Number(row.category_id),
          category_name: row.category_name,
          activities,
          percentage:
            totalActivities > 0 ? Math.round((activities / totalActivities) * 10000) / 100 : 0,
        };
      }),
    };
  }

  private async getFeaturedChallenge(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<FeaturedChallenge | null> {
    const candidateQuery = db(TABLE.ACTIVITIES)
      .join(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.CHALLENGE_VARIANTS}.id`,
        `${TABLE.ACTIVITIES}.challenge_variant_id`
      )
      .join(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGES}.id`,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`
      )
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .where(`${TABLE.ACTIVITIES}.challenge_activity`, true)
      .select(
        `${TABLE.CHALLENGES}.id as challenge_id`,
        `${TABLE.CHALLENGES}.title as challenge_title`
      )
      .countDistinct({ participants: `${TABLE.ACTIVITIES}.user_id` })
      .count({ submissions: `${TABLE.ACTIVITIES}.id` })
      .groupBy(`${TABLE.CHALLENGES}.id`, `${TABLE.CHALLENGES}.title`)
      .orderBy("participants", "desc")
      .orderBy("submissions", "desc")
      .first();

    if (start) candidateQuery.where(`${TABLE.ACTIVITIES}.created_at`, ">=", start);
    if (end) candidateQuery.where(`${TABLE.ACTIVITIES}.created_at`, "<", end);
    const candidate = (await candidateQuery) as
      | {
          challenge_id?: number | string;
          challenge_title?: string;
          participants?: number | string;
          submissions?: number | string;
        }
      | undefined;

    if (!candidate?.challenge_id) {
      return null;
    }

    const challengeId = Number(candidate.challenge_id);
    const progressStats = await db(TABLE.CHALLENGE_PROGRESS)
      .join(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.CHALLENGE_VARIANTS}.id`,
        `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`
      )
      .join(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.CHALLENGE_PROGRESS}.user_id`)
      .where(`${TABLE.CHALLENGE_VARIANTS}.challenge_id`, challengeId)
      .where(`${TABLE.STUDENTS}.school_id`, schoolId)
      .select(
        db.raw(`COUNT(DISTINCT ??)::int as participants`, [`${TABLE.CHALLENGE_PROGRESS}.user_id`]),
        db.raw(
          `COUNT(DISTINCT CASE WHEN ?? = 'completed' THEN ?? END)::int as completed`,
          [`${TABLE.CHALLENGE_PROGRESS}.status`, `${TABLE.CHALLENGE_PROGRESS}.user_id`]
        ),
        db.raw(
          `COALESCE(AVG(CASE
              WHEN ?? IS NOT NULL AND ?? > 0
                THEN LEAST((COALESCE(??, 0)::numeric / ??::numeric) * 100, 100)
              ELSE NULL
            END), 0)::float as avg_progress`,
          [
            `${TABLE.CHALLENGE_VARIANTS}.target_count`,
            `${TABLE.CHALLENGE_VARIANTS}.target_count`,
            `${TABLE.CHALLENGE_PROGRESS}.current_count`,
            `${TABLE.CHALLENGE_VARIANTS}.target_count`,
          ]
        )
      )
      .first();

    const participants =
      Number(progressStats?.participants) || Number(candidate.participants) || 0;
    const completed = Number(progressStats?.completed) || 0;
    const completionRate =
      participants > 0 ? Math.round((completed / participants) * 10000) / 100 : 0;

    return {
      challenge_id: challengeId,
      title: candidate.challenge_title || "Challenge",
      participants,
      completion_rate: completionRate,
      avg_progress: Math.round((Number(progressStats?.avg_progress) || 0) * 100) / 100,
    };
  }

  private async getEngagementInsights(
    schoolId: number,
    start: Date | null,
    end: Date | null
  ): Promise<EngagementInsights> {
    const peakTimeQuery = db(TABLE.ACTIVITIES)
      .where("school_id", schoolId)
      .select(db.raw(`EXTRACT(HOUR FROM ??)::int as hour`, ["created_at"]))
      .count({ count: "*" })
      .groupByRaw(`EXTRACT(HOUR FROM ??)`, ["created_at"])
      .orderBy("count", "desc")
      .first();

    if (start) peakTimeQuery.where("created_at", ">=", start);
    if (end) peakTimeQuery.where("created_at", "<", end);

    const popularActivityQuery = db(TABLE.ACTIVITIES)
      .leftJoin(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.CHALLENGE_VARIANTS}.id`,
        `${TABLE.ACTIVITIES}.challenge_variant_id`
      )
      .leftJoin(
        TABLE.CHALLENGES,
        `${TABLE.CHALLENGES}.id`,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`
      )
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .select(
        db.raw(
          `COALESCE(NULLIF(TRIM(??), ''), NULLIF(TRIM(??), ''), 'Activity') as activity_title`,
          [`${TABLE.ACTIVITIES}.title`, `${TABLE.CHALLENGES}.title`]
        )
      )
      .count({ count: `${TABLE.ACTIVITIES}.id` })
      .groupByRaw(
        `COALESCE(NULLIF(TRIM(??), ''), NULLIF(TRIM(??), ''), 'Activity')`,
        [`${TABLE.ACTIVITIES}.title`, `${TABLE.CHALLENGES}.title`]
      )
      .orderBy("count", "desc")
      .first();

    if (start) popularActivityQuery.where(`${TABLE.ACTIVITIES}.created_at`, ">=", start);
    if (end) popularActivityQuery.where(`${TABLE.ACTIVITIES}.created_at`, "<", end);

    const mostActiveClassQuery = db(TABLE.ACTIVITIES)
      .join(TABLE.STUDENTS, `${TABLE.STUDENTS}.user_id`, `${TABLE.ACTIVITIES}.user_id`)
      .leftJoin(TABLE.CLASSES, `${TABLE.CLASSES}.id`, `${TABLE.STUDENTS}.class_id`)
      .leftJoin(TABLE.SECTIONS, `${TABLE.SECTIONS}.id`, `${TABLE.STUDENTS}.section_id`)
      .where(`${TABLE.ACTIVITIES}.school_id`, schoolId)
      .select(
        `${TABLE.CLASSES}.name as class_name`,
        `${TABLE.SECTIONS}.name as section_name`
      )
      .count({ count: `${TABLE.ACTIVITIES}.id` })
      .groupBy(`${TABLE.CLASSES}.name`, `${TABLE.SECTIONS}.name`)
      .orderBy("count", "desc")
      .first();

    if (start) mostActiveClassQuery.where(`${TABLE.ACTIVITIES}.created_at`, ">=", start);
    if (end) mostActiveClassQuery.where(`${TABLE.ACTIVITIES}.created_at`, "<", end);

    const topArticleQuery = db(TABLE.ARTICLE_VIEWS)
      .join(TABLE.ARTICLES, `${TABLE.ARTICLES}.id`, `${TABLE.ARTICLE_VIEWS}.article_id`)
      .join(TABLE.USERS, `${TABLE.USERS}.id`, `${TABLE.ARTICLE_VIEWS}.user_id`)
      .where(`${TABLE.USERS}.school_id`, schoolId)
      .where(`${TABLE.USERS}.is_deleted`, false)
      .select(`${TABLE.ARTICLES}.title as title`)
      .count({ count: `${TABLE.ARTICLE_VIEWS}.id` })
      .groupBy(`${TABLE.ARTICLES}.title`)
      .orderBy("count", "desc")
      .first();

    if (start) topArticleQuery.where(`${TABLE.ARTICLE_VIEWS}.viewed_at`, ">=", start);
    if (end) topArticleQuery.where(`${TABLE.ARTICLE_VIEWS}.viewed_at`, "<", end);

    const [
      peakHourRowRaw,
      popularActivityRowRaw,
      avgStreakRow,
      mostActiveClassRowRaw,
      topArticleRowRaw,
    ] = await Promise.all([
        peakTimeQuery,
        popularActivityQuery,
        db(TABLE.STUDENTS)
          .where("school_id", schoolId)
          .avg({ avg_streak: "streak_days" })
          .first(),
        mostActiveClassQuery,
        topArticleQuery,
      ]);

    const peakHourRow = peakHourRowRaw as { hour?: number | string } | undefined;
    const popularActivityRow = popularActivityRowRaw as
      | { activity_title?: string }
      | undefined;
    const mostActiveClassRow = mostActiveClassRowRaw as
      | { class_name?: string; section_name?: string }
      | undefined;
    const topArticleRow = topArticleRowRaw as { title?: string } | undefined;

    const peakHour = Number(peakHourRow?.hour);
    const formattedPeakTime = Number.isFinite(peakHour)
      ? this.formatHourRange(peakHour, (peakHour + 2) % 24)
      : null;

    const className = mostActiveClassRow?.class_name || null;
    const sectionName = mostActiveClassRow?.section_name || null;
    const activeClassLabel = [className, sectionName].filter(Boolean).join(" - ") || null;

    return {
      peak_activity_time: formattedPeakTime,
      most_popular_activity: popularActivityRow?.activity_title || null,
      avg_streak_length: Math.round((Number(avgStreakRow?.avg_streak) || 0) * 100) / 100,
      most_active_class: activeClassLabel,
      top_article: topArticleRow?.title || null,
    };
  }

  private formatHourRange(startHour: number, endHour: number): string {
    const formatHour = (hour: number): string => {
      const normalized = ((hour % 24) + 24) % 24;
      const hour12 = normalized % 12 || 12;
      const period = normalized >= 12 ? "PM" : "AM";
      return `${hour12}:00 ${period}`;
    };

    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  }
}

export const teacherAnalyticsService = new TeacherAnalyticsService();

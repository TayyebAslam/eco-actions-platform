import { Knex } from "knex";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { ArticleError } from "../utils/errors";
import { calculateXpFromPoints } from "../utils/helperFunctions/xpHelper";

export class ArticleService {
  private buildStreak(days: string[]) {
    if (!days.length) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const uniqueDays = Array.from(new Set(days)).sort();
    const dayTimes = uniqueDays.map((d) => new Date(d).getTime());

    let best = 1;
    let current = 1;
    for (let i = 1; i < dayTimes.length; i++) {
      const diff = dayTimes[i]! - dayTimes[i - 1]!;
      if (diff === dayMs) {
        current += 1;
      } else if (diff > dayMs) {
        if (current > best) best = current;
        current = 1;
      }
    }
    if (current > best) best = current;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const lastDay = dayTimes[dayTimes.length - 1]!;
    const diffToToday = todayStart - lastDay;
    if (diffToToday > dayMs) {
      current = 0;
    }

    return { currentStreak: current, bestStreak: best };
  }
  private async updateStudentLevel(trx: Knex.Transaction, userId: number) {
    const student = await trx(TABLE.STUDENTS).where("user_id", userId).first();
    if (!student) return;

    const nextLevel = await trx(TABLE.LEVELS)
      .where("min_xp", "<=", student.xp || 0)
      .orderBy("min_xp", "desc")
      .first();

    if (nextLevel && nextLevel.id > student.level) {
      await trx(TABLE.STUDENTS).where("user_id", userId).update({ level: nextLevel.id });
    }
  }

  private async getArticleOrThrow(articleId: number) {
    const article = await db(TABLE.ARTICLES)
      .select(
        `${TABLE.ARTICLES}.*`,
        `${TABLE.USERS}.email as author_email`,
        `${TABLE.USERS}.first_name as author_first_name`,
        `${TABLE.USERS}.last_name as author_last_name`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CATEGORIES}.name as category_name`
      )
      .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .where(`${TABLE.ARTICLES}.id`, articleId)
      .first();

    if (!article) {
      throw new ArticleError("Article not found", 404);
    }

    return article;
  }

  private ensureAccess(article: Record<string, unknown>, schoolId: number) {
    if (article.school_id && article.school_id !== schoolId) {
      throw new ArticleError("You don't have access to this article", 403);
    }
  }

  private async attachCounts(article: Record<string, unknown>) {
    if (article.cover_image) {
      article.cover_image = (process.env.BASE_URL ?? '') + article.cover_image;
    }
    if (article.thumbnail_image && typeof article.thumbnail_image === 'string' && !article.thumbnail_image.startsWith('http')) {
      article.thumbnail_image = (process.env.BASE_URL ?? '') + article.thumbnail_image;
    }

    const viewsCount = await db(TABLE.ARTICLE_VIEWS)
      .where("article_id", article.id as number)
      .count({ count: "*" });

    const bookmarksCount = await db(TABLE.ARTICLE_BOOKMARKS)
      .where("article_id", article.id as number)
      .count({ count: "*" });

    return {
      ...article,
      views_count: parseInt(viewsCount[0]?.count as string) || 0,
      bookmarks_count: parseInt(bookmarksCount[0]?.count as string) || 0,
    };
  }

  async addViewAndGetArticle(params: {
    articleId: number;
    userId: number;
    schoolId: number;
  }) {
    const { articleId, userId, schoolId } = params;

    const article = await this.getArticleOrThrow(articleId);
    this.ensureAccess(article, schoolId);

    const existingView = await db(TABLE.ARTICLE_VIEWS)
      .where({ user_id: userId, article_id: articleId })
      .first();

    if (!existingView) {
      await db(TABLE.ARTICLE_VIEWS).insert({
        user_id: userId,
        article_id: articleId,
      });
    }

    return this.attachCounts(article);
  }

  async markReadAndAwardPoints(params: {
    articleId: number;
    userId: number;
    schoolId: number;
  }) {
    const { articleId, userId, schoolId } = params;

    const article = await this.getArticleOrThrow(articleId);
    this.ensureAccess(article, schoolId);

    const existingRead = await db(TABLE.ARTICLE_READS)
      .where({ user_id: userId, article_id: articleId })
      .first();

    if (existingRead) {
      return {
        alreadyRead: true,
        pointsAwarded: 0,
        article: await this.attachCounts(article),
      };
    }

    const pointsAwarded = article.points ? Number(article.points) : 0;
    const xpEarned = calculateXpFromPoints(pointsAwarded);

    await db.transaction(async (trx) => {
      await trx(TABLE.ARTICLE_READS).insert({
        user_id: userId,
        article_id: articleId,
      });

      if (pointsAwarded > 0) {
        await trx(TABLE.POINTS_LOG).insert({
          user_id: userId,
          amount: pointsAwarded,
          reason: `Article read: ${article.title || "Untitled"}`,
        });

        await trx(TABLE.STUDENTS)
          .where("user_id", userId)
          .increment("total_points", pointsAwarded)
          .increment("xp", xpEarned);

        await this.updateStudentLevel(trx, userId);
      }
    });

    return {
      alreadyRead: false,
      pointsAwarded,
      article: await this.attachCounts(article),
    };
  }

  async toggleBookmark(params: {
    articleId: number;
    userId: number;
    schoolId: number;
  }) {
    const { articleId, userId, schoolId } = params;

    const article = await this.getArticleOrThrow(articleId);
    this.ensureAccess(article, schoolId);

    const existingBookmark = await db(TABLE.ARTICLE_BOOKMARKS)
      .where({ user_id: userId, article_id: articleId })
      .first();

    if (existingBookmark) {
      await db(TABLE.ARTICLE_BOOKMARKS)
        .where({ user_id: userId, article_id: articleId })
        .del();
      return { bookmarked: false };
    }

    await db(TABLE.ARTICLE_BOOKMARKS).insert({
      user_id: userId,
      article_id: articleId,
    });

    return { bookmarked: true };
  }

  async getBookmarkedArticles(params: {
    userId: number;
    schoolId: number;
    page?: number;
    limit?: number;
  }) {
    const { userId, schoolId, page = 1, limit = 10 } = params;
    const offset = (page - 1) * limit;

    const baseQuery = db(TABLE.ARTICLE_BOOKMARKS)
      .join(TABLE.ARTICLES, `${TABLE.ARTICLE_BOOKMARKS}.article_id`, `${TABLE.ARTICLES}.id`)
      .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .where(`${TABLE.ARTICLE_BOOKMARKS}.user_id`, userId)
      .andWhere((builder) => {
        builder
          .where(`${TABLE.ARTICLES}.school_id`, schoolId)
          .orWhereNull(`${TABLE.ARTICLES}.school_id`);
      });

    const totalCountResult = await baseQuery.clone().count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const articles = await baseQuery
      .clone()
      .select(
        `${TABLE.ARTICLES}.*`,
        `${TABLE.USERS}.email as author_email`,
        `${TABLE.USERS}.first_name as author_first_name`,
        `${TABLE.USERS}.last_name as author_last_name`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CATEGORIES}.name as category_name`
      )
      .orderBy(`${TABLE.ARTICLE_BOOKMARKS}.created_at`, "desc")
      .offset(offset)
      .limit(limit);

    const withCounts = [];
    for (const article of articles) {
      withCounts.push(await this.attachCounts(article));
    }

    return {
      data: withCounts,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getArticleForStudent(params: { articleId: number; schoolId: number }) {
    const { articleId, schoolId } = params;

    const article = await this.getArticleOrThrow(articleId);
    this.ensureAccess(article, schoolId);

    return this.attachCounts(article);
  }

  async getAllArticlesForStudent(params: {
    schoolId: number;
    page?: number;
    limit?: number;
    search?: string;
    category_id?: number;
  }) {
    const { schoolId, page = 1, limit = 10, search, category_id } = params;
    const offset = (page - 1) * limit;

    let query = db(TABLE.ARTICLES)
      .select(
        `${TABLE.ARTICLES}.*`,
        `${TABLE.USERS}.email as author_email`,
        `${TABLE.USERS}.first_name as author_first_name`,
        `${TABLE.USERS}.last_name as author_last_name`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CATEGORIES}.name as category_name`
      )
      .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .where((builder) => {
        builder
          .where(`${TABLE.ARTICLES}.school_id`, schoolId)
          .orWhereNull(`${TABLE.ARTICLES}.school_id`);
      });

    if (Number.isFinite(category_id)) {
      query = query.andWhere(`${TABLE.ARTICLES}.category_id`, category_id as number);
    }

    if (search) {
      query = query.andWhere((builder) => {
        builder
          .where(`${TABLE.ARTICLES}.title`, "ilike", `%${search}%`)
          .orWhere(`${TABLE.ARTICLES}.content`, "ilike", `%${search}%`);
      });
    }

    const totalCountResult = await query.clone().clearSelect().count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const articles = await query
      .clone()
      .orderBy(`${TABLE.ARTICLES}.id`, "desc")
      .offset(offset)
      .limit(limit);

    const withCounts = [];
    for (const article of articles) {
      withCounts.push(await this.attachCounts(article));
    }

    return {
      data: withCounts,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getReadHistoryForStudent(params: {
    userId: number;
    schoolId: number;
    page?: number;
    limit?: number;
  }) {
    const { userId, schoolId, page = 1, limit = 10 } = params;
    const offset = (page - 1) * limit;

    let query = db(TABLE.ARTICLE_READS)
      .select(
        `${TABLE.ARTICLE_READS}.read_at`,
        `${TABLE.ARTICLES}.*`,
        `${TABLE.USERS}.email as author_email`,
        `${TABLE.USERS}.first_name as author_first_name`,
        `${TABLE.USERS}.last_name as author_last_name`,
        `${TABLE.SCHOOLS}.name as school_name`,
        `${TABLE.CATEGORIES}.name as category_name`
      )
      .join(TABLE.ARTICLES, `${TABLE.ARTICLE_READS}.article_id`, `${TABLE.ARTICLES}.id`)
      .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
      .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
      .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`)
      .where(`${TABLE.ARTICLE_READS}.user_id`, userId)
      .andWhere((builder) => {
        builder
          .where(`${TABLE.ARTICLES}.school_id`, schoolId)
          .orWhereNull(`${TABLE.ARTICLES}.school_id`);
      });

    const totalCountResult = await query.clone().clearSelect().count({ count: "*" }).first();
    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    const rows = await query
      .clone()
      .orderBy(`${TABLE.ARTICLE_READS}.read_at`, "desc")
      .offset(offset)
      .limit(limit);

    const withCounts = [];
    for (const row of rows) {
      const { read_at, ...article } = row as Record<string, unknown>;
      const articleWithCounts = await this.attachCounts(article);
      withCounts.push({ ...articleWithCounts, read_at });
    }

    return {
      data: withCounts,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getRecommendedArticlesForStudent(params: {
    userId: number;
    schoolId: number;
    page?: number;
    limit?: number;
  }) {
    const { userId, schoolId, page = 1, limit = 10 } = params;
    const offset = (page - 1) * limit;

    const categoryRows = (await db(TABLE.ARTICLE_READS)
      .join(TABLE.ARTICLES, `${TABLE.ARTICLE_READS}.article_id`, `${TABLE.ARTICLES}.id`)
      .where(`${TABLE.ARTICLE_READS}.user_id`, userId)
      .whereNotNull(`${TABLE.ARTICLES}.category_id`)
      .groupBy(`${TABLE.ARTICLES}.category_id`)
      .select(`${TABLE.ARTICLES}.category_id`)
      .count({ read_count: "*" })
      .orderBy("read_count", "desc")) as Record<string, unknown>[];

    const categories = categoryRows
      .map((row) => ({
        category_id: Number(row.category_id),
        read_count: Number(row.read_count) || 0,
      }))
      .filter((row) => Number.isFinite(row.category_id) && row.read_count > 0);

    if (categories.length === 0) {
      return {
        data: [],
        page,
        limit,
        totalCount: 0,
        totalPages: 0,
      };
    }

    const articlesByCategory = new Map<number, Record<string, unknown>[]>();
    const baseLimitPerCategory = Math.max(limit, 4);

    for (const category of categories) {
      const rows = await db(TABLE.ARTICLES)
        .select(
          `${TABLE.ARTICLES}.*`,
          `${TABLE.USERS}.email as author_email`,
          `${TABLE.USERS}.first_name as author_first_name`,
          `${TABLE.USERS}.last_name as author_last_name`,
          `${TABLE.SCHOOLS}.name as school_name`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .leftJoin(TABLE.USERS, `${TABLE.ARTICLES}.author_id`, `${TABLE.USERS}.id`)
        .leftJoin(TABLE.SCHOOLS, `${TABLE.ARTICLES}.school_id`, `${TABLE.SCHOOLS}.id`)
        .leftJoin(TABLE.CATEGORIES, `${TABLE.ARTICLES}.category_id`, `${TABLE.CATEGORIES}.id`)
        .leftJoin(
          TABLE.ARTICLE_READS,
          (join) => {
            join
              .on(`${TABLE.ARTICLE_READS}.article_id`, "=", `${TABLE.ARTICLES}.id`)
              .andOn(`${TABLE.ARTICLE_READS}.user_id`, "=", db.raw("?", [userId]));
          }
        )
        .where((builder) => {
          builder
            .where(`${TABLE.ARTICLES}.school_id`, schoolId)
            .orWhereNull(`${TABLE.ARTICLES}.school_id`);
        })
        .whereNull(`${TABLE.ARTICLE_READS}.id`)
        .where(`${TABLE.ARTICLES}.category_id`, category.category_id)
        .orderBy(`${TABLE.ARTICLES}.id`, "desc")
        .limit(baseLimitPerCategory);

      if (rows.length > 0) {
        articlesByCategory.set(category.category_id, rows);
      }
    }

    const pickedCountByCategory = new Map<number, number>();
    const pickedArticles: Record<string, unknown>[] = [];

    while (pickedArticles.length < limit && articlesByCategory.size > 0) {
      let bestCategory: { category_id: number; read_count: number } | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const category of categories) {
        const list = articlesByCategory.get(category.category_id);
        if (!list || list.length === 0) continue;

        const picked = pickedCountByCategory.get(category.category_id) || 0;
        const score = picked / category.read_count;
        if (score < bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }

      if (!bestCategory) break;

      const list = articlesByCategory.get(bestCategory.category_id) || [];
      const next = list.shift();
      if (!next) {
        articlesByCategory.delete(bestCategory.category_id);
        continue;
      }

      pickedArticles.push(next);
      pickedCountByCategory.set(
        bestCategory.category_id,
        (pickedCountByCategory.get(bestCategory.category_id) || 0) + 1
      );
    }

    const withCounts = [];
    for (const article of pickedArticles) {
      withCounts.push(await this.attachCounts(article));
    }

    return {
      data: withCounts,
      page,
      limit,
      totalCount: withCounts.length,
      totalPages: 1,
    };
  }

  async getArticleDashboardForStudent(params: { userId: number; schoolId: number }) {
    const { userId, schoolId } = params;

    const totalArticlesResult = await db(TABLE.ARTICLES)
      .where(`${TABLE.ARTICLES}.school_id`, schoolId)
      .count({ count: "*" })
      .first();
    const totalArticles = parseInt(totalArticlesResult?.count as string) || 0;

    const readRows = await db(TABLE.ARTICLE_READS)
      .join(TABLE.ARTICLES, `${TABLE.ARTICLE_READS}.article_id`, `${TABLE.ARTICLES}.id`)
      .where(`${TABLE.ARTICLE_READS}.user_id`, userId)
      .andWhere(`${TABLE.ARTICLES}.school_id`, schoolId)
      .select(
        `${TABLE.ARTICLE_READS}.read_at`,
        `${TABLE.ARTICLES}.points`
      );

    const readCount = readRows.length;
    const pointsEarned = readRows.reduce(
      (acc: number, row: { points: number | string }) => acc + (Number(row.points) || 0),
      0
    );

    const dayStrings = readRows.map((row: { read_at: string }) =>
      new Date(row.read_at).toISOString().slice(0, 10)
    );
    const { currentStreak, bestStreak } = this.buildStreak(dayStrings);

    const student = await db(TABLE.STUDENTS).where("user_id", userId).first();
    const totalPoints = Number(student?.total_points) || 0;

    const progressPercent =
      totalArticles > 0 ? Math.round((readCount / totalArticles) * 100) : 0;

    return {
      readCount,
      totalArticles,
      pointsEarned,
      currentStreak,
      bestStreak,
      totalPoints,
      progressPercent,
    };
  }
}

export { ArticleError } from "../utils/errors";

export const articleService = new ArticleService();

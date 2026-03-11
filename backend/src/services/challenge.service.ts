import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { ChallengeError } from "../utils/errors";

/** Row shape for a challenge from the joined query */
interface ChallengeRow extends Record<string, unknown> {
  id: number;
  challenge_type_name: string | null;
  challenge_type_label: string | null;
  category_name: string | null;
  category_icon: string | null;
  variants?: ChallengeVariantRow[];
  is_joined?: boolean;
  my_progress?: Record<string, unknown> | null;
}

/** Row shape for a challenge variant */
interface ChallengeVariantRow {
  id: number;
  challenge_id: number;
  name: string;
  description: string | null;
  target_count: number;
  target_unit: string;
  points: number;
  [key: string]: unknown;
}

/** Row shape for challenge progress */
interface ChallengeProgressRow {
  id: number;
  challenge_variant_id: number;
  user_id: number;
  status: string;
  current_count: number | null;
  completed_at: string | null;
  [key: string]: unknown;
}

/** Accumulator mapping variant IDs to variants grouped by challenge */
interface VariantsByChallengeMap {
  [challengeId: number]: ChallengeVariantRow[];
}

/** Accumulator mapping variant IDs to progress */
interface ProgressByVariantMap {
  [variantId: number]: ChallengeProgressRow;
}

/** Row shape for "my challenges" query result */
interface MyChallengeRow extends Record<string, unknown> {
  id: number;
  challenge_id: number;
  challenge_title: string | null;
  challenge_description: string | null;
  variant_name: string | null;
  variant_description: string | null;
  challenge_type_name: string | null;
  challenge_type_label: string | null;
  category_name: string | null;
  category_icon: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  status: string;
  current_count: number | null;
  target_count: number;
  target_unit: string;
  points: number;
  completed_at: string | null;
}

/** Formatted challenge response for "my challenges" */
interface FormattedMyChallengeResponse {
  progress_id: number;
  challenge_id: number;
  challenge_title: string | null;
  challenge_description: string | null;
  variant_name: string | null;
  variant_description: string | null;
  challenge_type_name: string | null;
  challenge_type_label: string | null;
  category_name: string | null;
  category_icon: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  status: string;
  current_count: number;
  target_count: number;
  target_unit: string;
  points: number;
  completed_at: string | null;
  progress_percentage: number;
}

/** Shape returned by addChallengeProof */
interface ChallengeProofResponse extends Record<string, unknown> {
  photos: string[];
}

export class ChallengeService {
  async getChallengesForStudent(params: {
    userId: number;
    userSchoolId: number | null;
    query: {
      page?: string;
      limit?: string;
      challenge_type_id?: string;
      category_id?: string;
      search?: string;
      difficulty?: string;
      status?: string;
    };
  }): Promise<{
    data: ChallengeRow[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { userId, userSchoolId, query } = params;
    const {
      page,
      limit,
      challenge_type_id,
      category_id,
      search,
      difficulty,
      status,
    } = query;

    const pageNum = parseInt(page as string) || 1;
    const pageLimit = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * pageLimit;

    // Build query for active challenges (student's school + global)
    let challengesQuery = db(TABLE.CHALLENGES)
      .select(
        `${TABLE.CHALLENGES}.*`,
        `${TABLE.CHALLENGE_TYPES}.name as challenge_type_name`,
        `${TABLE.CHALLENGE_TYPES}.label as challenge_type_label`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.CATEGORIES}.icon_url as category_icon`
      )
      .leftJoin(
        TABLE.CHALLENGE_TYPES,
        `${TABLE.CHALLENGES}.challenge_type_id`,
        `${TABLE.CHALLENGE_TYPES}.id`
      )
      .leftJoin(
        TABLE.CATEGORIES,
        `${TABLE.CHALLENGES}.category_id`,
        `${TABLE.CATEGORIES}.id`
      )
      .where(`${TABLE.CHALLENGES}.is_active`, true)
      .where((builder) => {
        builder
          .where(`${TABLE.CHALLENGES}.school_id`, userSchoolId)
          .orWhereNull(`${TABLE.CHALLENGES}.school_id`);
      });

    // Filter by date - only show challenges that haven't ended
    const now = new Date();
    challengesQuery = challengesQuery.where((builder) => {
      builder
        .whereNull(`${TABLE.CHALLENGES}.end_date`)
        .orWhere(`${TABLE.CHALLENGES}.end_date`, ">=", now);
    });

    // Apply filters
    if (challenge_type_id) {
      challengesQuery = challengesQuery.where(
        `${TABLE.CHALLENGES}.challenge_type_id`,
        parseInt(challenge_type_id as string)
      );
    }

    if (category_id) {
      challengesQuery = challengesQuery.where(
        `${TABLE.CHALLENGES}.category_id`,
        parseInt(category_id as string)
      );
    }

    if (difficulty) {
      const normalizedDifficulty = (difficulty as string).toLowerCase();
      challengesQuery = challengesQuery.whereExists(
        db(TABLE.CHALLENGE_VARIANTS)
          .select(db.raw("1"))
          .whereRaw(
            `${TABLE.CHALLENGE_VARIANTS}.challenge_id = ${TABLE.CHALLENGES}.id`
          )
          .whereRaw("lower(??) = ?", [
            `${TABLE.CHALLENGE_VARIANTS}.name`,
            normalizedDifficulty,
          ])
      );
    }

    if (status) {
      const normalizedStatus = (status as string).toLowerCase();
      const completedSubquery = db(TABLE.CHALLENGE_PROGRESS)
        .select(db.raw("1"))
        .join(
          TABLE.CHALLENGE_VARIANTS,
          `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
          `${TABLE.CHALLENGE_VARIANTS}.id`
        )
        .whereRaw(
          `${TABLE.CHALLENGE_VARIANTS}.challenge_id = ${TABLE.CHALLENGES}.id`
        )
        .where(`${TABLE.CHALLENGE_PROGRESS}.user_id`, userId)
        .where(`${TABLE.CHALLENGE_PROGRESS}.status`, "completed");

      if (normalizedStatus === "completed") {
        challengesQuery = challengesQuery.whereExists(completedSubquery);
      } else if (normalizedStatus === "active") {
        challengesQuery = challengesQuery.whereNotExists(completedSubquery);
      }
    }

    if (search) {
      challengesQuery = challengesQuery.where((builder) => {
        builder
          .where(`${TABLE.CHALLENGES}.title`, "ilike", `%${search}%`)
          .orWhere(`${TABLE.CHALLENGES}.description`, "ilike", `%${search}%`);
      });
    }

    // Count query
    let countQuery = db(TABLE.CHALLENGES)
      .where(`${TABLE.CHALLENGES}.is_active`, true)
      .where((builder) => {
        builder
          .where(`${TABLE.CHALLENGES}.school_id`, userSchoolId)
          .orWhereNull(`${TABLE.CHALLENGES}.school_id`);
      })
      .where((builder) => {
        builder
          .whereNull(`${TABLE.CHALLENGES}.end_date`)
          .orWhere(`${TABLE.CHALLENGES}.end_date`, ">=", now);
      });

    if (challenge_type_id) {
      countQuery = countQuery.where(
        "challenge_type_id",
        parseInt(challenge_type_id as string)
      );
    }
    if (category_id) {
      countQuery = countQuery.where("category_id", parseInt(category_id as string));
    }
    if (difficulty) {
      const normalizedDifficulty = (difficulty as string).toLowerCase();
      countQuery = countQuery.whereExists(
        db(TABLE.CHALLENGE_VARIANTS)
          .select(db.raw("1"))
          .whereRaw(
            `${TABLE.CHALLENGE_VARIANTS}.challenge_id = ${TABLE.CHALLENGES}.id`
          )
          .whereRaw("lower(??) = ?", [
            `${TABLE.CHALLENGE_VARIANTS}.name`,
            normalizedDifficulty,
          ])
      );
    }
    if (status) {
      const normalizedStatus = (status as string).toLowerCase();
      const completedSubquery = db(TABLE.CHALLENGE_PROGRESS)
        .select(db.raw("1"))
        .join(
          TABLE.CHALLENGE_VARIANTS,
          `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
          `${TABLE.CHALLENGE_VARIANTS}.id`
        )
        .whereRaw(
          `${TABLE.CHALLENGE_VARIANTS}.challenge_id = ${TABLE.CHALLENGES}.id`
        )
        .where(`${TABLE.CHALLENGE_PROGRESS}.user_id`, userId)
        .where(`${TABLE.CHALLENGE_PROGRESS}.status`, "completed");

      if (normalizedStatus === "completed") {
        countQuery = countQuery.whereExists(completedSubquery);
      } else if (normalizedStatus === "active") {
        countQuery = countQuery.whereNotExists(completedSubquery);
      }
    }
    if (search) {
      countQuery = countQuery.where((builder) => {
        builder
          .where("title", "ilike", `%${search}%`)
          .orWhere("description", "ilike", `%${search}%`);
      });
    }

    // Execute queries
    const [challenges, totalCountResult] = await Promise.all([
      challengesQuery
        .offset(offset)
        .limit(pageLimit)
        .orderBy(`${TABLE.CHALLENGES}.id`, "desc"),
      countQuery.count({ count: "*" }).first(),
    ]);

    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    // Get variants and student's progress for each challenge
    if (challenges.length > 0) {
      const challengeIds = challenges.map((c: ChallengeRow) => c.id);

      // Fetch all variants
      const allVariants = await db(TABLE.CHALLENGE_VARIANTS).whereIn(
        "challenge_id",
        challengeIds
      );

      // Fetch student's progress
      const variantIds = allVariants.map((v: ChallengeVariantRow) => v.id);
      const studentProgress = await db(TABLE.CHALLENGE_PROGRESS)
        .where("user_id", userId)
        .whereIn("challenge_variant_id", variantIds);

      // Create lookup maps
      const variantsByChallenge = allVariants.reduce((acc: VariantsByChallengeMap, variant: ChallengeVariantRow) => {
        if (!acc[variant.challenge_id]) {
          acc[variant.challenge_id] = [];
        }
        acc[variant.challenge_id]!.push(variant);
        return acc;
      }, {});

      const progressByVariant = studentProgress.reduce((acc: ProgressByVariantMap, prog: ChallengeProgressRow) => {
        acc[prog.challenge_variant_id] = prog;
        return acc;
      }, {});

      // Assign variants and progress to challenges
      for (const challenge of challenges) {
        challenge.variants = variantsByChallenge[challenge.id] || [];

        // Check if student has joined any variant
        challenge.is_joined = false;
        challenge.my_progress = null;

        for (const variant of challenge.variants) {
          const progress = progressByVariant[variant.id];
          if (progress) {
            challenge.is_joined = true;
            challenge.my_progress = {
              progress_id: progress.id,
              variant_id: variant.id,
              variant_name: variant.name,
              status: progress.status,
              current_count: progress.current_count || 0,
              target_count: variant.target_count,
              target_unit: variant.target_unit,
              points: variant.points,
              completed_at: progress.completed_at,
            };
            break;
          }
        }

        // Format category icon
        if (challenge.category_icon) {
          challenge.category_icon = process.env.BASE_URL + challenge.category_icon;
        }
      }
    }

    return {
      data: challenges,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      },
    };
  }

  async addChallengeProof(params: {
    progressId: number;
    userId: number;
    schoolId: number;
    photos: string[];
  }): Promise<ChallengeProofResponse> {
    const { progressId, userId, schoolId, photos } = params;

    const progress = await db(TABLE.CHALLENGE_PROGRESS)
      .select(
        `${TABLE.CHALLENGE_PROGRESS}.*`,
        `${TABLE.CHALLENGE_VARIANTS}.name as variant_name`,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`,
        `${TABLE.CHALLENGES}.title as challenge_title`,
        `${TABLE.CHALLENGES}.category_id as challenge_category_id`
      )
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
      .where(`${TABLE.CHALLENGE_PROGRESS}.id`, progressId)
      .first();

    if (!progress) throw new ChallengeError("Progress not found", 404);
    if (progress.user_id !== userId) {
      throw new ChallengeError("You can only add proof to your own progress", 403);
    }
    if (!progress.challenge_category_id) {
      throw new ChallengeError("Challenge category is missing", 400);
    }

    const activityTitle = `Challenge proof: ${progress.challenge_title || "Challenge"}`;
    const activityDescription = progress.variant_name
      ? `Proof for variant: ${progress.variant_name}`
      : null;

    const [newActivity] = await db(TABLE.ACTIVITIES)
      .insert({
        user_id: userId,
        school_id: schoolId,
        category_id: progress.challenge_category_id,
        title: activityTitle,
        description: activityDescription,
        photos: JSON.stringify(photos),
        status: "pending",
        points: 0,
        challenge_activity: true,
        challenge_variant_id: progress.challenge_variant_id,
      })
      .returning("*");

    const responsePhotos = photos.map((photo: string) =>
      photo.startsWith("http") ? photo : process.env.BASE_URL + photo
    );

    return {
      ...newActivity,
      photos: responsePhotos,
    };
  }

  async getMyChallengesForStudent(params: {
    userId: number;
    query: {
      page?: string;
      limit?: string;
      status?: string;
      category_id?: string;
      difficulty?: string;
    };
  }): Promise<{
    data: FormattedMyChallengeResponse[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { userId, query } = params;
    const { page, limit, status, category_id, difficulty } = query;

    const pageNum = parseInt(page as string) || 1;
    const pageLimit = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * pageLimit;

    // Build query
    let challengesQuery = db(TABLE.CHALLENGE_PROGRESS)
      .select(
        `${TABLE.CHALLENGE_PROGRESS}.*`,
        `${TABLE.CHALLENGE_VARIANTS}.name as variant_name`,
        `${TABLE.CHALLENGE_VARIANTS}.description as variant_description`,
        `${TABLE.CHALLENGE_VARIANTS}.target_count`,
        `${TABLE.CHALLENGE_VARIANTS}.target_unit`,
        `${TABLE.CHALLENGE_VARIANTS}.points`,
        `${TABLE.CHALLENGES}.id as challenge_id`,
        `${TABLE.CHALLENGES}.title as challenge_title`,
        `${TABLE.CHALLENGES}.description as challenge_description`,
        `${TABLE.CHALLENGES}.start_date`,
        `${TABLE.CHALLENGES}.end_date`,
        `${TABLE.CHALLENGES}.is_active`,
        `${TABLE.CHALLENGE_TYPES}.name as challenge_type_name`,
        `${TABLE.CHALLENGE_TYPES}.label as challenge_type_label`,
        `${TABLE.CATEGORIES}.name as category_name`,
        `${TABLE.CATEGORIES}.icon_url as category_icon`
      )
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
      .leftJoin(
        TABLE.CHALLENGE_TYPES,
        `${TABLE.CHALLENGES}.challenge_type_id`,
        `${TABLE.CHALLENGE_TYPES}.id`
      )
      .leftJoin(
        TABLE.CATEGORIES,
        `${TABLE.CHALLENGES}.category_id`,
        `${TABLE.CATEGORIES}.id`
      )
      .where(`${TABLE.CHALLENGE_PROGRESS}.user_id`, userId);

    // Filter by status
    if (status && status !== "all") {
      challengesQuery = challengesQuery.where(`${TABLE.CHALLENGE_PROGRESS}.status`, status);
    }

    // Filter by category
    if (category_id) {
      challengesQuery = challengesQuery.where(
        `${TABLE.CHALLENGES}.category_id`,
        parseInt(category_id as string)
      );
    }

    // Filter by difficulty (variant name)
    if (difficulty) {
      challengesQuery = challengesQuery.whereRaw("lower(??) = ?", [
        `${TABLE.CHALLENGE_VARIANTS}.name`,
        (difficulty as string).toLowerCase(),
      ]);
    }

    // Count query
    let countQuery = db(TABLE.CHALLENGE_PROGRESS).where("user_id", userId);
    if (status && status !== "all") {
      countQuery = countQuery.where("status", status);
    }
    if (category_id) {
      countQuery = countQuery
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
        .where(`${TABLE.CHALLENGES}.category_id`, parseInt(category_id as string));
    }
    if (difficulty) {
      countQuery = countQuery
        .join(
          TABLE.CHALLENGE_VARIANTS,
          `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
          `${TABLE.CHALLENGE_VARIANTS}.id`
        )
        .whereRaw("lower(??) = ?", [
          `${TABLE.CHALLENGE_VARIANTS}.name`,
          (difficulty as string).toLowerCase(),
        ]);
    }

    const [myChallenges, totalCountResult] = await Promise.all([
      challengesQuery
        .offset(offset)
        .limit(pageLimit)
        .orderBy(`${TABLE.CHALLENGE_PROGRESS}.id`, "desc"),
      countQuery.count({ count: "*" }).first(),
    ]);

    const totalCount = parseInt(totalCountResult?.count as string) || 0;

    // Format response
    const formattedChallenges = myChallenges.map((item: MyChallengeRow) => ({
      progress_id: item.id,
      challenge_id: item.challenge_id,
      challenge_title: item.challenge_title,
      challenge_description: item.challenge_description,
      variant_name: item.variant_name,
      variant_description: item.variant_description,
      challenge_type_name: item.challenge_type_name,
      challenge_type_label: item.challenge_type_label,
      category_name: item.category_name,
      category_icon: item.category_icon ? process.env.BASE_URL + item.category_icon : null,
      start_date: item.start_date,
      end_date: item.end_date,
      is_active: item.is_active,
      status: item.status,
      current_count: item.current_count || 0,
      target_count: item.target_count,
      target_unit: item.target_unit,
      points: item.points,
      completed_at: item.completed_at,
      progress_percentage: item.target_count
        ? Math.min(100, Math.round(((item.current_count || 0) / item.target_count) * 100))
        : 0,
    }));

    return {
      data: formattedChallenges,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      },
    };
  }

  async leaveChallengeForStudent(params: {
    userId: number;
    challengeId: number;
  }): Promise<{
    progress_id: number;
    challenge_id: number;
    variant_id: number;
  }> {
    const { userId, challengeId } = params;

    const progress = await db(TABLE.CHALLENGE_PROGRESS)
      .select(
        `${TABLE.CHALLENGE_PROGRESS}.id as progress_id`,
        `${TABLE.CHALLENGE_PROGRESS}.status`,
        `${TABLE.CHALLENGE_VARIANTS}.id as variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.challenge_id`
      )
      .join(
        TABLE.CHALLENGE_VARIANTS,
        `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
        `${TABLE.CHALLENGE_VARIANTS}.id`
      )
      .where(`${TABLE.CHALLENGE_PROGRESS}.user_id`, userId)
      .where(`${TABLE.CHALLENGE_VARIANTS}.challenge_id`, challengeId)
      .first();

    if (!progress) {
      throw new ChallengeError("You have not joined this challenge", 404);
    }

    if (progress.status === "completed") {
      throw new ChallengeError("Completed challenges cannot be left", 400);
    }

    await db(TABLE.CHALLENGE_PROGRESS)
      .where("id", progress.progress_id)
      .where("user_id", userId)
      .del();

    return {
      progress_id: progress.progress_id,
      challenge_id: progress.challenge_id,
      variant_id: progress.variant_id,
    };
  }
}

export { ChallengeError } from "../utils/errors";

export const challengeService = new ChallengeService();

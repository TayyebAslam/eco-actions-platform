import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  joinChallengeSchema,
  updateProgressSchema,
  addChallengeProofSchema,
} from "../../../validations/studentChallenge.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { challengeService, ChallengeError, notificationService } from "../../../services";
import { extractPhotos } from "../../../utils/helperFunctions/photosHelper";
import { requireStudentWithSchool } from "../../../utils/helperFunctions/authHelper";
import { calculateXpFromPoints } from "../../../utils/helperFunctions/xpHelper";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Get all active challenges for student
 * Shows challenges from student's school + global challenges (school_id = null)
 */
export const getChallenges = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userSchoolId = req.user?.school_id;
      const userRole = req.user?.role;

      // Only students can access this endpoint
      if (userRole !== UserRole.STUDENT) {
        sendResponse(res, 403, "Only students can access challenges", false);
        return;
      }
      if (!userId) {
        sendResponse(res, 401, "Unauthorized", false);
        return;
      }

      const responseData = await challengeService.getChallengesForStudent({
        userId,
        userSchoolId: userSchoolId ?? null,
        query: req.query as Record<string, string | undefined>,
      });

      sendResponse(res, 200, "Challenges fetched successfully", true, responseData);
    } catch (error: unknown) {
      console.error("Error fetching challenges:", error);
      sendResponse(res, 500, "Internal server error", false);
    }
  }
);

/**
 * Get challenge by ID with full details and student's progress
 */
export const getChallengeById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userSchoolId = req.user?.school_id;
      const userRole = req.user?.role;
      const { id } = req.params;

      if (userRole !== UserRole.STUDENT) {
        sendResponse(res, 403, "Only students can access challenges", false);
        return;
      }

      // Fetch challenge
      const challenge = await db(TABLE.CHALLENGES)
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
        .where(`${TABLE.CHALLENGES}.id`, id)
        .first();

      if (!challenge) {
        sendResponse(res, 404, "Challenge not found", false);
        return;
      }

      // Check if student can access this challenge
      const canAccess =
        challenge.school_id === null || challenge.school_id === userSchoolId;

      if (!canAccess) {
        sendResponse(res, 403, "You don't have access to this challenge", false);
        return;
      }

      // Get variants
      const variants = await db(TABLE.CHALLENGE_VARIANTS).where("challenge_id", id);
      challenge.variants = variants;

      // Get student's progress for each variant
      const variantIds = variants.map((v: { id: number }) => v.id);
      const studentProgress = await db(TABLE.CHALLENGE_PROGRESS)
        .where("user_id", userId)
        .whereIn("challenge_variant_id", variantIds);

      const progressByVariant = studentProgress.reduce((acc: Record<number, unknown>, prog: { challenge_variant_id: number; status: string; completed_at: string | null }) => {
        acc[prog.challenge_variant_id] = prog;
        return acc;
      }, {});

      // Attach progress to variants
      challenge.is_joined = false;
      challenge.my_progress = null;

      for (const variant of challenge.variants) {
        const progress = progressByVariant[variant.id];
        variant.my_progress = progress || null;

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
        }
      }

      // Get participant count
      const participantCount = await db(TABLE.CHALLENGE_PROGRESS)
        .whereIn("challenge_variant_id", variantIds)
        .countDistinct("user_id as count")
        .first();

      challenge.participant_count = parseInt(participantCount?.count as string) || 0;

      // Format category icon
      if (challenge.category_icon) {
        challenge.category_icon = process.env.BASE_URL + challenge.category_icon;
      }

      sendResponse(res, 200, "Challenge fetched successfully", true, challenge);
    } catch (error: unknown) {
      console.error("Error fetching challenge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Join a challenge by selecting a variant
 */
export const joinChallenge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userSchoolId = req.user?.school_id;
      const userRole = req.user?.role;
      const { id: challengeId } = req.params;

      if (userRole !== UserRole.STUDENT) {
        sendResponse(res, 403, "Only students can join challenges", false);
        return;
      }

      const validated = validateRequest(joinChallengeSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { variant_id } = validated;

      // Check if challenge exists and is active
      const challenge = await db(TABLE.CHALLENGES)
        .where("id", challengeId)
        .first();

      if (!challenge) {
        sendResponse(res, 404, "Challenge not found", false);
        return;
      }

      if (!challenge.is_active) {
        sendResponse(res, 400, "This challenge is no longer active", false);
        return;
      }

      // Check if challenge has ended
      if (challenge.end_date && new Date(challenge.end_date) < new Date()) {
        sendResponse(res, 400, "This challenge has ended", false);
        return;
      }

      // Check access
      const canAccess =
        challenge.school_id === null || challenge.school_id === userSchoolId;

      if (!canAccess) {
        sendResponse(res, 403, "You don't have access to this challenge", false);
        return;
      }

      // Check if variant belongs to this challenge
      const variant = await db(TABLE.CHALLENGE_VARIANTS)
        .where("id", variant_id)
        .where("challenge_id", challengeId)
        .first();

      if (!variant) {
        sendResponse(res, 404, "Variant not found for this challenge", false);
        return;
      }

      // Check if student already joined any variant of this challenge
      const existingProgress = await db(TABLE.CHALLENGE_PROGRESS)
        .whereIn(
          "challenge_variant_id",
          db(TABLE.CHALLENGE_VARIANTS).select("id").where("challenge_id", challengeId)
        )
        .where("user_id", userId)
        .first();

      if (existingProgress) {
        sendResponse(res, 400, "You have already joined this challenge", false);
        return;
      }

      // Create progress entry
      const [newProgress] = await db(TABLE.CHALLENGE_PROGRESS)
        .insert({
          user_id: userId,
          challenge_variant_id: variant_id,
          status: "in_progress",
          current_count: 0,
        })
        .returning("*");

      const responseData = {
        progress_id: newProgress.id,
        challenge_id: parseInt(challengeId as string),
        variant_id: variant.id,
        variant_name: variant.name,
        target_count: variant.target_count,
        target_unit: variant.target_unit,
        points: variant.points,
        status: newProgress.status,
        current_count: newProgress.current_count,
      };

      sendResponse(res, 201, "Successfully joined the challenge!", true, responseData);

      // Fire-and-forget: notify about challenge participation
      notificationService.notifyChallengeJoined(
        parseInt(challengeId as string),
        challenge.school_id
      ).catch((err) => console.error("Notification error (challenge joined):", err));
    } catch (error: unknown) {
      console.error("Error joining challenge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Leave a joined challenge
 */
export const leaveChallenge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { id: challengeId } = req.params;

      if (userRole !== UserRole.STUDENT) {
        sendResponse(res, 403, "Only students can leave challenges", false);
        return;
      }

      if (!userId) {
        sendResponse(res, 401, "Unauthorized", false);
        return;
      }

      const parsedChallengeId = parseInt(challengeId as string, 10);
      if (!parsedChallengeId || parsedChallengeId <= 0) {
        sendResponse(res, 400, "Invalid challenge ID", false);
        return;
      }

      const responseData = await challengeService.leaveChallengeForStudent({
        userId,
        challengeId: parsedChallengeId,
      });

      sendResponse(res, 200, "Challenge left successfully", true, responseData);
    } catch (error: any) {
      if (error instanceof ChallengeError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error leaving challenge:", error);
      sendResponse(res, 500, error.message, false);
    }
  }
);

/**
 * Update challenge progress
 */
export const updateProgress = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { progressId } = req.params;

      if (userRole !== UserRole.STUDENT) {
        sendResponse(res, 403, "Only students can update progress", false);
        return;
      }

      const validated = validateRequest(updateProgressSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { increment } = validated;

      // Get progress with variant info
      const progress = await db(TABLE.CHALLENGE_PROGRESS)
        .select(
          `${TABLE.CHALLENGE_PROGRESS}.*`,
          `${TABLE.CHALLENGE_VARIANTS}.target_count`,
          `${TABLE.CHALLENGE_VARIANTS}.target_unit`,
          `${TABLE.CHALLENGE_VARIANTS}.points`,
          `${TABLE.CHALLENGE_VARIANTS}.name as variant_name`,
          `${TABLE.CHALLENGE_VARIANTS}.challenge_id`
        )
        .join(
          TABLE.CHALLENGE_VARIANTS,
          `${TABLE.CHALLENGE_PROGRESS}.challenge_variant_id`,
          `${TABLE.CHALLENGE_VARIANTS}.id`
        )
        .where(`${TABLE.CHALLENGE_PROGRESS}.id`, progressId)
        .first();

      if (!progress) {
        sendResponse(res, 404, "Progress not found", false);
        return;
      }

      // Verify ownership
      if (progress.user_id !== userId) {
        sendResponse(res, 403, "You can only update your own progress", false);
        return;
      }

      // Check if already completed
      if (progress.status === "completed") {
        sendResponse(res, 400, "This challenge is already completed", false);
        return;
      }

      // Check if challenge is still active
      const challenge = await db(TABLE.CHALLENGES)
        .where("id", progress.challenge_id)
        .first();

      if (!challenge?.is_active) {
        sendResponse(res, 400, "This challenge is no longer active", false);
        return;
      }

      if (challenge.end_date && new Date(challenge.end_date) < new Date()) {
        sendResponse(res, 400, "This challenge has ended", false);
        return;
      }

      // Calculate new count
      const newCount = (progress.current_count || 0) + increment;
      const isCompleted = newCount >= progress.target_count;

      // Update progress
      const updateData: Record<string, unknown> = {
        current_count: Math.min(newCount, progress.target_count),
      };

      if (isCompleted) {
        updateData.status = "completed";
        updateData.completed_at = new Date();
      }

      await db(TABLE.CHALLENGE_PROGRESS).where("id", progressId).update(updateData);

      // If completed, award points
      let pointsAwarded = 0;
      if (isCompleted && progress.points) {
        pointsAwarded = progress.points;
        const xpEarned = calculateXpFromPoints(pointsAwarded);

        // Get challenge title for points log
        const challengeTitle = challenge.title || "Challenge";

        await db.transaction(async (trx) => {
          // Add points log entry
          await trx(TABLE.POINTS_LOG).insert({
            user_id: userId,
            amount: pointsAwarded,
            reason: `Challenge completed: ${challengeTitle} - ${progress.variant_name}`,
          });

          // Update student's total_points and xp
          await trx(TABLE.STUDENTS)
            .where("user_id", userId)
            .increment("total_points", pointsAwarded)
            .increment("xp", xpEarned);

          // Check for level progression
          const student = await trx(TABLE.STUDENTS).where("user_id", userId).first();

          if (student) {
            const nextLevel = await trx(TABLE.LEVELS)
              .where("min_xp", "<=", student.xp || 0)
              .orderBy("min_xp", "desc")
              .first();

            if (nextLevel && nextLevel.id > student.level) {
              await trx(TABLE.STUDENTS)
                .where("user_id", userId)
                .update({ level: nextLevel.id });
            }
          }
        });
      }

      const responseData = {
        progress_id: parseInt(progressId as string),
        current_count: updateData.current_count,
        target_count: progress.target_count,
        target_unit: progress.target_unit,
        status: isCompleted ? "completed" : "in_progress",
        completed_at: updateData.completed_at || null,
        points_awarded: pointsAwarded,
      };

      const message = isCompleted
        ? `Congratulations! Challenge completed! You earned ${pointsAwarded} points!`
        : "Progress updated successfully";

      sendResponse(res, 200, message, true, responseData);
    } catch (error: unknown) {
      console.error("Error updating progress:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Add proof (photos) for a joined challenge
 */
export const addChallengeProof = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guard = requireStudentWithSchool(req, res, {
        forbidden: "Only students can add challenge proof",
      });
      if (!guard) {
        return;
      }
      const { userId, schoolId } = guard;
      const { progressId } = req.params;

      const files = (req.files as Express.Multer.File[] | undefined) || undefined;
      const photosFromFiles = extractPhotos({ files, bodyPhotos: req.body?.photos });

      const parsedBody: Record<string, unknown> = {
        photos: photosFromFiles,
      };

      const validated = validateRequest(addChallengeProofSchema, parsedBody, res);
      if (!validated) {
        return;
      }

      const { photos } = validated;
      const activity = await challengeService.addChallengeProof({
        progressId: parseInt(progressId as string),
        userId,
        schoolId,
        photos,
      });

      sendResponse(res, 201, "Challenge proof submitted successfully", true, activity);
    } catch (error: unknown) {
      if (error instanceof ChallengeError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error adding challenge proof:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

const fetchJoinedChallenges = async (
  req: Request,
  res: Response,
  successMessage: string
): Promise<void> => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (userRole !== UserRole.STUDENT) {
    sendResponse(res, 403, "Only students can access this", false);
    return;
  }

  if (!userId) {
    sendResponse(res, 401, "Unauthorized", false);
    return;
  }

  const responseData = await challengeService.getMyChallengesForStudent({
    userId,
    query: req.query as any,
  });

  sendResponse(res, 200, successMessage, true, responseData);
};

const handleJoinedChallenges = async (
  req: Request,
  res: Response,
  successMessage: string,
  errorLogPrefix: string
): Promise<void> => {
  try {
    await fetchJoinedChallenges(req, res, successMessage);
  } catch (error: any) {
    console.error(`${errorLogPrefix}:`, error);
    sendResponse(res, 500, error.message || "Internal server error", false);
  }
};

/**
 * Get student's joined challenges (legacy endpoint)
 */
export const getMyChallenges = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await handleJoinedChallenges(
      req,
      res,
      "My challenges fetched successfully",
      "Error fetching my challenges"
    );
  }
);

/**
 * Get student's joined challenges
 */
export const getJoinedChallenges = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await handleJoinedChallenges(
      req,
      res,
      "Joined challenges fetched successfully",
      "Error fetching joined challenges"
    );
  }
);

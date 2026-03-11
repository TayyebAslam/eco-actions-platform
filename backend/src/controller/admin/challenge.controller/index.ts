import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createChallengeSchema,
  updateChallengeSchema,
} from "../../../validations/challenge.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";

export const createChallenge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      const validated = validateRequest(createChallengeSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { title, description, start_date, end_date, is_active, school_id, challenge_type_id, category_id, variants } =
        validated;

      // Determine school_id based on role
      // Super Admin: can set any school_id or null (global)
      // Admin/Sub-Admin: forced to their own school_id
      let finalSchoolId: number | null = null;

      if (requesterRole === UserRole.SUPER_ADMIN) {
        // Super Admin has choice - use provided school_id or null for global
        finalSchoolId = school_id || null;
      } else {
        // Admin/Sub-Admin - always use their own school_id
        finalSchoolId = req.user?.school_id || null;
      }

      const result = await db.transaction(async (trx) => {
        const [newChallenge] = await trx(TABLE.CHALLENGES)
          .insert({
            title,
            description: description || null,
            start_date: start_date ? new Date(start_date) : null,
            end_date: end_date ? new Date(end_date) : null,
            is_active: is_active ?? true,
            school_id: finalSchoolId,
            challenge_type_id: challenge_type_id || null,
            category_id: category_id || null,
          })
          .returning("*");

        let insertedVariants: Record<string, unknown>[] = [];
        if (variants && variants.length > 0) {
          const variantsData = variants.map((variant: { name?: string; description?: string; target_count?: number; target_unit?: string; points?: number }) => ({
            challenge_id: newChallenge.id,
            name: variant.name || null,
            description: variant.description || null,
            target_count: variant.target_count || null,
            target_unit: variant.target_unit || null,
            points: variant.points || null,
          }));

          insertedVariants = await trx(TABLE.CHALLENGE_VARIANTS)
            .insert(variantsData)
            .returning("*");
        }

        return { ...newChallenge, variants: insertedVariants };
      });

      sendResponse(res, 201, "Challenge created successfully", true, result);
      return;
    } catch (error: unknown) {
      console.error("Error creating challenge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getAllChallenges = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, school_id, is_active, search, scope } = req.query;
      const requesterRole = req.user?.role;
      const userSchoolId = req.user?.school_id;

      console.log("Request user:", { role: requesterRole, school_id: userSchoolId });

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;

      let query = db(TABLE.CHALLENGES)
        .select(
          `${TABLE.CHALLENGES}.*`,
          `${TABLE.SCHOOLS}.name as school_name`,
          `${TABLE.CHALLENGE_TYPES}.name as challenge_type_name`,
          `${TABLE.CHALLENGE_TYPES}.label as challenge_type_label`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .leftJoin(TABLE.SCHOOLS, `${TABLE.CHALLENGES}.school_id`, `${TABLE.SCHOOLS}.id`)
        .leftJoin(TABLE.CHALLENGE_TYPES, `${TABLE.CHALLENGES}.challenge_type_id`, `${TABLE.CHALLENGE_TYPES}.id`)
        .leftJoin(TABLE.CATEGORIES, `${TABLE.CHALLENGES}.category_id`, `${TABLE.CATEGORIES}.id`);

      // Visibility filter based on role
      // Super Admin: can see all challenges
      // Admin/Sub-Admin: can see their school's challenges + global challenges (school_id = null)
      if (requesterRole === UserRole.SUPER_ADMIN) {
        console.log("User is SUPER_ADMIN");
        // Super Admin can filter by school_id if provided
        if (school_id) {
          query = query.where(`${TABLE.CHALLENGES}.school_id`, parseInt(school_id as string));
        }
      } else {
        console.log("User is Admin/Sub-Admin, filtering by school_id:", userSchoolId);
        // Admin/Sub-Admin: filter based on scope
        // scope=school: only their school's challenges
        // scope=all or undefined: their school + global challenges (default)
        if (scope === "school") {
          query = query.where(`${TABLE.CHALLENGES}.school_id`, userSchoolId);
        } else {
          query = query.where((builder) => {
            builder
              .where(`${TABLE.CHALLENGES}.school_id`, userSchoolId)
              .orWhereNull(`${TABLE.CHALLENGES}.school_id`);
          });
        }
      }

      if (is_active !== undefined) {
        query = query.where(`${TABLE.CHALLENGES}.is_active`, is_active === "true");
      }

      if (search) {
        const safeTerm = buildSearchTerm(search as string);
        query = query.where((builder) => {
          builder
            .where(`${TABLE.CHALLENGES}.title`, "ilike", safeTerm)
            .orWhere(`${TABLE.CHALLENGES}.description`, "ilike", safeTerm);
        });
      }

      // Build a separate count query without the join to avoid GROUP BY issues
      let countQuery = db(TABLE.CHALLENGES);

      // Apply the same filters as the main query (but without join)
      if (requesterRole === UserRole.SUPER_ADMIN) {
        if (school_id) {
          countQuery = countQuery.where(`${TABLE.CHALLENGES}.school_id`, parseInt(school_id as string));
        }
      } else {
        if (scope === "school") {
          countQuery = countQuery.where(`${TABLE.CHALLENGES}.school_id`, userSchoolId);
        } else {
          countQuery = countQuery.where((builder) => {
            builder
              .where(`${TABLE.CHALLENGES}.school_id`, userSchoolId)
              .orWhereNull(`${TABLE.CHALLENGES}.school_id`);
          });
        }
      }

      if (is_active !== undefined) {
        countQuery = countQuery.where(`${TABLE.CHALLENGES}.is_active`, is_active === "true");
      }

      if (search) {
        const safeTerm = buildSearchTerm(search as string);
        countQuery = countQuery.where((builder) => {
          builder
            .where(`${TABLE.CHALLENGES}.title`, "ilike", safeTerm)
            .orWhere(`${TABLE.CHALLENGES}.description`, "ilike", safeTerm);
        });
      }

      // Run challenges query and count query in parallel
      const [challenges, totalCountResult] = await Promise.all([
        query
          .offset(skip)
          .limit(pageLimit)
          .orderBy(`${TABLE.CHALLENGES}.id`, "desc"),
        countQuery.count({ count: "*" }).first()
      ]);

      const totalCount = parseInt(totalCountResult?.count as string) || 0;
      console.log("Challenges found:", challenges.length, "Total count:", totalCount);

      if (challenges.length > 0) {
        const challengeIds = challenges.map((c: { id: number }) => c.id);

        // Fetch all variants for all challenges in single query
        const allVariants = await db(TABLE.CHALLENGE_VARIANTS)
          .whereIn("challenge_id", challengeIds);

        console.log("Variants found:", allVariants.length);

        // Fetch participant counts for all challenges in single query
        let participantCounts: { challenge_variant_id: number; count: string }[] = [];
        if (allVariants.length > 0) {
          participantCounts = await db(TABLE.CHALLENGE_PROGRESS)
            .select("challenge_variant_id")
            .countDistinct("user_id as count")
            .whereIn(
              "challenge_variant_id",
              allVariants.map((v: { id: number }) => v.id)
            )
            .groupBy("challenge_variant_id");

          console.log("Participant counts:", participantCounts);
        }

        // Create lookup maps for O(1) access
        const variantsByChallenge = allVariants.reduce((acc: Record<number, Record<string, unknown>[]>, variant: { challenge_id: number }) => {
          if (!acc[variant.challenge_id]) {
            acc[variant.challenge_id] = [];
          }
          acc[variant.challenge_id]!.push(variant);
          return acc;
        }, {} as Record<number, Record<string, unknown>[]>);

        const participantCountByVariant = participantCounts.reduce((acc: Record<number, number>, item: { challenge_variant_id: number; count: string }) => {
          acc[item.challenge_variant_id] = parseInt(item.count as string) || 0;
          return acc;
        }, {} as Record<number, number>);

        // Assign variants and participant counts to challenges
        for (const challenge of challenges) {
          challenge.variants = variantsByChallenge[challenge.id] || [];

          // Sum participant counts for all variants of this challenge
          challenge.participant_count = challenge.variants.reduce((sum: number, variant: { id: number }) => {
            return sum + (participantCountByVariant[variant.id] || 0);
          }, 0);
        }
      }

      const responseData = {
        data: challenges,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "Challenges fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching challenges:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getChallengeById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const challenge = await db(TABLE.CHALLENGES)
        .select(
          `${TABLE.CHALLENGES}.*`,
          `${TABLE.SCHOOLS}.name as school_name`,
          `${TABLE.CHALLENGE_TYPES}.name as challenge_type_name`,
          `${TABLE.CHALLENGE_TYPES}.label as challenge_type_label`,
          `${TABLE.CATEGORIES}.name as category_name`
        )
        .leftJoin(TABLE.SCHOOLS, `${TABLE.CHALLENGES}.school_id`, `${TABLE.SCHOOLS}.id`)
        .leftJoin(TABLE.CHALLENGE_TYPES, `${TABLE.CHALLENGES}.challenge_type_id`, `${TABLE.CHALLENGE_TYPES}.id`)
        .leftJoin(TABLE.CATEGORIES, `${TABLE.CHALLENGES}.category_id`, `${TABLE.CATEGORIES}.id`)
        .where(`${TABLE.CHALLENGES}.id`, id)
        .first();

      if (!challenge) {
        sendResponse(res, 404, "Challenge not found", false);
        return;
      }

      // Get variants
      const variants = await db(TABLE.CHALLENGE_VARIANTS)
        .where("challenge_id", id);
      challenge.variants = variants;

      // Get participant count
const participantCount = await db(TABLE.CHALLENGE_PROGRESS)
  .whereIn("challenge_variant_id", variants.map((v: { id: number }) => v.id))
  .countDistinct("user_id as count")
  .first();

challenge.participant_count = participantCount?.count || 0;

      sendResponse(res, 200, "Challenge fetched successfully", true, challenge);
      return;
    } catch (error: unknown) {
      console.error("Error fetching challenge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const updateChallenge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const validated = validateRequest(updateChallengeSchema, req.body, res);
      if (!validated) {
        return;
      }

      const existingChallenge = await db(TABLE.CHALLENGES).where("id", id).first();

      if (!existingChallenge) {
        sendResponse(res, 404, "Challenge not found", false);
        return;
      }

      const { title, description, start_date, end_date, is_active, school_id, challenge_type_id, category_id, variants } =
        validated;

      const result = await db.transaction(async (trx) => {
        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (start_date !== undefined) updateData.start_date = start_date ? new Date(start_date) : null;
        if (end_date !== undefined) updateData.end_date = end_date ? new Date(end_date) : null;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (school_id !== undefined) updateData.school_id = school_id;
        if (challenge_type_id !== undefined) updateData.challenge_type_id = challenge_type_id;
        if (category_id !== undefined) updateData.category_id = category_id;

        const [updatedChallenge] = await trx(TABLE.CHALLENGES)
          .where("id", id)
          .update(updateData)
          .returning("*");

        let updatedVariants: Record<string, unknown>[] = [];
        if (variants !== undefined) {
          // Delete existing variants
          await trx(TABLE.CHALLENGE_VARIANTS).where("challenge_id", id).del();

          // Insert new variants
          if (variants.length > 0) {
            const variantsData = variants.map((variant: { name?: string; description?: string; target_count?: number; target_unit?: string; points?: number }) => ({
              challenge_id: id,
              name: variant.name || null,
              description: variant.description || null,
              target_count: variant.target_count || null,
              target_unit: variant.target_unit || null,
              points: variant.points || null,
            }));

            updatedVariants = await trx(TABLE.CHALLENGE_VARIANTS)
              .insert(variantsData)
              .returning("*");
          }
        } else {
          updatedVariants = await trx(TABLE.CHALLENGE_VARIANTS)
            .where("challenge_id", id);
        }

        return { ...updatedChallenge, variants: updatedVariants };
      });

      sendResponse(res, 200, "Challenge updated successfully", true, result);
      return;
    } catch (error: unknown) {
      console.error("Error updating challenge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const deleteChallenge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const challenge = await db(TABLE.CHALLENGES).where("id", id).first();

      if (!challenge) {
        sendResponse(res, 404, "Challenge not found", false);
        return;
      }

      // Cascade delete will handle variants and progress
      await db(TABLE.CHALLENGES).where("id", id).del();

      sendResponse(res, 200, "Challenge deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting challenge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

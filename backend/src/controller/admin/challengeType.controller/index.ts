import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createChallengeTypeSchema,
  updateChallengeTypeSchema,
} from "../../../validations/challengeType.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

export const createChallengeType = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN &&
        requesterRole !== UserRole.SUB_ADMIN
      ) {
        sendResponse(res, 403, "You don't have permission to create challenge types", false);
        return;
      }

      const data = validateRequest(createChallengeTypeSchema, req.body, res);
      if (!data) return;

      const { name, label, description, units, is_active } = data;

      // Check if challenge type with same name already exists
      const existingType = await db(TABLE.CHALLENGE_TYPES)
        .where("name", name)
        .first();

      if (existingType) {
        sendResponse(res, 409, "Challenge type with this name already exists", false);
        return;
      }

      const [newChallengeType] = await db(TABLE.CHALLENGE_TYPES)
        .insert({
          name,
          label,
          description: description || null,
          units: units ? JSON.stringify(units) : null,
          is_active: is_active ?? true,
        })
        .returning("*");

      sendResponse(res, 201, "Challenge type created successfully", true, newChallengeType);
      return;
    } catch (error: unknown) {
      console.error("Error creating challenge type:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getAllChallengeTypes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, is_active, search } = req.query;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;

      let query = db(TABLE.CHALLENGE_TYPES);

      if (is_active !== undefined) {
        query = query.where("is_active", is_active === "true");
      }

      if (search) {
        query = query.where((builder) => {
          builder
            .where("name", "ilike", `%${search}%`)
            .orWhere("description", "ilike", `%${search}%`);
        });
      }

      const [challengeTypes, totalCountResult] = await Promise.all([
        query
          .clone()
          .offset(skip)
          .limit(pageLimit)
          .orderBy("id", "desc"),
        query.clone().count({ count: "*" }).first()
      ]);

      const totalCount = parseInt(totalCountResult?.count as string) || 0;

      const responseData = {
        data: challengeTypes,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "Challenge types fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching challenge types:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getChallengeTypeById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const challengeType = await db(TABLE.CHALLENGE_TYPES)
        .where("id", id)
        .first();

      if (!challengeType) {
        sendResponse(res, 404, "Challenge type not found", false);
        return;
      }

      sendResponse(res, 200, "Challenge type fetched successfully", true, challengeType);
      return;
    } catch (error: unknown) {
      console.error("Error fetching challenge type:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const updateChallengeType = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN &&
        requesterRole !== UserRole.SUB_ADMIN
      ) {
        sendResponse(res, 403, "You don't have permission to update challenge types", false);
        return;
      }

      const { id } = req.params;

      const data = validateRequest(updateChallengeTypeSchema, req.body, res);
      if (!data) return;

      const existingChallengeType = await db(TABLE.CHALLENGE_TYPES)
        .where("id", id)
        .first();

      if (!existingChallengeType) {
        sendResponse(res, 404, "Challenge type not found", false);
        return;
      }

      const { name, label, description, units, is_active } = data;

      // Check if another challenge type with same name exists
      if (name) {
        const duplicateType = await db(TABLE.CHALLENGE_TYPES)
          .where("name", name)
          .whereNot("id", id)
          .first();

        if (duplicateType) {
          sendResponse(res, 409, "Challenge type with this name already exists", false);
          return;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (label !== undefined) updateData.label = label;
      if (description !== undefined) updateData.description = description;
      if (units !== undefined) updateData.units = JSON.stringify(units);
      if (is_active !== undefined) updateData.is_active = is_active;

      const [updatedChallengeType] = await db(TABLE.CHALLENGE_TYPES)
        .where("id", id)
        .update(updateData)
        .returning("*");

      sendResponse(res, 200, "Challenge type updated successfully", true, updatedChallengeType);
      return;
    } catch (error: unknown) {
      console.error("Error updating challenge type:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const deleteChallengeType = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(res, 403, "You don't have permission to delete challenge types", false);
        return;
      }

      const { id } = req.params;

      const challengeType = await db(TABLE.CHALLENGE_TYPES)
        .where("id", id)
        .first();

      if (!challengeType) {
        sendResponse(res, 404, "Challenge type not found", false);
        return;
      }

      // Check if any challenges are using this type
      const challengesCount = await db(TABLE.CHALLENGES)
        .where("challenge_type_id", id)
        .count({ count: "*" })
        .first();

      const count = parseInt(challengesCount?.count as string) || 0;

      if (count > 0) {
        sendResponse(
          res,
          409,
          `Cannot delete challenge type. ${count} challenge(s) are using this type.`,
          false
        );
        return;
      }

      await db(TABLE.CHALLENGE_TYPES).where("id", id).del();

      sendResponse(res, 200, "Challenge type deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting challenge type:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

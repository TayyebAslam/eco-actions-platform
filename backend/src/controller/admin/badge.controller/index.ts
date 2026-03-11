import { Request, Response } from "express";
import fs from "fs";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  createBadgeSchema,
  updateBadgeSchema,
} from "../../../validations/badge.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { invalidateBadges } from "../../../utils/services/redis/cacheInvalidation";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";

export const createBadge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = validateRequest(createBadgeSchema, req.body, res);
      if (!data) return;

      const { name, criteria } = data;

      // Check if badge with same name exists
      const existingBadge = await db(TABLE.BADGES)
        .whereRaw("LOWER(name) = ?", [name.toLowerCase()])
        .first();

      if (existingBadge) {
        sendResponse(res, 400, "Badge with this name already exists", false);
        return;
      }

      // Handle icon upload
      let iconUrl = null;
      if (req.file) {
        iconUrl = "/badges/" + req.file.filename;
      }

      const [newBadge] = await db(TABLE.BADGES)
        .insert({
          name,
          icon_url: iconUrl,
          criteria: criteria || null,
        })
        .returning("*");

      if (newBadge.icon_url) {
        newBadge.icon_url = process.env.BASE_URL + newBadge.icon_url;
      }

      await invalidateBadges();
      sendResponse(res, 201, "Badge created successfully", true, newBadge);
      return;
    } catch (error: unknown) {
      console.error("Error creating badge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getAllBadges = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, search } = req.query;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;
      const searchTerm = (search as string) || "";

      let query = db(TABLE.BADGES);

      if (searchTerm) {
        query = query.where("name", "ilike", buildSearchTerm(searchTerm));
      }

      const badges = await query
        .clone()
        .offset(skip)
        .limit(pageLimit)
        .orderBy("id", "asc");

      // Add earned count for each badge
      for (const badge of badges) {
        if (badge.icon_url) {
          badge.icon_url = process.env.BASE_URL + badge.icon_url;
        }

        const earnedCount = await db(TABLE.STUDENT_BADGES)
          .where("badge_id", badge.id)
          .count({ count: "*" });
        badge.earned_count = parseInt(earnedCount[0]?.count as string) || 0;
      }

      let countQuery = db(TABLE.BADGES);
      if (searchTerm) {
        countQuery = countQuery.where("name", "ilike", buildSearchTerm(searchTerm));
      }
      const totalCountResult = await countQuery.count({ count: "*" });
      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: badges,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "Badges fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching badges:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getBadgeById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const badge = await db(TABLE.BADGES).where("id", id).first();

      if (!badge) {
        sendResponse(res, 404, "Badge not found", false);
        return;
      }

      if (badge.icon_url) {
        badge.icon_url = process.env.BASE_URL + badge.icon_url;
      }

      // Get earned count
      const earnedCount = await db(TABLE.STUDENT_BADGES)
        .where("badge_id", id)
        .count({ count: "*" });

      const responseData = {
        ...badge,
        earned_count: parseInt(earnedCount[0]?.count as string) || 0,
      };

      sendResponse(res, 200, "Badge fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching badge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const updateBadge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const data = validateRequest(updateBadgeSchema, req.body, res);
      if (!data) return;

      const existingBadge = await db(TABLE.BADGES).where("id", id).first();

      if (!existingBadge) {
        sendResponse(res, 404, "Badge not found", false);
        return;
      }

      const { name, criteria } = data;

      // Check if name is unique (if updating name)
      if (name && name.toLowerCase() !== existingBadge.name?.toLowerCase()) {
        const nameExists = await db(TABLE.BADGES)
          .whereRaw("LOWER(name) = ?", [name.toLowerCase()])
          .whereNot("id", id)
          .first();

        if (nameExists) {
          sendResponse(res, 400, "Badge with this name already exists", false);
          return;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (criteria !== undefined) updateData.criteria = criteria;

      // Handle icon upload
      if (req.file) {
        if (existingBadge.icon_url) {
          try {
            fs.unlinkSync(`public${existingBadge.icon_url}`);
          } catch (e) {
            /* ignore */
          }
        }
        updateData.icon_url = "/badges/" + req.file.filename;
      }

      const [updatedBadge] = await db(TABLE.BADGES)
        .where("id", id)
        .update(updateData)
        .returning("*");

      if (updatedBadge.icon_url) {
        updatedBadge.icon_url = process.env.BASE_URL + updatedBadge.icon_url;
      }

      await invalidateBadges();
      sendResponse(res, 200, "Badge updated successfully", true, updatedBadge);
      return;
    } catch (error: unknown) {
      console.error("Error updating badge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const deleteBadge = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const badge = await db(TABLE.BADGES).where("id", id).first();

      if (!badge) {
        sendResponse(res, 404, "Badge not found", false);
        return;
      }

      // Delete icon file if exists
      if (badge.icon_url) {
        try {
          fs.unlinkSync(`public${badge.icon_url}`);
        } catch (e) {
          /* ignore */
        }
      }

      await db(TABLE.BADGES).where("id", id).del();

      await invalidateBadges();
      sendResponse(res, 200, "Badge deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting badge:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

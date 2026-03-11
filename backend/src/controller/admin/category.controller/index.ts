import { Request, Response } from "express";
import fs from "fs";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../../../validations/category.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { invalidateCategories } from "../../../utils/services/redis/cacheInvalidation";
import { activityLogger } from "../../../utils/services/activityLogger";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";

export const createCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = validateRequest(createCategorySchema, req.body, res);
      if (!data) return;

      const { name, color, units } = data;

      // Check if category with same name exists
      const existingCategory = await db(TABLE.CATEGORIES)
        .whereRaw("LOWER(name) = ?", [name.toLowerCase()])
        .first();

      if (existingCategory) {
        sendResponse(res, 400, "Category with this name already exists", false);
        return;
      }

      // Handle icon upload
      let iconUrl = null;
      if (req.file) {
        iconUrl = "/categories/" + req.file.filename;
      }

      const [newCategory] = await db(TABLE.CATEGORIES)
        .insert({
          name,
          icon_url: iconUrl,
          color: color || null,
          units: units ? JSON.stringify(units) : null,
        })
        .returning("*");

      if (newCategory.icon_url) {
        newCategory.icon_url = process.env.BASE_URL + newCategory.icon_url;
      }

      // Parse units if it's a string
      if (newCategory.units && typeof newCategory.units === "string") {
        newCategory.units = JSON.parse(newCategory.units);
      }

      await invalidateCategories();

      await activityLogger.log(req, "CREATE", "categories", {
        resourceId: newCategory.id,
        resourceName: newCategory.name,
      });

      sendResponse(res, 201, "Category created successfully", true, newCategory);
      return;
    } catch (error: unknown) {
      console.error("Error creating category:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getAllCategories = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, search } = req.query;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;
      const searchTerm = (search as string) || "";

      let query = db(TABLE.CATEGORIES);

      if (searchTerm) {
        query = query.where("name", "ilike", buildSearchTerm(searchTerm));
      }

      const categories = await query
        .clone()
        .offset(skip)
        .limit(pageLimit)
        .orderBy("id", "asc");

      categories.forEach((category: { icon_url?: string; units?: string; [key: string]: unknown }) => {
        if (category.icon_url) {
          category.icon_url = process.env.BASE_URL + category.icon_url;
        }
        // Parse units if it's a string
        if (category.units && typeof category.units === "string") {
          category.units = JSON.parse(category.units);
        }
      });

      let countQuery = db(TABLE.CATEGORIES);
      if (searchTerm) {
        countQuery = countQuery.where("name", "ilike", buildSearchTerm(searchTerm));
      }
      const totalCountResult = await countQuery.count({ count: "*" });
      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: categories,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "Categories fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching categories:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const getCategoryById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const category = await db(TABLE.CATEGORIES).where("id", id).first();

      if (!category) {
        sendResponse(res, 404, "Category not found", false);
        return;
      }

      if (category.icon_url) {
        category.icon_url = process.env.BASE_URL + category.icon_url;
      }

      // Parse units if it's a string
      if (category.units && typeof category.units === "string") {
        category.units = JSON.parse(category.units);
      }

      // Get activities count for this category
      const activitiesCount = await db(TABLE.ACTIVITIES)
        .where("category_id", id)
        .count({ count: "*" });

      const responseData = {
        ...category,
        activities_count: parseInt(activitiesCount[0]?.count as string) || 0,
      };

      sendResponse(res, 200, "Category fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching category:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const data = validateRequest(updateCategorySchema, req.body, res);
      if (!data) return;

      const existingCategory = await db(TABLE.CATEGORIES).where("id", id).first();

      if (!existingCategory) {
        sendResponse(res, 404, "Category not found", false);
        return;
      }

      const { name, color, units } = data;

      // Check if name is unique (if updating name)
      if (name && name.toLowerCase() !== existingCategory.name?.toLowerCase()) {
        const nameExists = await db(TABLE.CATEGORIES)
          .whereRaw("LOWER(name) = ?", [name.toLowerCase()])
          .whereNot("id", id)
          .first();

        if (nameExists) {
          sendResponse(res, 400, "Category with this name already exists", false);
          return;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (color !== undefined) updateData.color = color;
      if (units !== undefined) updateData.units = JSON.stringify(units);

      // Handle icon upload
      if (req.file) {
        if (existingCategory.icon_url) {
          try {
            fs.unlinkSync(`public${existingCategory.icon_url}`);
          } catch (e) {
            /* ignore */
          }
        }
        updateData.icon_url = "/categories/" + req.file.filename;
      }

      const [updatedCategory] = await db(TABLE.CATEGORIES)
        .where("id", id)
        .update(updateData)
        .returning("*");

      if (updatedCategory.icon_url) {
        updatedCategory.icon_url = process.env.BASE_URL + updatedCategory.icon_url;
      }

      if (updatedCategory.units && typeof updatedCategory.units === "string") {
        updatedCategory.units = JSON.parse(updatedCategory.units);
      }

      await invalidateCategories();

      await activityLogger.log(req, "UPDATE", "categories", {
        resourceId: updatedCategory.id,
        resourceName: updatedCategory.name,
        details: data,
      });

      sendResponse(res, 200, "Category updated successfully", true, updatedCategory);
      return;
    } catch (error: unknown) {
      console.error("Error updating category:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const category = await db(TABLE.CATEGORIES).where("id", id).first();

      if (!category) {
        sendResponse(res, 404, "Category not found", false);
        return;
      }

      // Check if category has activities
      const activitiesCount = await db(TABLE.ACTIVITIES)
        .where("category_id", id)
        .count({ count: "*" });

      if (parseInt(activitiesCount[0]?.count as string) > 0) {
        sendResponse(
          res,
          400,
          "Cannot delete category with existing activities",
          false
        );
        return;
      }

      // Delete icon file if exists
      if (category.icon_url) {
        try {
          fs.unlinkSync(`public${category.icon_url}`);
        } catch (e) {
          /* ignore */
        }
      }

      await db(TABLE.CATEGORIES).where("id", id).del();

      await invalidateCategories();

      await activityLogger.log(req, "DELETE", "categories", {
        resourceId: parseInt(id as string),
        resourceName: category.name,
      });

      sendResponse(res, 200, "Category deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting category:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

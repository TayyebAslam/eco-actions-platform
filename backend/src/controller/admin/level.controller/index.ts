import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  createLevelSchema,
  updateLevelSchema,
  applyLevelFormulaSchema,
} from "../../../validations/level.validation";
import { activityLogger } from "../../../utils/services/activityLogger";
import { levelService, LevelError } from "../../../services";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

export const createLevel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = validateRequest(createLevelSchema, req.body, res);
      if (!data) return;

      const { id, title, min_xp } = data;
      const newLevel = await levelService.createLevel({ id, title, min_xp });

      await activityLogger.log(req, "CREATE", "levels", {
        resourceId: newLevel.id as number,
        resourceName: newLevel.title as string,
        details: { min_xp: newLevel.min_xp },
      });

      sendResponse(res, 201, "Level created successfully", true, newLevel);
      return;
    } catch (error: unknown) {
      if (error instanceof LevelError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error creating level:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const getAllLevels = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const levels = await levelService.getAllLevels();

      sendResponse(res, 200, "Levels fetched successfully", true, levels);
      return;
    } catch (error: unknown) {
      if (error instanceof LevelError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching levels:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const getLevelById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const level = await levelService.getLevelById(id);
      sendResponse(res, 200, "Level fetched successfully", true, level);
      return;
    } catch (error: unknown) {
      if (error instanceof LevelError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error fetching level:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const updateLevel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      const data = validateRequest(updateLevelSchema, req.body, res);
      if (!data) return;

      const updatedLevel = await levelService.updateLevel(id, data);

      await activityLogger.log(req, "UPDATE", "levels", {
        resourceId: updatedLevel.id as number,
        resourceName: updatedLevel.title as string,
        details: data,
      });

      sendResponse(res, 200, "Level updated successfully", true, updatedLevel);
      return;
    } catch (error: unknown) {
      if (error instanceof LevelError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error updating level:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const applyLevelFormula = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = validateRequest(applyLevelFormulaSchema, req.body, res);
      if (!data) return;

      const result = await levelService.applyLevelFormula(data);

      await activityLogger.log(req, "UPDATE", "levels", {
        resourceName: "level_difficulty_formula",
        details: data,
      });

      sendResponse(res, 200, "Level difficulty formula applied successfully", true, result);
      return;
    } catch (error: unknown) {
      if (error instanceof LevelError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error applying level formula:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const deleteLevel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const level = await levelService.deleteLevel(id);

      await activityLogger.log(req, "DELETE", "levels", {
        resourceId: id,
        resourceName: level.title as string,
      });

      sendResponse(res, 200, "Level deleted successfully", true);
      return;
    } catch (error: unknown) {
      if (error instanceof LevelError) {
        sendResponse(res, error.statusCode, error.message, false);
        return;
      }
      console.error("Error deleting level:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

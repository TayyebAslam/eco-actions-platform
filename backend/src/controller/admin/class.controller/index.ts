import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Get All Global Classes (for dropdown)
 * Returns all standard classes 1-12
 */
export const getAllGlobalClasses = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const classes = await db(TABLE.CLASSES).orderBy("id", "asc");

      sendResponse(res, 200, "Classes fetched successfully", true, classes);
      return;
    } catch (error: unknown) {
      console.error("Error fetching classes:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

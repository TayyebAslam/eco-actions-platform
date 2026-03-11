import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors/AppError";
import { sendResponse } from "../utils/helperFunctions/responseHelper";

/**
 * Global error handling middleware
 * Catches AppError instances and sends standardized responses
 * Logs unexpected errors for debugging
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    sendResponse(res, err.statusCode, err.message, false, err.data);
    return;
  }

  // Unexpected error - log and send generic response
  console.error("Unhandled error:", err);
  sendResponse(
    res,
    500,
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error",
    false
  );
};

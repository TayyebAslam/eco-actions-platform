import { Request, Response } from "express";
import asyncHandler from "../../middlewares/trycatch";
import { sendResponse } from "../../utils/helperFunctions/responseHelper";
import { pushService } from "../../services";
import {
  registerTokenSchema,
  unregisterTokenSchema,
} from "../../validations/pushToken.validation";

/**
 * Register an FCM token for the authenticated user
 */
export const registerToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    const parsed = registerTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]!;
      sendResponse(res, 400, firstError.message, false);
      return;
    }

    await pushService.registerToken({
      user_id: userId,
      token: parsed.data.token,
      device_type: parsed.data.device_type,
      device_name: parsed.data.device_name,
    });

    sendResponse(res, 200, "Push token registered successfully", true);
  }
);

/**
 * Unregister an FCM token for the authenticated user
 */
export const unregisterToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      sendResponse(res, 401, "Unauthorized", false);
      return;
    }

    const parsed = unregisterTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]!;
      sendResponse(res, 400, firstError.message, false);
      return;
    }

    await pushService.unregisterToken({
      user_id: userId,
      token: parsed.data.token,
    });

    sendResponse(res, 200, "Push token unregistered successfully", true);
  }
);

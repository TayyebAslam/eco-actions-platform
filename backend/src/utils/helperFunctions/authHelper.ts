import { Request, Response } from "express";
import { UserRole } from "../enums/users.enum";
import { sendResponse } from "./responseHelper";

export const requireStudentWithSchool = (
  req: Request,
  res: Response,
  messages?: { forbidden?: string; unauthorized?: string }
): { userId: number; schoolId: number } | null => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const schoolId = req.user?.school_id;

  if (userRole !== UserRole.STUDENT) {
    sendResponse(
      res,
      403,
      messages?.forbidden || "Only students can access this",
      false
    );
    return null;
  }

  if (!userId || !schoolId) {
    sendResponse(res, 401, messages?.unauthorized || "Unauthorized", false);
    return null;
  }

  return { userId, schoolId };
};

import { UserRole } from "../enums/users.enum";
import { sendResponse } from "./responseHelper";
import { Request, Response } from "express";

export const requireStudentUser = (
  req: Request,
  res: Response
): (NonNullable<Request["user"]> & { school_id: number; role: UserRole }) | null => {
  const user = req.user;
  if (!user) {
    sendResponse(res, 401, "Unauthorized", false);
    return null;
  }
  if (user.role !== UserRole.STUDENT) {
    sendResponse(res, 403, "Only students can access this resource", false);
    return null;
  }
  if (!user.school_id) {
    sendResponse(res, 400, "School ID not found", false);
    return null;
  }
  return user as NonNullable<Request["user"]> & { school_id: number; role: UserRole };
};

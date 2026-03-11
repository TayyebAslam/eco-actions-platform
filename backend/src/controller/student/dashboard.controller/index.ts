import { Request, Response } from "express";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { requireStudentUser } from "../../../utils/helperFunctions/requireStudentUser";
import { StudentError, studentService } from "../../../services/student.service";

export const getStudentDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = requireStudentUser(req, res);
    if (!user) return;

    const result = await studentService.getStudentDashboard(user.id, user.school_id);
    sendResponse(res, 200, "Student dashboard fetched successfully", true, result);
  } catch (error: any) {
    if (error instanceof StudentError) {
      sendResponse(res, error.statusCode, error.message, false, error.data);
      return;
    }
    console.error("Error fetching student dashboard:", error);
    sendResponse(res, 500, error.message || "Internal server error", false);
  }
};


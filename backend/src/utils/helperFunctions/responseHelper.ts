import { Response } from "express";

export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  success: boolean,
  data?: unknown
) => {
  return res.status(statusCode).json({
    status: statusCode,
    success: success,
    data,
    message,
  });
};

import { Response } from "express";
import { z } from "zod";
import { sendResponse } from "../utils/helperFunctions/responseHelper";

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodIssue[] };

const validate = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  _res: Response
): ValidationResult<T> => {
  try {
    const parsedData = schema.parse(data);
    return { success: true, data: parsedData };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, errors: err.issues };
    }
    throw Error("Validation failed");
  }
};

export const validateRequest = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  res: Response,
  options?: { statusCode?: number; message?: string }
): T | null => {
  const result = validate(schema, data, res);

  if (!result.success) {
    const statusCode = options?.statusCode ?? 400;
    const message = options?.message ?? "Validation error";
    sendResponse(res, statusCode, message, false, result.errors);
    return null;
  }

  return result.data;
};

export default validate;

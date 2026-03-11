import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { validateRequest } from "../../../validations";
import {
  createUserSchema,
  updateUserSchema,
  getUsersQuerySchema,
  idParamSchema,
} from "../../../validations/user.validation";
import { userService, UserError } from "../../../services";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";

/**
 * Create User
 */
export const createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = validateRequest(createUserSchema, req.body, res);
  if (!data) return;

  try {
    const user = await userService.createUser(data);
    sendResponse(res, 201, "User created successfully and welcome email sent", true, user);
  } catch (error: unknown) {
    if (error instanceof UserError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error(error);
    sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Update User
 */
export const updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = validateRequest(idParamSchema, req.params, res);
  if (!params) return;
  const data = validateRequest(updateUserSchema, req.body, res);
  if (!data) return;

  try {
    const user = await userService.updateUser(params.id, data);
    sendResponse(res, 200, "User updated successfully", true, user);
  } catch (error: unknown) {
    if (error instanceof UserError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error(error);
    sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Get All Users
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = validateRequest(getUsersQuerySchema, req.query, res);
  if (!query) return;

  try {
    const result = await userService.getAllUsers(
      {
        search: query.search,
        role: query.role,
        is_active: query.is_active,
      },
      {
        page: query.page,
        limit: query.limit,
      }
    );

    sendResponse(res, 200, "Users fetched successfully", true, {
      users: result.data,
      ...result.pagination,
    });
  } catch (error: unknown) {
    console.error(error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Get User By ID
 */
export const getUsersById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = validateRequest(idParamSchema, req.params, res);
  if (!params) return;

  try {
    const user = await userService.getUserById(params.id);
    sendResponse(res, 200, "User fetched successfully", true, user);
  } catch (error: unknown) {
    if (error instanceof UserError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error(error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Delete User By ID
 */
export const destroyUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = validateRequest(idParamSchema, req.params, res);
  if (!params) return;

  try {
    const user = await userService.deleteUser(params.id);
    sendResponse(res, 200, "User deleted successfully", true, user);
  } catch (error: unknown) {
    if (error instanceof UserError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error(error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

/**
 * Toggle User Status
 */
export const toggleUserStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const params = validateRequest(idParamSchema, req.params, res);
  if (!params) return;

  try {
    const user = await userService.toggleUserStatus(params.id);
    sendResponse(res, 200, "User status updated successfully", true, user);
  } catch (error: unknown) {
    if (error instanceof UserError) {
      sendResponse(res, error.statusCode, error.message, false);
      return;
    }
    console.error(error);
    sendResponse(res, 500, getErrorMessage(error), false);
  }
});

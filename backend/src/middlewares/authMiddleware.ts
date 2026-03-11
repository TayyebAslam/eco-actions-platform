import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import db from "../config/db";
import type { User } from "../utils/types/auth";
import { verifyToken } from "../utils/services/jwt";
import { sendResponse } from "../utils/helperFunctions/responseHelper";
import { TABLE } from "../utils/Database/table";
import { cache } from "../utils/services/redis/cache";
import { REDIS_KEYS, REDIS_TTL } from "../utils/services/redis/keys";
import { UserRole } from "../utils/enums/users.enum";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

/**
 * Fetch user from database with role info
 */
const fetchUserFromDB = async (userId: number): Promise<User | null> => {
  const user = await db(TABLE.USERS)
    .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
    .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
    .where(`${TABLE.USERS}.id`, userId)
    .where(`${TABLE.USERS}.is_deleted`, false)
    .first();

  return user || null;
};

/**
 * Get user with caching
 * First checks Redis cache, then falls back to database
 */
const getUserWithCache = async (userId: number): Promise<User | null> => {
  const cacheKey = REDIS_KEYS.USER(userId);

  // Try to get from cache using getOrSet pattern
  return cache.getOrSet<User | null>(
    cacheKey,
    () => fetchUserFromDB(userId),
    REDIS_TTL.USER
  );
};

/**
 * Invalidate user cache
 * Call this when user data is updated
 */
export const invalidateUserCache = async (userId: number): Promise<void> => {
  await cache.del(REDIS_KEYS.USER(userId));
};

/**
 * Auth middleware - validates JWT and attaches user to request
 * Uses Redis caching to minimize database queries
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.cookies?.accessToken;

    if (!token) {
      sendResponse(res, 401, "Unauthorized! please login first.", false);
      return;
    }

    // Extract session token from header or cookie
    const sessionToken =
      req.header("X-Session-Token") || req.cookies?.sessionToken;

    // Verify JWT token
    const decoded = verifyToken(token);
    const userId = parseInt((decoded as JwtPayload).id, 10);

    if (isNaN(userId)) {
      sendResponse(res, 401, "Invalid token", false);
      return;
    }

    // Get user with caching (Redis first, then DB)
    const user = await getUserWithCache(userId);

    if (!user) {
      sendResponse(res, 404, "Account not found", false);
      return;
    }

    if (!user.is_active) {
      sendResponse(
        res,
        403,
        "Your account has been disabled by the administrator",
        false
      );
      return;
    }

    req.user = user;
    req.sessionToken = sessionToken;
    next();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("JWT verification error:", errorMessage);
    sendResponse(res, 401, "Unauthorized! please login first.", false);
    return;
  }
};

/**
 * Role-based authorization factory
 * Runs authMiddleware first (with Redis caching + is_deleted check),
 * then verifies the user has one of the allowed roles.
 *
 * Usage: router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN))
 */
export const requireRole = (...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run authMiddleware first
    await authMiddleware(req, res, () => {
      // After auth passes, check role
      const user = req.user;
      if (!user || !roles.includes(user.role as UserRole)) {
        sendResponse(
          res,
          403,
          "You are not authorized to perform this action",
          false
        );
        return;
      }
      next();
    });
  };
};

/** Pre-built middleware for admin-level roles */
export const requireAdmin = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.SUPER_SUB_ADMIN,
  UserRole.ADMIN,
  UserRole.SUB_ADMIN
);

/** Pre-built middleware for teacher role */
export const requireTeacher = requireRole(UserRole.TEACHER);

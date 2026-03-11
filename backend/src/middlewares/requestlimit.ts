import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { NextFunction, Request, Response } from "express";
import { sendResponse } from "../utils/helperFunctions/responseHelper";

/**
 * Get client IP address, handling proxies
 */
const getClientIp = (req: Request): string => {
  // Trust X-Forwarded-For only if behind a trusted proxy
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor && process.env.TRUST_PROXY === "true") {
    const forwardedChain = Array.isArray(forwardedFor)
      ? forwardedFor.join(",")
      : forwardedFor;
    const ips = forwardedChain
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    const trustedIp = ips[ips.length - 1];
    if (trustedIp) {
      return trustedIp;
    }
  }
  return req.ip || "unknown";
};

/**
 * Resolve retry-after in seconds from response headers or request rate-limit metadata.
 */
const getRetryAfterSeconds = (
  req: Request,
  res: Response,
  windowMs: number
): number => {
  const retryAfter = res.getHeader("Retry-After");
  const parsed =
    typeof retryAfter === "number"
      ? retryAfter
      : typeof retryAfter === "string"
        ? parseInt(retryAfter, 10)
        : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const resetTime = (
    req as Request & { rateLimit?: { resetTime?: Date | string | number } }
  ).rateLimit?.resetTime;

  if (resetTime) {
    const resetAt = new Date(resetTime).getTime();
    if (Number.isFinite(resetAt)) {
      const remainingSeconds = Math.ceil((resetAt - Date.now()) / 1000);
      if (remainingSeconds > 0) {
        return remainingSeconds;
      }
    }
  }

  return Math.ceil(windowMs / 1000);
};

const getLoginAccountKey = (req: Request): string => {
  const email = req.body?.email?.toLowerCase() || "unknown";
  return `login:${email}`;
};

const FAILED_LOGIN_SHORT_BLOCK_MS = 60 * 1000;
const FAILED_LOGIN_LONG_BLOCK_MS = 15 * 60 * 1000;
const FAILED_LOGIN_ATTEMPTS_PER_CYCLE = 3;
const FAILED_LOGIN_SHORT_CYCLES_BEFORE_LONG = 3;
const FAILED_LOGIN_STATE_TTL_MS = 30 * 60 * 1000;
const FAILED_LOGIN_MAX_TRACKED_KEYS = 10_000;

type FailedLoginBlockLevel = "none" | "short" | "long";

type FailedLoginState = {
  attempts: number;
  blockedUntil: number;
  updatedAt: number;
  lastBlockLevel: FailedLoginBlockLevel;
};

type FailedLoginResult = {
  attempts: number;
  retryAfter: number | null;
  isLongBlock: boolean;
};

const failedLoginByIp = new Map<string, FailedLoginState>();
const getFailedLoginIpKey = (req: Request): string => `failed-login:${getClientIp(req)}`;

const getFailedLoginRetryAfter = (blockedUntil: number): number =>
  Math.ceil((blockedUntil - Date.now()) / 1000);

const cleanupFailedLoginEntries = (): void => {
  const now = Date.now();

  for (const [key, state] of failedLoginByIp.entries()) {
    const isExpired = state.blockedUntil <= now;
    const isStale = now - state.updatedAt > FAILED_LOGIN_STATE_TTL_MS;
    if (isExpired && isStale) {
      failedLoginByIp.delete(key);
    }
  }

  while (failedLoginByIp.size > FAILED_LOGIN_MAX_TRACKED_KEYS) {
    const oldestKey = failedLoginByIp.keys().next().value;
    if (!oldestKey) {
      break;
    }
    failedLoginByIp.delete(oldestKey);
  }
};

const failedLoginCleanupInterval = setInterval(
  cleanupFailedLoginEntries,
  5 * 60 * 1000
);
if (typeof failedLoginCleanupInterval.unref === "function") {
  failedLoginCleanupInterval.unref();
}

export const failedLoginIpBlocker = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key = getFailedLoginIpKey(req);
  const state = failedLoginByIp.get(key);

  if (!state) {
    next();
    return;
  }

  const retryAfter = getFailedLoginRetryAfter(state.blockedUntil);
  if (retryAfter <= 0) {
    if (state.lastBlockLevel === "long") {
      // Long block finished: start a fresh cycle for future failed attempts.
      failedLoginByIp.delete(key);
    }
    next();
    return;
  }

  sendResponse(
    res,
    429,
    `Too many failed login attempts. Please try again in ${retryAfter} seconds.`,
    false,
    { retryAfter }
  );
};

export const registerFailedLoginAttempt = (req: Request): FailedLoginResult => {
  const key = getFailedLoginIpKey(req);
  const now = Date.now();
  const existing = failedLoginByIp.get(key);
  const isExpired = !!existing && existing.blockedUntil <= now;
  const isStale = !!existing && now - existing.updatedAt > FAILED_LOGIN_STATE_TTL_MS;
  const shouldRestartCycle = !!existing && isExpired && existing.lastBlockLevel === "long";
  const shouldResetForStaleState = !!existing && isStale;

  const baseAttempts =
    shouldRestartCycle || shouldResetForStaleState ? 0 : (existing?.attempts || 0);
  const attempts = baseAttempts + 1;

  let blockMs = 0;
  let blockLevel: FailedLoginBlockLevel = "none";
  let isLongBlock = false;
  const completedCycles = Math.floor(attempts / FAILED_LOGIN_ATTEMPTS_PER_CYCLE);
  const reachedCycleBoundary = attempts % FAILED_LOGIN_ATTEMPTS_PER_CYCLE === 0;

  if (reachedCycleBoundary && completedCycles > 0) {
    const cycleLength = FAILED_LOGIN_SHORT_CYCLES_BEFORE_LONG + 1;
    const isLongCycle = completedCycles % cycleLength === 0;

    if (isLongCycle) {
      isLongBlock = true;
      blockLevel = "long";
      blockMs = FAILED_LOGIN_LONG_BLOCK_MS;
    } else {
      blockLevel = "short";
      blockMs = FAILED_LOGIN_SHORT_BLOCK_MS;
    }
  }
  const blockedUntil = blockMs > 0 ? now + blockMs : now;

  failedLoginByIp.set(key, {
    attempts,
    blockedUntil,
    updatedAt: now,
    lastBlockLevel: blockLevel,
  });

  return {
    attempts,
    retryAfter: blockMs > 0 ? Math.ceil(blockMs / 1000) : null,
    isLongBlock,
  };
};

export const clearFailedLoginAttempts = (req: Request): void => {
  failedLoginByIp.delete(getFailedLoginIpKey(req));
};

/**
 * Standard response for rate limit exceeded
 */
const rateLimitResponse = (req: Request, res: Response) => {
  const ip = getClientIp(req);
  console.warn(`Rate limit exceeded for IP: ${ip}, Path: ${req.path}`);

  sendResponse(res, 429, "Too many requests. Please try again later.", false, {
    retryAfter: getRetryAfterSeconds(req, res, 60 * 1000),
  });
};

/**
 * General API rate limiter
 * 100 requests per 60 seconds per IP
 * KEY: general:<ip>
 */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `general:${getClientIp(req)}`,
  handler: rateLimitResponse,
  skip: (req) => {
    // Skip health check endpoint
    return req.path === "/health";
  },
});

/**
 * Strict auth rate limiter for sensitive endpoints
 * 5 attempts per 60 seconds per IP
 * Use for: login, signup, forgot-password, reset-password
 * KEY: auth:<ip> (SEPARATE from general limiter)
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 5, // Only 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `auth:${getClientIp(req)}`,
  message: {
    status: 429,
    success: false,
    message: "Too many authentication attempts. Please try again in 60 seconds.",
  },
  handler: (req: Request, res: Response) => {
    const ip = getClientIp(req);
    console.warn(`Auth rate limit exceeded for IP: ${ip}, Path: ${req.path}`);

    sendResponse(
      res,
      429,
      "Too many authentication attempts. Please try again in 60 seconds.",
      false,
      { retryAfter: getRetryAfterSeconds(req, res, 60 * 1000) }
    );
  },
});

/**
 * OTP/Verification rate limiter
 * 3 attempts per 60 seconds
 * Use for: resend-otp, verify-email, verify-otp
 * KEY: otp:<ip> (SEPARATE from auth limiter)
 */
export const otpLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 3, // Only 3 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `otp:${getClientIp(req)}`,
  handler: (req: Request, res: Response) => {
    const ip = getClientIp(req);
    console.warn(`OTP rate limit exceeded for IP: ${ip}, Path: ${req.path}`);

    sendResponse(res, 429, "Too many OTP requests. Please try again in 60 seconds.", false, {
      retryAfter: getRetryAfterSeconds(req, res, 60 * 1000),
    });
  },
});

/**
 * Password reset rate limiter
 * 3 attempts per 60 seconds
 * KEY: password:<ip> (SEPARATE from other limiters)
 */
export const passwordResetLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 3, // Only 3 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `password:${getClientIp(req)}`,
  handler: (req: Request, res: Response) => {
    const ip = getClientIp(req);
    console.warn(
      `Password reset rate limit exceeded for IP: ${ip}, Path: ${req.path}`
    );

    sendResponse(
      res,
      429,
      "Too many password reset attempts. Please try again in 60 seconds.",
      false,
      { retryAfter: getRetryAfterSeconds(req, res, 60 * 1000) }
    );
  },
});

/**
 * File upload rate limiter
 * 10 uploads per 60 seconds
 * KEY: upload:<ip> (SEPARATE from other limiters)
 */
export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `upload:${getClientIp(req)}`,
  handler: (req: Request, res: Response) => {
    sendResponse(res, 429, "Too many file uploads. Please try again in 60 seconds.", false);
  },
});

/**
 * Per-user rate limiter for authenticated endpoints
 * 200 requests per 60 seconds per user
 * Falls back to IP if user not authenticated
 * KEY: user:<userId> or user:ip:<ip>
 */
export const userLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    const userId = (req as Request & { user?: { id: number } }).user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    return `user:ip:${getClientIp(req)}`;
  },
  handler: (req: Request, res: Response) => {
    const userId = (req as Request & { user?: { id: number } }).user?.id;
    const identifier = userId ? `User ID: ${userId}` : `IP: ${getClientIp(req)}`;
    console.warn(`User rate limit exceeded for ${identifier}, Path: ${req.path}`);

    sendResponse(res, 429, "Too many requests. Please slow down.", false, {
      retryAfter: getRetryAfterSeconds(req, res, 60 * 1000),
    });
  },
});

/**
 * Strict per-user rate limiter for sensitive write operations
 * 30 requests per 60 seconds per user
 * Use for: create, update, delete operations
 * KEY: user-write:<userId> or user-write:ip:<ip>
 */
export const userWriteLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as Request & { user?: { id: number } }).user?.id;
    if (userId) {
      return `user-write:${userId}`;
    }
    return `user-write:ip:${getClientIp(req)}`;
  },
  handler: (req: Request, res: Response) => {
    const userId = (req as Request & { user?: { id: number } }).user?.id;
    const identifier = userId ? `User ID: ${userId}` : `IP: ${getClientIp(req)}`;
    console.warn(`User write rate limit exceeded for ${identifier}, Path: ${req.path}`);

    sendResponse(res, 429, "Too many write operations. Please slow down.", false, {
      retryAfter: getRetryAfterSeconds(req, res, 60 * 1000),
    });
  },
});

/**
 * Login attempt limiter per account (email)
 * Prevents brute force attacks on specific accounts
 * 5 attempts per 60 seconds per email
 * KEY: login:<email>
 */
export const loginAccountLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getLoginAccountKey(req),
  handler: (req: Request, res: Response) => {
    const email = req.body?.email || "unknown";
    console.warn(`Login account limit exceeded for email: ${email}`);

    sendResponse(
      res,
      429,
      "Too many login attempts for this account. Please try again in 60 seconds.",
      false,
      { retryAfter: getRetryAfterSeconds(req, res, 60 * 1000) }
    );
  },
});

// Default export for backward compatibility
export default generalLimiter;

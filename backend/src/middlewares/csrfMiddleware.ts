import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const AUTH_COOKIE_NAMES = ["accessToken", "sessionToken"];

// Public auth bootstrap endpoints where CSRF should not block initial access.
// NOTE: validateCsrfToken is mounted at "/api/v1", so paths are relative to that prefix.
const CSRF_EXEMPT_PATHS = new Set([
  "/auth/login-user",
  "/auth/google-login",
  "/auth/login-admin",
  "/auth/admin-signup",
  "/auth/forget-password",
  "/auth/reset-password",
  "/auth/resend-token",
  "/auth/resend-verification",
]);

// Generate CSRF token
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

// Middleware to set CSRF token cookie
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Only set if not already present
  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript for double-submit pattern
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // Security: Use strict in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
  next();
};

// Middleware to validate CSRF token
export const validateCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip CSRF check for safe methods
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip explicit auth bootstrap endpoints.
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  // Skip CSRF for Bearer token authentication (mobile apps, external APIs, Swagger).
  const authHeader = req.headers.authorization;
  if (authHeader && /^bearer\s+/i.test(authHeader)) {
    return next();
  }

  // Skip CSRF for Swagger UI requests (identified by referer)
  const referer = req.headers.referer || "";
  if (referer.includes("/api-docs")) {
    return next();
  }

  // CSRF primarily protects cookie-authenticated flows.
  // If no auth cookies are present, skip CSRF validation.
  const hasAuthCookie = AUTH_COOKIE_NAMES.some((cookieName) => Boolean(req.cookies?.[cookieName]));
  if (!hasAuthCookie) {
    return next();
  }



  // Get CSRF token from cookie and header
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  // Validate tokens exist and match
  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing",
    });
  }

  // Constant-time comparison to prevent timing attacks
  // Must check length first as timingSafeEqual throws on length mismatch
  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (cookieBuf.length !== headerBuf.length ||
      !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    return res.status(403).json({
      success: false,
      message: "CSRF token invalid",
    });
  }

  next();
};

// Regenerate CSRF token (call after login/logout for security)
export const regenerateCsrfToken = (res: Response): string => {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript for double-submit pattern
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // Security: Use strict in production
    maxAge: 24 * 60 * 60 * 1000,
  });
  return token;
};

// Combined middleware for routes that need both set and validate
export const csrfProtection = [setCsrfToken, validateCsrfToken];

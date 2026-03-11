import { Request, Response, CookieOptions } from "express";
import asyncHandler from "../../middlewares/trycatch";
import { validateRequest } from "../../validations";
import {
  loginSchema,
  googleLoginSchema,
  adminSignupSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "../../validations/auth.validation";
import { sendResponse } from "../../utils/helperFunctions/responseHelper";
import { authService, AuthError } from "../../services";
import { sendForgotPasswordEmail } from "../../utils/services/nodemailer/forgetPassword";
import { sessionService } from "../../services/session.service";
import { activityLogger } from "../../utils/services/activityLogger";
import {
  clearFailedLoginAttempts,
  registerFailedLoginAttempt,
} from "../../middlewares/requestlimit";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 24 * 60 * 60 * 1000, // 1 day
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
};

// Session cookie options (2 days)
const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
};

/**
 * Student/Teacher Login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { social_id } = req.body || {};

  try {
    // Parse device info from request
    const deviceInfo = sessionService.parseDeviceInfo(
      req.headers["user-agent"],
      req.ip || req.socket.remoteAddress,
      req.headers["sec-ch-ua"] as string | undefined
    );

    let result;

    if (social_id) {
      // Social login
      result = await authService.socialLogin(req.body, deviceInfo);
    } else {
      // Traditional login
      const validated = validateRequest(loginSchema, req.body, res);
      if (!validated) {
        return;
      }
      result = await authService.login(validated, deviceInfo);
    }

    clearFailedLoginAttempts(req);

    res.cookie("accessToken", result.accessToken, cookieOptions);
    res.cookie("sessionToken", result.sessionToken, sessionCookieOptions);
    return sendResponse(res, 200, "Login successful", true, result);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      if (
        !social_id &&
        (error.statusCode === 400 || error.statusCode === 401) &&
        error.message.toLowerCase().includes("invalid email or password")
      ) {
        const failedLoginState = registerFailedLoginAttempt(req);
        if (failedLoginState.retryAfter !== null) {
          return sendResponse(
            res,
            429,
            `Too many failed login attempts. Please try again in ${failedLoginState.retryAfter} seconds.`,
            false,
            { retryAfter: failedLoginState.retryAfter }
          );
        }
      }
      return sendResponse(res, error.statusCode, error.message, false, error.data);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Google SSO Login (Student/Teacher)
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const validated = validateRequest(googleLoginSchema, req.body, res);
  if (!validated) {
    return;
  }

  try {
    const deviceInfo = sessionService.parseDeviceInfo(
      req.headers["user-agent"],
      req.ip || req.socket.remoteAddress
    );

    const result = await authService.googleLogin(validated, deviceInfo);

    res.cookie("accessToken", result.accessToken, cookieOptions);
    res.cookie("sessionToken", result.sessionToken, sessionCookieOptions);
    return sendResponse(res, 200, "Google login successful", true, result);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false, error.data);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Admin/SubAdmin Login
 */
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const validated = validateRequest(loginSchema, req.body, res);
  if (!validated) {
    return;
  }

  try {
    // Parse device info from request
    const deviceInfo = sessionService.parseDeviceInfo(
      req.headers["user-agent"],
      req.ip || req.socket.remoteAddress,
      req.headers["sec-ch-ua"] as string | undefined
    );

    const result = await authService.adminLogin(validated, deviceInfo);
    clearFailedLoginAttempts(req);

    await activityLogger.logAuth(req, "LOGIN", {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    res.cookie("accessToken", result.accessToken, cookieOptions);
    res.cookie("sessionToken", result.sessionToken, sessionCookieOptions);
    return sendResponse(res, 200, "Login successful", true, result);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      if (
        (error.statusCode === 400 || error.statusCode === 401) &&
        error.message.toLowerCase().includes("invalid email or password")
      ) {
        const failedLoginState = registerFailedLoginAttempt(req);
        if (failedLoginState.retryAfter !== null) {
          return sendResponse(
            res,
            429,
            `Too many failed login attempts. Please try again in ${failedLoginState.retryAfter} seconds.`,
            false,
            { retryAfter: failedLoginState.retryAfter }
          );
        }
      }
      await activityLogger.logAuth(req, "LOGIN", {
        email: validated.email,
        status: "failure",
        errorMessage: error.message,
      });
      return sendResponse(res, error.statusCode, error.message, false, error.data);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Admin Signup - Step 1 of school registration
 */
export const adminSignup = asyncHandler(async (req: Request, res: Response) => {
  const validated = validateRequest(adminSignupSchema, req.body, res);
  if (!validated) {
    return;
  }

  try {
    const result = await authService.adminSignup(validated);
    return sendResponse(
      res,
      201,
      "Account created. Please check your email to verify your account.",
      true,
      result
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error("Admin signup error:", error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Forgot Password
 */
export const forgetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return sendResponse(res, 401, "Please provide a valid email", false);
  }

  try {
    const user = await authService.forgotPassword(email);
    await sendForgotPasswordEmail(user);
    return sendResponse(res, 200, "Password reset email sent successfully.", true);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Change Password (authenticated user)
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const validated = validateRequest(changePasswordSchema, req.body, res);
  if (!validated) {
    return;
  }

  const userId = req.user?.id;
  const currentSessionToken = req.sessionToken;

  if (!userId) {
    return sendResponse(res, 401, "Unauthorized", false);
  }

  try {
    const result = await authService.changePassword(userId, validated, currentSessionToken);

    return sendResponse(res, 200, "Password changed successfully", true, {
      showSessionModal: result.showSessionModal,
      otherSessionCount: result.otherSessionCount,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Reset Password
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const validated = validateRequest(resetPasswordSchema, req.body, res);
  if (!validated) return;
  const { data, password } = validated;

  try {
    await authService.resetPassword(data, password);
    return sendResponse(res, 200, "Your password has been reset successfully.", true);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Verify Reset Token
 */
export const verifyResetToken = asyncHandler(async (req: Request, res: Response) => {
  const { data } = req.query;

  if (!data) {
    return sendResponse(res, 400, "Invalid reset link", false);
  }

  try {
    await authService.verifyResetToken(data as string);
    return sendResponse(res, 200, "Token is valid", true);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Verify Email
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { data } = req.query;

  if (!data) {
    return sendResponse(res, 400, "Invalid verification link", false);
  }

  try {
    const result = await authService.verifyEmail(data as string);
    return sendResponse(res, 200, "Email verified successfully", true, result);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error("Email verification error:", error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Resend Verification Email
 */
export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return sendResponse(res, 400, "Email is required", false);
  }

  try {
    await authService.resendVerificationEmail(email);
    return sendResponse(res, 200, "Verification email sent successfully", true);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return sendResponse(res, error.statusCode, error.message, false);
    }
    console.error("Resend verification error:", error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Resend OTP
 */
export const resendOTP = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "OTP Resent", true);
});

/**
 * Delete Account
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return sendResponse(res, 401, "Unauthorized", false);
  }

  try {
    await authService.deleteAccount(userId);
    return sendResponse(res, 200, "Account deleted successfully", true);
  } catch (error: unknown) {
    console.error(error);
    return sendResponse(res, 500, "Internal server error", false);
  }
});

/**
 * Logout
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const sessionToken = req.sessionToken || req.cookies?.sessionToken;

  await activityLogger.logAuth(req, "LOGOUT");

  // Invalidate the session in database
  if (sessionToken) {
    await sessionService.invalidateSessionByToken(sessionToken);
  }

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("sessionToken", sessionCookieOptions);
  sendResponse(res, 200, "Logged out successfully", true);
});

/**
 * Check Session
 */
export const checkSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return sendResponse(res, 401, "Unauthorized! Please login again.", false);
  }

  try {
    const userData = await authService.getSessionData(req.user);
    return sendResponse(res, 200, "Session is valid", true, userData);
  } catch (error: unknown) {
    console.error("Check session error:", error);
    return sendResponse(res, 401, "Session expired. Please login again.", false);
  }
});

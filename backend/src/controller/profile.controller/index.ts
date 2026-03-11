import { Request, Response } from "express";
import fs from "fs";
import asyncHandler from "../../middlewares/trycatch";
import db from "../../config/db";
import { TABLE } from "../../utils/Database/table";
import { sendResponse } from "../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../utils/enums/users.enum";
import { validateRequest } from "../../validations";
import { requestEmailChangeSchema, confirmEmailChangeSchema, deleteAccountSchema } from "../../validations/auth.validation";
import { generateOTP } from "../../utils/helperFunctions/otpGenerator";
import { storeEmailChangeOTP, verifyEmailChangeOTP, markEmailChangeOTPAsUsed, deleteEmailChangeOTP } from "../../utils/helperFunctions/emailChangeHelper";
import { sendEmailChangeOTPEmail } from "../../utils/services/nodemailer/emailChange";
import { sessionService } from "../../services/session.service";
import { userService } from "../../services/user.service";
import { invalidateUser } from "../../utils/services/redis/cacheInvalidation";
import { getErrorMessage } from "../../utils/helperFunctions/errorHelper";

/**
 * Get user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Fetch user with role
    const user = await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
      .where(`${TABLE.USERS}.id`, userId)
      .first();

    if (!user) {
      sendResponse(res, 400, "User account not found", false);
      return;
    }

    // Fetch Profile based on role
    let profileData = {};
    if (user.role === UserRole.STUDENT) {
        profileData = await db(TABLE.STUDENTS).where({ user_id: userId }).first() || {};
    } else {
        // Assume Staff/Teacher/Admin
        profileData = await db(TABLE.STAFF).where({ user_id: userId }).first() || {};
    }

    // Combine data
    const fullProfile = {
        ...user,
        ...profileData, // Overwrites fields like first_name if they exist in user (they don't anymore)
    };

    // Remove password hash
    delete fullProfile.password_hash;
    delete fullProfile.password; // Just in case

    // Handle Image URL from users table
    if (fullProfile.avatar_url) {
      fullProfile.avatar_url = process.env.BASE_URL + fullProfile.avatar_url;
    }

    sendResponse(res, 200, "Profile fetched successfully", true, fullProfile);
  } catch (error) {
    console.error("Error get profile:", error);
    sendResponse(res, 500, "Failed to get profile.", false);
    return;
  }
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
      // Fetch user with role
      const user = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, userId)
        .first();

      if (!user) {
        sendResponse(res, 404, "User not found", false);
        return;
      }

      // Extract updated fields
      const { first_name, last_name, bio } = req.body;

      // Handle profile image if uploaded
      let avatarUrl = "";
      if (req.file) {
        // Delete old image if exists
        if (user.avatar_url) {
          try {
            fs.unlinkSync(`public${user.avatar_url}`);
          } catch(e) { /* ignore */ }
        }

        avatarUrl = "/user/" + req.file.filename;
      }

      // Update users table (avatar, first_name, last_name for all users)
      const userUpdates: Record<string, unknown> = {};
      if (avatarUrl) userUpdates.avatar_url = avatarUrl;
      if (first_name) userUpdates.first_name = first_name;
      if (last_name) userUpdates.last_name = last_name;

      if (Object.keys(userUpdates).length > 0) {
        await db(TABLE.USERS).where({ id: userId }).update(userUpdates);
      }

      // Update profile data based on role (only bio for students)
      if (user.role === UserRole.STUDENT) {
          // Students can also update bio in students table
          if (bio !== undefined) {
              await db(TABLE.STUDENTS).where({ user_id: userId }).update({ bio });
          }
      }
      // Staff/Admin - no additional fields to update (first_name, last_name are in users table)

      // Fetch updated profile
      const updatedUser = await db(TABLE.USERS)
        .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
        .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
        .where(`${TABLE.USERS}.id`, userId)
        .first();

      let updatedProfileData = {};
      if (user.role === UserRole.STUDENT) {
          updatedProfileData = await db(TABLE.STUDENTS).where({ user_id: userId }).first() || {};
      } else {
          updatedProfileData = await db(TABLE.STAFF).where({ user_id: userId }).first() || {};
      }

      const updatedProfile = {
          ...updatedUser,
          ...updatedProfileData,
      };
      delete updatedProfile.password_hash;

      if (updatedProfile.avatar_url) {
          updatedProfile.avatar_url = process.env.BASE_URL + updatedProfile.avatar_url;
      }

      await invalidateUser(userId!);
      sendResponse(res, 200, "Profile updated successfully", true, updatedProfile);
    } catch (err) {
      console.error("Error updating profile:", err);
      sendResponse(res, 500, "Failed to update profile", false, err);
    }
  }
);

/**
 * Update profile image
 */
export const updateProfileImage = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
      // Check if file was uploaded
      if (!req.file) {
        sendResponse(res, 400, "No image file provided", false);
        return;
      }

      // Fetch current user to get old avatar
      const user = await db(TABLE.USERS)
        .select("avatar_url")
        .where({ id: userId })
        .first();

      if (!user) {
        sendResponse(res, 404, "User not found", false);
        return;
      }

      // Delete old image if exists
      if (user.avatar_url) {
        try {
          fs.unlinkSync(`public${user.avatar_url}`);
        } catch (e) {
          /* ignore - file might not exist */
        }
      }

      // Save new avatar URL
      const avatarUrl = "/user/" + req.file.filename;

      // Update user's avatar in database
      await db(TABLE.USERS).where({ id: userId }).update({ avatar_url: avatarUrl });

      const fullAvatarUrl = process.env.BASE_URL + avatarUrl;

      await invalidateUser(userId!);
      sendResponse(res, 200, "Profile image updated successfully", true, {
        avatar_url: fullAvatarUrl,
      });
    } catch (err) {
      console.error("Error updating profile image:", err);
      sendResponse(res, 500, "Failed to update profile image", false);
    }
  }
);

/**
 * Request email change - sends OTP to current email
 */
export const requestEmailChange = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate request body
  const validated = validateRequest(requestEmailChangeSchema, req.body, res);
  if (!validated) {
    return;
  }

  // 2. Get authenticated user (from authMiddleware)
  const user = req.user!;

  // 3. Normalize and validate new email
  const newEmail = req.body.new_email.toLowerCase().trim();

  // 3.1 Check if new email is same as current email
  if (newEmail === user.email.toLowerCase().trim()) {
    sendResponse(res, 400, "This is already your current email", false);
    return;
  }

  // 4. Check if new email already exists (case-insensitive, exclude current user)
  const existingUser = await db(TABLE.USERS)
    .whereRaw('LOWER(email) = ?', [newEmail])
    .whereNot('id', user.id)
    .first();

  if (existingUser) {
    sendResponse(res, 400, "Email already in use by another account", false);
    return;
  }

  // 5. Generate and store OTP
  const otp = generateOTP();
  await storeEmailChangeOTP(user.id, user.email, newEmail, otp, 10);

  // 6. Send OTP email
  try {
    await sendEmailChangeOTPEmail(user, newEmail, otp);
    sendResponse(res, 200, "OTP sent to your current email for verification", true);
  } catch (emailError) {
    // If email fails, delete the OTP
    await deleteEmailChangeOTP(user.id);
    sendResponse(res, 500, "Failed to send OTP email. Please try again.", false);
    return;
  }
});

/**
 * Confirm email change - verifies OTP and updates email
 */
export const confirmEmailChange = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate request body
  const validated = validateRequest(confirmEmailChangeSchema, req.body, res);
  if (!validated) {
    return;
  }

  // 2. Get authenticated user
  const user = req.user!;
  const currentSessionToken = req.sessionToken;
  const { new_email, otp } = req.body;
  const newEmail = new_email.toLowerCase().trim();

  // 3. Verify OTP
  const otpVerification = await verifyEmailChangeOTP(user.id, otp, newEmail);
  if (!otpVerification.valid) {
    sendResponse(res, 400, otpVerification.error || "Invalid OTP", false);
    return;
  }

  // 4. Use database transaction to prevent race conditions
  try {
    await db.transaction(async (trx) => {
      // Check email availability again (race condition protection, exclude current user)
      const existingUser = await trx(TABLE.USERS)
        .whereRaw('LOWER(email) = ?', [newEmail])
        .whereNot('id', user.id)
        .first();

      if (existingUser) {
        throw new Error("Email already in use");
      }

      // Update user email
      await trx(TABLE.USERS)
        .where({ id: user.id })
        .update({
          email: newEmail,
          updated_at: new Date()
        });
    });

    await markEmailChangeOTPAsUsed(user.id, otp);
    await invalidateUser(user.id);

    const totalSessions = await sessionService.countActiveSessions(user.id);
    const otherSessionCount = currentSessionToken ? totalSessions - 1 : totalSessions;

    sendResponse(res, 200, "Email changed successfully", true, {
      user: {
        id: user.id,
        email: newEmail,
        role: user.role
      },
      showSessionModal: otherSessionCount > 0,
      otherSessionCount,
    });

  } catch (error: unknown) {
    if (getErrorMessage(error) === "Email already in use") {
      sendResponse(res, 400, "Email already in use", false);
    } else {
      console.error("Email change error:", error);
      sendResponse(res, 500, "Failed to change email. Please try again.", false);
    }
  }
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  try {
    // 1. Validate request body
    const validated = validateRequest(deleteAccountSchema, req.body, res);
    if (!validated) {
      return;
    }

    const user = req.user!;
    const { password } = req.body;

    if (user.role === UserRole.SUPER_ADMIN) {
      sendResponse(res, 403, "Super admin cannot delete their own account", false);
      return;
    }

    await userService.softDeleteAccount(
      user.id,
      password,
      user.role || ''
    );

    await sessionService.invalidateAllSessions(user.id);

    sendResponse(
      res,
      200,
      "Your account has been deleted successfully",
      true
    );
  } catch (error: unknown) {
    console.error("Delete account error:", error);

    if (error instanceof Error && "statusCode" in error) {
      const err = error as Error & { statusCode: number };
      sendResponse(res, err.statusCode, err.message, false);
    } else {
      sendResponse(res, 500, "Failed to delete account. Please try again.", false);
    }
  }
});
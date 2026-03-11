import bcrypt from "bcryptjs";
import axios from "axios";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { getSignedJwt } from "../utils/services/jwt";
import { sendEmailVerificationLink } from "../utils/services/nodemailer/verifyEmail";
import { decryptData, encryptData } from "../utils/helperFunctions/encryptionHelper";
import { getUserPermissionsMap } from "../middlewares/permissionMiddleware";
import { sessionService, DeviceInfo } from "./session.service";
import {
  LoginDTO,
  SocialLoginDTO,
  GoogleLoginDTO,
  AdminLoginDTO,
  AdminSignupDTO,
  ChangePasswordDTO,
  LoginResponse,
  AdminLoginResponse,
  AuthUserResponse,
  ChangePasswordResponse,
} from "../dto/auth.dto";
import { User } from "../utils/types/auth";
import { AuthError } from "../utils/errors";

/**
 * AuthService - Handles all authentication business logic
 */
export class AuthService {

  // Security: Increased from 10 to 12 for better protection against brute force
  private readonly SALT_ROUNDS = 12;


  /**
   * Student/Teacher Login
   */
  async login(data: LoginDTO, deviceInfo: DeviceInfo): Promise<LoginResponse> {
    const { email, password } = data;

    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new AuthError("Invalid email or password", 400);
    }

    // Only students and teachers can use this login
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.STUDENT) {
      throw new AuthError("Invalid email or password", 400);
    }

    if (!user.is_active) {
      throw new AuthError("Your account is inactive.", 403);
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AuthError("Invalid email or password", 400);
    }

    const accessToken = getSignedJwt(user.id);
    const sessionToken = await sessionService.createSession(user.id, deviceInfo);
    const sanitizedUser = this.sanitizeUser(user);

    return { accessToken, sessionToken, user: sanitizedUser };
  }

  /**
   * Social Login (Google, etc.)
   */
  async socialLogin(data: SocialLoginDTO, deviceInfo: DeviceInfo): Promise<LoginResponse> {
    const { social_id, email } = data;

    let user = await this.findUserBySocialId(social_id);

    if (!user) {
      // Create new social user
      user = await this.createSocialUser(social_id, email);
    }

    if (!user.is_active) {
      throw new AuthError("Your account is inactive.", 403);
    }

    const accessToken = getSignedJwt(user.id);
    const sessionToken = await sessionService.createSession(user.id, deviceInfo);
    const sanitizedUser = this.sanitizeUser(user);

    return { accessToken, sessionToken, user: sanitizedUser };
  }

  /**
   * Google SSO Login
   * Verifies Google ID token, then signs-in an existing linked account only.
   */
  async googleLogin(data: GoogleLoginDTO, deviceInfo: DeviceInfo): Promise<LoginResponse> {
    const payload = await this.verifyGoogleIdToken(data.id_token);

    if (!payload.sub) {
      throw new AuthError("Invalid Google token subject", 401);
    }

    if (!payload.email) {
      throw new AuthError("Google account email not available", 400);
    }

    if (!payload.email_verified) {
      throw new AuthError("Google email is not verified", 400);
    }

    let user = await this.findUserByGoogleId(payload.sub);

    if (!user) {
      throw new AuthError("Google account is not registered. Please sign up first.", 404);
    }

    if (user.role !== UserRole.STUDENT && user.role !== UserRole.TEACHER) {
      throw new AuthError("Google login is only available for student/teacher accounts", 403);
    }

    if (!user.is_active) {
      throw new AuthError("Your account is inactive.", 403);
    }

    const accessToken = getSignedJwt(user.id);
    const sessionToken = await sessionService.createSession(user.id, deviceInfo);
    const sanitizedUser = this.sanitizeUser(user);

    return { accessToken, sessionToken, user: sanitizedUser };
  }



  /**
   * Admin/SubAdmin Login
   */
  async adminLogin(data: AdminLoginDTO, deviceInfo: DeviceInfo): Promise<AdminLoginResponse> {
    const { email, password } = data;

    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new AuthError("Invalid email or password", 400);
    }

    // Only admins can use this login
    const adminRoles = [UserRole.SUPER_ADMIN, UserRole.SUPER_SUB_ADMIN, UserRole.ADMIN, UserRole.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      throw new AuthError("Invalid email or password", 400);
    }

    if (!user.is_active) {
      throw new AuthError("Your account is inactive.", 403);
    }

    // Check email verification for admin role
    if (user.role === UserRole.ADMIN && !user.email_verified) {
      throw new AuthError("Please verify your email before logging in.", 403, {
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AuthError("Invalid email or password", 400);
    }

    // Get permissions for Admin, Sub-Admin, and Super Sub-Admin
    let permissions = null;
    if (user.role === UserRole.SUPER_SUB_ADMIN || user.role === UserRole.ADMIN || user.role === UserRole.SUB_ADMIN) {
      permissions = await getUserPermissionsMap(user.id);
    }

    // Check school registration status for Admin
    const schoolStatus = await this.checkAdminSchoolStatus(user);

    const accessToken = getSignedJwt(user.id);
    const sessionToken = await sessionService.createSession(user.id, deviceInfo);
    const sanitizedUser = this.sanitizeUser(user, permissions);

    return {
      accessToken,
      sessionToken,
      user: sanitizedUser,
      ...schoolStatus,
    };
  }

  /**
   * Admin Signup - Step 1 of school registration
   */
  async adminSignup(data: AdminSignupDTO): Promise<{ user: AuthUserResponse }> {
    const { email, password, first_name, last_name } = data;

    // Check if email exists
    const existingUser = await db(TABLE.USERS).where({ email }).first();
    if (existingUser) {
      throw new AuthError("Email already registered", 400);
    }

    // Get admin role
    const adminRole = await db(TABLE.ROLES).where({ name: UserRole.ADMIN }).first();
    if (!adminRole) {
      throw new AuthError("Admin role not found", 500);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const [newUser] = await db(TABLE.USERS)
      .insert({
        email,
        password_hash: hashedPassword,
        first_name,
        last_name,
        role_id: adminRole.id,
        is_active: true,
        email_verified: false,
        school_id: null,
      })
      .returning(["id", "email", "first_name", "last_name"]);

    // Send verification email
    await sendEmailVerificationLink({
      email,
      firstName: first_name,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: UserRole.ADMIN,
        is_active: true,
        avatar_url: null,
        school_id: null,
      },
    };
  }

  /**
   * Forgot Password - Validate user exists and return user data
   */
  async forgotPassword(email: string): Promise<User> {
    const user = await db(TABLE.USERS).where({ email }).first();

    if (!user) {
      throw new AuthError("User not found with this email", 404);
    }

    return user;
  }

  /**
   * Reset Password
   */
  async resetPassword(encryptedData: string, newPassword: string): Promise<void> {
    // Security: Consistent password validation (matching auth.validation.ts)
    if (newPassword.length < 8) {
      throw new AuthError("Password must be at least 8 characters", 400);
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new AuthError("Password must contain at least one uppercase letter", 400);
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new AuthError("Password must contain at least one lowercase letter", 400);
    }
    if (!/\d/.test(newPassword)) {
      throw new AuthError("Password must contain at least one number", 400);
    }
    if (!/[@$!%*?&#]/.test(newPassword)) {
      throw new AuthError("Password must contain at least one special character (@$!%*?&#)", 400);
    }

    // Decrypt the data
    const decrypted = decryptData<{ email: string; token: string; exp: number }>(encryptedData);

    if (!decrypted) {
      throw new AuthError("Invalid or tampered reset link", 400);
    }

    const { email, token, exp } = decrypted;

    // Check if link has expired
    if (exp && Date.now() > exp) {
      throw new AuthError("Reset link has expired. Please request a new one.", 400);
    }

    // Find the reset token in database
    const resetRecord = await db(TABLE.PASSWORD_RESETS)
      .where({ email, token })
      .first();

    if (!resetRecord) {
      throw new AuthError("Invalid or expired reset link", 400);
    }

    // Check server-side expiry
    if (resetRecord.expires_at && new Date(resetRecord.expires_at) < new Date()) {
      await db(TABLE.PASSWORD_RESETS).where({ email, token }).del();
      throw new AuthError("Reset link has expired. Please request a new one.", 400);
    }

    // Check if already used
    if (resetRecord.used) {
      throw new AuthError("This reset link has already been used", 400);
    }

    // Find user and update password
    const user = await db(TABLE.USERS).where({ email }).first();
    if (!user) {
      throw new AuthError("Account not found", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await db(TABLE.USERS)
      .where({ id: user.id })
      .update({ password_hash: hashedPassword });

    // Delete the token
    await db(TABLE.PASSWORD_RESETS).where({ email, token }).del();
  }

  /**
   * Change Password (authenticated user)
   * Returns session info to show modal for logging out other devices
   */
  async changePassword(
    userId: number,
    data: ChangePasswordDTO,
    currentSessionToken?: string
  ): Promise<ChangePasswordResponse> {
    const { currentPassword, password } = data;

    const user = await db(TABLE.USERS).where({ id: userId }).first();

    if (!user) {
      throw new AuthError("Account not found", 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new AuthError("Current password is incorrect", 400);
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    await db(TABLE.USERS)
      .where({ id: userId })
      .update({ password_hash: hashedPassword });

    // Get count of other active sessions
    const totalSessions = await sessionService.countActiveSessions(userId);
    const otherSessionCount = currentSessionToken ? totalSessions - 1 : totalSessions;

    return {
      showSessionModal: otherSessionCount > 0,
      otherSessionCount,
    };
  }

  /**
   * Verify Email
   */
  async verifyEmail(encryptedData: string): Promise<{ hasSchool: boolean; email: string }> {
    const decrypted = decryptData<{ email: string; token: string; exp: number }>(encryptedData);

    if (!decrypted) {
      throw new AuthError("Invalid or tampered verification link", 400);
    }

    const { email, token, exp } = decrypted;

    // Check expiry
    if (exp && Date.now() > exp) {
      throw new AuthError("Verification link has expired. Please request a new one.", 400);
    }

    // Find token record
    const tokenRecord = await db(TABLE.EMAIL_VERIFICATION_TOKENS)
      .where({ email, token })
      .first();

    if (!tokenRecord) {
      throw new AuthError("Invalid or expired verification link", 400);
    }

    // Check server-side expiry
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      await db(TABLE.EMAIL_VERIFICATION_TOKENS).where({ email, token }).del();
      throw new AuthError("Verification link has expired. Please request a new one.", 400);
    }

    // Check if already used
    if (tokenRecord.used) {
      throw new AuthError("This verification link has already been used", 400);
    }

    // Find user
    const user = await db(TABLE.USERS).where({ email }).first();
    if (!user) {
      throw new AuthError("Account not found", 400);
    }

    // Update user's email_verified status
    await db(TABLE.USERS)
      .where({ id: user.id })
      .update({ email_verified: true });

    // Mark token as used
    await db(TABLE.EMAIL_VERIFICATION_TOKENS)
      .where({ email, token })
      .update({ used: true });

    return {
      hasSchool: !!user.school_id,
      email: user.email,
    };
  }

  /**
   * Resend Verification Email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await db(TABLE.USERS).where({ email }).first();

    if (!user) {
      throw new AuthError("Account not found with this email", 404);
    }

    if (user.email_verified) {
      throw new AuthError("Email is already verified", 400);
    }

    await sendEmailVerificationLink({
      email,
      firstName: user.first_name || "User",
    });
  }

  /**
   * Verify Reset Token
   */
  async verifyResetToken(encryptedData: string): Promise<boolean> {
    const decrypted = decryptData<{ email: string; token: string; exp: number }>(encryptedData);

    if (!decrypted) {
      throw new AuthError("Invalid or tampered reset link", 400);
    }

    const { email, token, exp } = decrypted;

    if (exp && Date.now() > exp) {
      throw new AuthError("Reset link has expired. Please request a new one.", 400);
    }

    const resetRecord = await db(TABLE.PASSWORD_RESETS)
      .where({ email, token })
      .first();

    if (!resetRecord) {
      throw new AuthError("Invalid or expired reset link", 400);
    }

    if (resetRecord.expires_at && new Date(resetRecord.expires_at) < new Date()) {
      await db(TABLE.PASSWORD_RESETS).where({ email, token }).del();
      throw new AuthError("Reset link has expired. Please request a new one.", 400);
    }

    if (resetRecord.used) {
      throw new AuthError("This reset link has already been used", 400);
    }

    return true;
  }

  /**
   * Delete Account
   */
  async deleteAccount(userId: number): Promise<void> {
    await db(TABLE.USERS).where({ id: userId }).delete();
  }

  /**
   * Get Session User Data
   */
  async getSessionData(user: User): Promise<AuthUserResponse> {
    // Get permissions for Super Sub-Admin, Admin and Sub-Admin
    let permissions = null;
    if (user.role === UserRole.SUPER_SUB_ADMIN || user.role === UserRole.ADMIN || user.role === UserRole.SUB_ADMIN) {
      permissions = await getUserPermissionsMap(user.id);
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role ?? "",
      is_active: user.is_active ?? false,
      school_id: user.school_id ?? null,
      avatar_url: user.avatar_url ? process.env.BASE_URL + user.avatar_url : null,
      ...(permissions && { permissions }),
    };
  }

  // ============ PRIVATE HELPER METHODS ============

  private async findUserByEmail(email: string) {
    return await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
      .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
      .select(
        `${TABLE.USERS}.*`, 
        `${TABLE.ROLES}.name as role`,
        `${TABLE.STAFF}.job_title_id`,
        `${TABLE.JOB_TITLES}.name as job_title_name`
      )
      .where({ [`${TABLE.USERS}.email`]: email })
      .where(`${TABLE.USERS}.is_deleted`, false)
      .first();
  }

  private async findUserBySocialId(socialId: string) {
    return await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .leftJoin(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
      .leftJoin(TABLE.JOB_TITLES, `${TABLE.STAFF}.job_title_id`, `${TABLE.JOB_TITLES}.id`)
      .select(
        `${TABLE.USERS}.*`, 
        `${TABLE.ROLES}.name as role`,
        `${TABLE.STAFF}.job_title_id`,
        `${TABLE.JOB_TITLES}.name as job_title_name`
      )
      .where({ 
        [`${TABLE.USERS}.social_id`]: socialId, 
        [`${TABLE.USERS}.is_active`]: true,
        [`${TABLE.USERS}.is_deleted`]: false 
      })
      .first();
  }

  private async findUserByGoogleId(googleId: string) {
    return await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .select(`${TABLE.USERS}.*`, `${TABLE.ROLES}.name as role`)
      .where({
        [`${TABLE.USERS}.google_id`]: googleId,
        [`${TABLE.USERS}.is_deleted`]: false,
      })
      .first();
  }

  private async verifyGoogleIdToken(idToken: string): Promise<{
    sub: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    picture?: string;
    aud?: string;
    exp?: string;
  }> {
    try {
      const { data } = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
        params: { id_token: idToken },
        timeout: 8000,
      });

      const aud = String(data.aud || "");
      const allowedClientIds = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (allowedClientIds.length > 0 && !allowedClientIds.includes(aud)) {
        throw new AuthError("Google token audience mismatch", 401);
      }

      if (data.exp && Number(data.exp) * 1000 < Date.now()) {
        throw new AuthError("Google token has expired", 401);
      }

      return {
        sub: String(data.sub || ""),
        email: data.email ? String(data.email) : undefined,
        email_verified: String(data.email_verified) === "true",
        given_name: data.given_name ? String(data.given_name) : undefined,
        family_name: data.family_name ? String(data.family_name) : undefined,
        picture: data.picture ? String(data.picture) : undefined,
        aud: aud || undefined,
        exp: data.exp ? String(data.exp) : undefined,
      };
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError("Invalid Google token", 401);
    }
  }

  private async createSocialUser(socialId: string, email?: string) {
    let first_name = "";
    let last_name = "";

    if (email) {
      const fullName = email.split("@")[0] ?? "";
      const nameParts = fullName.split(".");
      first_name = nameParts[0] ?? "";
      last_name = nameParts[1] ?? "";
    }

    const role = await db(TABLE.ROLES).where({ name: UserRole.STUDENT }).first();

    const [newUser] = await db(TABLE.USERS)
      .insert({
        email,
        social_id: socialId,
        role_id: role.id,
        first_name,
        last_name,
        is_active: true,
        email_verified: !!email,
      })
      .returning("*");

    return { ...newUser, role: UserRole.STUDENT };
  }

  private async checkAdminSchoolStatus(user: User) {
    if (user.role !== UserRole.ADMIN || user.school_id) {
      return {
        requiresSchoolSetup: false,
        schoolRequestStatus: null,
        rejectionReason: null,
        reregistrationToken: null,
      };
    }

    const existingRequest = await db(TABLE.SCHOOL_REQUESTS)
      .where({ admin_email: user.email })
      .orderBy("created_at", "desc")
      .first();

    if (!existingRequest) {
      return {
        requiresSchoolSetup: true,
        schoolRequestStatus: null,
        rejectionReason: null,
        reregistrationToken: null,
      };
    }

    if (existingRequest.status === "pending") {
      throw new AuthError(
        "Your school registration is pending approval. Please wait for admin review.",
        403,
        { schoolRequestStatus: "pending" }
      );
    }

    if (existingRequest.status === "rejected") {
      const reregistrationToken = encryptData({
        requestId: existingRequest.id,
        email: user.email,
        exp: Date.now() + 24 * 60 * 60 * 1000,
      });

      return {
        requiresSchoolSetup: false,
        schoolRequestStatus: "rejected",
        rejectionReason: existingRequest.rejection_reason,
        reregistrationToken,
      };
    }

    return {
      requiresSchoolSetup: false,
      schoolRequestStatus: existingRequest.status,
      rejectionReason: null,
      reregistrationToken: null,
    };
  }

  private sanitizeUser(user: User, permissions?: Record<string, Record<string, boolean>> | null): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role ?? "",
      is_active: user.is_active ?? false,
      avatar_url: user.avatar_url ? process.env.BASE_URL + user.avatar_url : null,
      school_id: user.school_id ?? null,
      job_title_id: (user as Record<string, unknown>).job_title_id as number | null ?? null,
      job_title_name: (user as Record<string, unknown>).job_title_name as string | null ?? null,
      permissions: permissions || null,
    };
  }
}

// Re-export AuthError from centralized errors for backward compatibility
export { AuthError } from "../utils/errors";

// Export singleton instance
export const authService = new AuthService();

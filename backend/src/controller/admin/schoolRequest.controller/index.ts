import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createSchoolRequestSchema,
  initiateSchoolRequestSchema,
  completeSchoolRequestSchema,
  reviewSchoolRequestSchema,
  reRegisterSchoolRequestSchema,
} from "../../../validations/schoolRequest.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";
import { insertDefaultPermissions } from "../../../middlewares/permissionMiddleware";
import { sendSchoolRequestRejectionEmail } from "../../../utils/services/nodemailer/schoolRequestRejection";
import { encryptData, decryptData } from "../../../utils/helperFunctions/encryptionHelper";
import transporter from "../../../utils/services/nodemailer";
import { notificationService } from "../../../services/notification.service";
import { activityLogger } from "../../../utils/services/activityLogger";
import { getErrorMessage } from "../../../utils/helperFunctions/errorHelper";
import { buildSearchTerm } from "../../../utils/helperFunctions/searchHelper";

/**
 * Step 1 - Initiate school registration (Public)
 */
export const initiateSchoolRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validated = validateRequest(initiateSchoolRequestSchema, req.body, res);
      if (!validated) {
        return;
      }

      const { admin_email, admin_first_name, admin_last_name, admin_password } = validated;

      // Check if email already exists in users table
      const existingUser = await db(TABLE.USERS).where({ email: admin_email }).first();
      if (existingUser) {
        sendResponse(res, 400, "Email already exists", false);
        return;
      }

      // Check if there's already a pending request with this email
      const existingRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ admin_email, status: "pending" })
        .first();

      if (existingRequest && existingRequest.email_verified) {
        sendResponse(res, 400, "You already have a pending request. Please complete school details.", false);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(admin_password, 10);

      // Generate verification token
      const verificationToken = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Delete any existing unverified requests for this email
      await db(TABLE.SCHOOL_REQUESTS)
        .where({ admin_email, email_verified: false })
        .del();

      // Delete any existing tokens for this email
      await db(TABLE.EMAIL_VERIFICATION_TOKENS).where({ email: admin_email }).del();

      // Insert school request (without school details)
      const [newRequest] = await db(TABLE.SCHOOL_REQUESTS)
        .insert({
          admin_email,
          admin_first_name,
          admin_last_name,
          admin_password_hash: hashedPassword,
          status: "pending",
          email_verified: false,
        })
        .returning("*");

      // Save verification token
      await db(TABLE.EMAIL_VERIFICATION_TOKENS).insert({
        email: admin_email,
        token: verificationToken,
        expires_at: expiresAt,
        used: false,
      });

      // Generate encrypted verification link
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const encryptedData = encryptData({
        email: admin_email,
        token: verificationToken,
        requestId: newRequest.id,
        exp: expiresAt.getTime(),
      });
      const verificationLink = `${frontendUrl}/auth/verify-school-email?data=${encryptedData}`;

      // Send verification email
      await transporter.sendMail({
        from: `"${process.env.APP_NAME || "Thrive"} Team" <${process.env.SMTP_USER}>`,
        to: admin_email,
        subject: `Verify Your Email - ${process.env.APP_NAME || "Thrive"} School Registration`,
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 50px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <h2 style="color: #333; text-align: center;">Welcome to ${process.env.APP_NAME || "Thrive"}!</h2>
                <p style="font-size: 16px; color: #555;">Hi ${admin_first_name},</p>
                <p style="font-size: 16px; color: #555;">
                  Thank you for registering your school with ${process.env.APP_NAME || "Thrive"}.
                  Please verify your email address by clicking the button below:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationLink}"
                     style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Verify Email & Continue
                  </a>
                </div>
                <p style="font-size: 14px; color: #555; text-align: center;">This link will expire in 24 hours.</p>
                <p style="font-size: 14px; color: #888; text-align: center;">If you did not create this request, please ignore this email.</p>
              </div>
            </body>
          </html>
        `,
      });

      sendResponse(
        res,
        201,
        "Verification email sent. Please check your inbox to continue registration.",
        true,
        { id: newRequest.id, email: admin_email }
      );
    } catch (error: unknown) {
      console.error("Error initiating school request:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Verify email for school registration
 */
export const verifySchoolRequestEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { data } = req.query;

      if (!data) {
        sendResponse(res, 400, "Verification data is required", false);
        return;
      }

      // Decrypt the data
      let decrypted: { email: string; token: string; requestId: number; exp: number } | null;
      try {
        decrypted = decryptData<{ email: string; token: string; requestId: number; exp: number }>(data as string);
      } catch {
        sendResponse(res, 400, "Invalid verification link", false);
        return;
      }

      if (!decrypted) {
        sendResponse(res, 400, "Invalid verification link", false);
        return;
      }

      const { email, token, requestId, exp } = decrypted;

      // Check if token is expired
      if (Date.now() > exp) {
        sendResponse(res, 400, "Verification link has expired. Please register again.", false);
        return;
      }

      // Verify token in database
      const tokenRecord = await db(TABLE.EMAIL_VERIFICATION_TOKENS)
        .where({ email, token, used: false })
        .first();

      if (!tokenRecord) {
        sendResponse(res, 400, "Invalid or already used verification link", false);
        return;
      }

      // Get the school request
      const schoolRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ id: requestId, admin_email: email })
        .first();

      if (!schoolRequest) {
        sendResponse(res, 404, "School request not found", false);
        return;
      }

      if (schoolRequest.email_verified) {
        sendResponse(res, 400, "Email already verified. Please complete school details.", false);
        return;
      }

      // Mark email as verified
      await db(TABLE.SCHOOL_REQUESTS)
        .where({ id: requestId })
        .update({ email_verified: true });

      // Mark token as used
      await db(TABLE.EMAIL_VERIFICATION_TOKENS)
        .where({ id: tokenRecord.id })
        .update({ used: true });

      // Generate a temporary token for completing registration
      const completionToken = encryptData({
        requestId,
        email,
        exp: Date.now() + 60 * 60 * 1000, // 1 hour to complete
      });

      sendResponse(res, 200, "Email verified successfully. Please complete school details.", true, {
        requestId,
        email,
        first_name: schoolRequest.admin_first_name,
        last_name: schoolRequest.admin_last_name,
        completion_token: completionToken,
      });
    } catch (error: unknown) {
      console.error("Error verifying school request email:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Step 2 - Complete school registration
 */
export const completeSchoolRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { completion_token } = req.body;

      if (!completion_token) {
        sendResponse(res, 400, "Completion token is required", false);
        return;
      }

      // Verify completion token
      let tokenData: { requestId: number; email: string; exp: number } | null;
      try {
        tokenData = decryptData<{ requestId: number; email: string; exp: number }>(completion_token);
      } catch {
        sendResponse(res, 400, "Invalid or expired session. Please verify email again.", false);
        return;
      }

      if (!tokenData) {
        sendResponse(res, 400, "Invalid or expired session. Please verify email again.", false);
        return;
      }

      const { requestId, email, exp } = tokenData;

      if (Date.now() > exp) {
        sendResponse(res, 400, "Session expired. Please verify email again.", false);
        return;
      }

      // Validate school data
      const validationResult = validateRequest(completeSchoolRequestSchema, req.body, res);
      if (!validationResult) {
        return;
      }

      const { school_name, school_slug, school_address } = validationResult;

      // Get the school request
      const schoolRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ id: requestId, admin_email: email, email_verified: true })
        .first();

      if (!schoolRequest) {
        sendResponse(res, 404, "School request not found or email not verified", false);
        return;
      }

      if (schoolRequest.school_name) {
        sendResponse(res, 400, "School details already submitted. Please wait for admin approval.", false);
        return;
      }

      // Check if slug is unique
      const existingSlug = await db(TABLE.SCHOOLS).where({ slug: school_slug }).first();
      if (existingSlug) {
        sendResponse(res, 400, "School slug already exists. Please choose another.", false);
        return;
      }

      // Also check pending requests
      const existingSlugRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ school_slug, status: "pending" })
        .whereNot({ id: requestId })
        .first();
      if (existingSlugRequest) {
        sendResponse(res, 400, "School slug already taken. Please choose another.", false);
        return;
      }

      // Handle logo upload
      let logoUrl = null;
      if (req.file) {
        logoUrl = "/schools/" + req.file.filename;
      }

      // Update school request with school details
      await db(TABLE.SCHOOL_REQUESTS)
        .where({ id: requestId })
        .update({
          school_name,
          school_slug,
          school_address: school_address || null,
          school_logo_url: logoUrl,
        });

      sendResponse(
        res,
        200,
        "School registration completed successfully. Please wait for admin approval.",
        true,
        { id: requestId, status: "pending" }
      );

      // Fire-and-forget: notify super admins about new school request
      notificationService.notifySchoolRequest({
        schoolName: school_name,
        requestId,
      }).catch((err) => console.error("Notification error (school request):", err));
    } catch (error: unknown) {
      console.error("Error completing school request:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

/**
 * Submit a school registration request (Public) - Legacy
 */
export const createSchoolRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validated = validateRequest(createSchoolRequestSchema, req.body, res);

      if (!validated) {
        return;
      }

      const {
        admin_email,
        admin_first_name,
        admin_last_name,
        admin_password,
        school_name,
        school_slug,
        school_address,
      } = validated;

      // Check if email already exists in users table
      const existingUser = await db(TABLE.USERS).where({ email: admin_email }).first();
      if (existingUser) {
        sendResponse(res, 400, "Email already exists", false);
        return;
      }

      // Check if there's already a pending request with this email
      const existingRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ admin_email, status: "pending" })
        .first();

      if (existingRequest) {
        sendResponse(res, 400, "You already have a pending request", false);
        return;
      }

      // Check if slug is unique
      const existingSlug = await db(TABLE.SCHOOLS).where({ slug: school_slug }).first();
      if (existingSlug) {
        sendResponse(res, 400, "School slug already exists. Please choose another.", false);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(admin_password, 10);

      // Handle logo upload
      let logoUrl = null;
      if (req.file) {
        logoUrl = "/schools/" + req.file.filename;
      }

      // Insert school request (legacy: email_verified = true since no verification)
      const [newRequest] = await db(TABLE.SCHOOL_REQUESTS)
        .insert({
          admin_email,
          admin_first_name,
          admin_last_name,
          admin_password_hash: hashedPassword,
          school_name,
          school_slug,
          school_address,
          school_logo_url: logoUrl,
          status: "pending",
          email_verified: true, // Legacy: auto-verify
        })
        .returning("*");

      sendResponse(
        res,
        201,
        "School registration request submitted successfully. Please wait for admin approval.",
        true,
        { id: newRequest.id, status: newRequest.status }
      );

      // Fire-and-forget: notify super admins about new school request
      notificationService.notifySchoolRequest({
        schoolName: school_name,
        requestId: newRequest.id,
      }).catch((err) => console.error("Notification error (school request):", err));

      return;
    } catch (error: unknown) {
      console.error("Error creating school request:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Get all school registration requests
 */
export const getAllSchoolRequests = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, page, limit, search } = req.query;

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;
      const searchTerm = (search as string) || "";

      let query = db(TABLE.SCHOOL_REQUESTS);

      // Filter by status
      if (status && ["pending", "approved", "rejected"].includes(status as string)) {
        query = query.where("status", status as string);
      }

      // Search filter
      if (searchTerm) {
        const safeTerm = buildSearchTerm(searchTerm);
        query = query.where(function () {
          this.where("school_name", "ilike", safeTerm)
            .orWhere("admin_first_name", "ilike", safeTerm)
            .orWhere("admin_last_name", "ilike", safeTerm)
            .orWhere("admin_email", "ilike", safeTerm);
        });
      }

      const requests = await query
        .clone()
        .offset(skip)
        .limit(pageLimit)
        .orderBy("created_at", "desc");

      // Add base URL to logo for each request
      requests.forEach((request: { school_logo_url?: string; [key: string]: unknown }) => {
        if (request.school_logo_url) {
          request.school_logo_url = process.env.BASE_URL + request.school_logo_url;
        }
      });

      // Get total count with same filters
      let countQuery = db(TABLE.SCHOOL_REQUESTS);
      if (status && ["pending", "approved", "rejected"].includes(status as string)) {
        countQuery = countQuery.where("status", status as string);
      }
      if (searchTerm) {
        const safeTerm = buildSearchTerm(searchTerm);
        countQuery = countQuery.where(function () {
          this.where("school_name", "ilike", safeTerm)
            .orWhere("admin_first_name", "ilike", safeTerm)
            .orWhere("admin_last_name", "ilike", safeTerm)
            .orWhere("admin_email", "ilike", safeTerm);
        });
      }
      const totalCountResult = await countQuery.count({ count: "*" });
      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: requests,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      };

      sendResponse(res, 200, "School requests fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching school requests:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Approve a school registration request
 */
export const approveSchoolRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Only SUPER_ADMIN can approve school requests (creates schools and admin users)
      if (req.user?.role !== UserRole.SUPER_ADMIN) {
        sendResponse(res, 403, "Only Super Admin can approve school requests", false);
        return;
      }

      const { id } = req.params;

      // Get the request
      const request = await db(TABLE.SCHOOL_REQUESTS).where("id", id).first();

      if (!request) {
        sendResponse(res, 404, "School request not found", false);
        return;
      }

      if (request.status !== "pending") {
        sendResponse(res, 400, `Request already ${request.status}`, false);
        return;
      }

      // Check if email is verified
      if (!request.email_verified) {
        sendResponse(res, 400, "Email not verified. Cannot approve this request.", false);
        return;
      }

      // Check if school details are provided
      if (!request.school_name || !request.school_slug) {
        sendResponse(res, 400, "School details not provided. Cannot approve this request.", false);
        return;
      }

      // Check if slug now exists
      const existingSlug = await db(TABLE.SCHOOLS)
        .where({ slug: request.school_slug })
        .first();

      if (existingSlug) {
        sendResponse(
          res,
          400,
          "School slug already exists. Cannot approve this request.",
          false
        );
        return;
      }

      // Check if this request is linked to an existing user (admin signup flow)
      const existingUser = request.user_id
        ? await db(TABLE.USERS).where({ id: request.user_id }).first()
        : await db(TABLE.USERS).where({ email: request.admin_email }).first();

      // Use transaction to create/update user, school, staff entry, and update request
      let createdSchool: Record<string, unknown> | undefined;
      let adminUser: Record<string, unknown> | undefined;

      await db.transaction(async (trx) => {
        // 1. Create School
        [createdSchool] = await trx(TABLE.SCHOOLS)
          .insert({
            name: request.school_name,
            slug: request.school_slug,
            address: request.school_address,
            logo_url: request.school_logo_url,
            subscription_status: "active",
          })
          .returning("*");

        if (existingUser) {
          // Case 1: User already exists (admin signup flow)
          // Update user's school_id
          await trx(TABLE.USERS)
            .where({ id: existingUser.id })
            .update({ school_id: createdSchool!.id });

          adminUser = {
            id: existingUser.id,
            email: existingUser.email,
            first_name: existingUser.first_name,
            last_name: existingUser.last_name,
            is_active: existingUser.is_active,
          };

          // Insert default permissions for the admin
          await insertDefaultPermissions(existingUser.id, UserRole.ADMIN, trx);
        } else {
          // Case 2: Create new user (school request flow without prior signup)
          // Get admin role ID
          const adminRole = await trx(TABLE.ROLES).where({ name: "admin" }).first();

          if (!adminRole) {
            throw new Error("Admin role not found in database");
          }

          // Create User (Admin)
          const [createdUser] = await trx(TABLE.USERS)
            .insert({
              email: request.admin_email,
              password_hash: request.admin_password_hash,
              first_name: request.admin_first_name,
              last_name: request.admin_last_name,
              role_id: adminRole.id,
              school_id: createdSchool!.id,
              is_active: true,
              email_verified: true,
            })
            .returning(["id", "email", "first_name", "last_name", "is_active", "created_at"]);

          adminUser = createdUser;

          // Create Staff Entry (link user to school)
          await trx(TABLE.STAFF).insert({
            user_id: createdUser.id,
            school_id: createdSchool!.id,
            job_title: "Administrator",
            created_by: req.user?.id, // Super admin who approved
          });

          // Insert default permissions for the new admin
          await insertDefaultPermissions(createdUser.id, UserRole.ADMIN, trx);
        }

        // Update request status
        await trx(TABLE.SCHOOL_REQUESTS)
          .where("id", id)
          .update({
            status: "approved",
            reviewed_at: db.fn.now(),
            reviewed_by: req.user?.id,
          });
      });

      if (!createdSchool || !adminUser) {
        sendResponse(res, 500, "Failed to create school or admin user", false);
        return;
      }

      await activityLogger.log(req, "APPROVE", "school_requests", {
        resourceId: parseInt(id as string),
        resourceName: request.school_name,
        details: {
          admin_email: request.admin_email,
          school_id: createdSchool.id,
        },
      });

      sendResponse(
        res,
        200,
        "School request approved successfully. School created and admin assigned.",
        true,
        {
          school: createdSchool,
          admin: {
            id: adminUser.id,
            email: adminUser.email,
            first_name: adminUser.first_name,
            last_name: adminUser.last_name,
          },
        }
      );
      return;
    } catch (error: unknown) {
      console.error("Error approving school request:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Reject a school registration request
 */
export const rejectSchoolRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Only SUPER_ADMIN can reject school requests
      if (req.user?.role !== UserRole.SUPER_ADMIN) {
        sendResponse(res, 403, "Only Super Admin can reject school requests", false);
        return;
      }

      const { id } = req.params;
      const { rejection_reason } = req.body;

      // Rejection reason is required
      if (!rejection_reason || rejection_reason.trim() === "") {
        sendResponse(res, 400, "Rejection reason is required", false);
        return;
      }

      // Get the request
      const request = await db(TABLE.SCHOOL_REQUESTS).where("id", id).first();

      if (!request) {
        sendResponse(res, 404, "School request not found", false);
        return;
      }

      if (request.status !== "pending") {
        sendResponse(res, 400, `Request already ${request.status}`, false);
        return;
      }

      // Save rejection to history table
      await db(TABLE.SCHOOL_REJECTION_HISTORY).insert({
        school_request_id: id,
        rejection_reason: rejection_reason.trim(),
        rejected_by: req.user?.id,
        rejected_at: db.fn.now(),
      });

      // Update request status
      await db(TABLE.SCHOOL_REQUESTS)
        .where("id", id)
        .update({
          status: "rejected",
          reviewed_at: db.fn.now(),
          reviewed_by: req.user?.id,
          rejection_reason: rejection_reason.trim(),
        });

      // Send rejection email to the requester
      try {
        await sendSchoolRequestRejectionEmail({
          email: request.admin_email,
          first_name: request.admin_first_name,
          last_name: request.admin_last_name,
          school_name: request.school_name,
          rejection_reason: rejection_reason,
        });
      } catch (emailError) {
        console.error("Failed to send rejection email, but request was rejected:", emailError);
        // Continue execution even if email fails - the rejection is already saved
      }

      await activityLogger.log(req, "REJECT", "school_requests", {
        resourceId: parseInt(id as string),
        resourceName: request.school_name,
        details: {
          admin_email: request.admin_email,
          rejection_reason: rejection_reason,
        },
      });

      sendResponse(res, 200, "School request rejected successfully. User has been notified via email.", true);
      return;
    } catch (error: unknown) {
      console.error("Error rejecting school request:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
      return;
    }
  }
);

/**
 * Re-submit school registration after rejection
 */
export const reRegisterSchoolRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reregistration_token } = req.body;

      if (!reregistration_token) {
        sendResponse(res, 400, "Re-registration token is required", false);
        return;
      }

      // Verify token
      let tokenData: { requestId: number; email: string; exp: number } | null;
      try {
        tokenData = decryptData<{ requestId: number; email: string; exp: number }>(reregistration_token);
      } catch {
        sendResponse(res, 400, "Invalid or expired session. Please login again.", false);
        return;
      }

      if (!tokenData) {
        sendResponse(res, 400, "Invalid or expired session. Please login again.", false);
        return;
      }

      const { requestId, email, exp } = tokenData;

      if (Date.now() > exp) {
        sendResponse(res, 400, "Session expired. Please login again.", false);
        return;
      }

      // Validate request body
      const validatedData = validateRequest(reRegisterSchoolRequestSchema, req.body, res);
      if (!validatedData) {
        return;
      }

      const { school_name, school_slug, school_address } =
        validatedData;

      // Get the school request
      const schoolRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ id: requestId, admin_email: email, status: "rejected" })
        .first();

      if (!schoolRequest) {
        sendResponse(res, 404, "School request not found or not eligible for re-registration", false);
        return;
      }

      // Use existing admin info from the original request
      const { admin_first_name, admin_last_name } = schoolRequest;

      // Check if slug is unique (excluding current request)
      const existingSlug = await db(TABLE.SCHOOLS).where({ slug: school_slug }).first();
      if (existingSlug) {
        sendResponse(res, 400, "School slug already exists. Please choose another.", false);
        return;
      }

      // Check pending requests for same slug
      const existingSlugRequest = await db(TABLE.SCHOOL_REQUESTS)
        .where({ school_slug, status: "pending" })
        .whereNot({ id: requestId })
        .first();
      if (existingSlugRequest) {
        sendResponse(res, 400, "School slug already taken. Please choose another.", false);
        return;
      }

      // Handle logo upload
      let logoUrl = schoolRequest.school_logo_url; // Keep existing logo by default
      if (req.file) {
        logoUrl = "/schools/" + req.file.filename;
      }

      // Update the school request
      await db(TABLE.SCHOOL_REQUESTS)
        .where({ id: requestId })
        .update({
          admin_first_name,
          admin_last_name,
          school_name,
          school_slug,
          school_address: school_address || null,
          school_logo_url: logoUrl,
          status: "pending", // Change status back to pending
          reviewed_at: null,
          reviewed_by: null,
          rejection_reason: null,
        });

      sendResponse(
        res,
        200,
        "School registration re-submitted successfully. Please wait for admin approval.",
        true,
        { id: requestId, status: "pending" }
      );
    } catch (error: unknown) {
      console.error("Error re-registering school request:", error);
      sendResponse(res, 500, getErrorMessage(error), false);
    }
  }
);

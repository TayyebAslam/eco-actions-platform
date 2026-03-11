import db from "../../config/db";
import { TABLE } from "../Database/table";

/**
 * Store email change OTP in database with expiry time
 * Deletes any existing unused OTPs for the same user before inserting
 */
export async function storeEmailChangeOTP(
  userId: number,
  currentEmail: string,
  newEmail: string,
  otp: string,
  expiryMinutes: number = 10
): Promise<void> {
  const normalizedCurrentEmail = currentEmail.toLowerCase().trim();
  const normalizedNewEmail = newEmail.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Delete old unused OTPs for this user to prevent confusion
  await db(TABLE.EMAIL_CHANGE_REQUESTS)
    .where({ user_id: userId, is_used: false })
    .delete();

  // Insert new OTP request
  await db(TABLE.EMAIL_CHANGE_REQUESTS).insert({
    user_id: userId,
    current_email: normalizedCurrentEmail,
    new_email: normalizedNewEmail,
    otp,
    is_used: false,
    expires_at: expiresAt,
  });
}

/**
 * Verify email change OTP from database
 * Checks if OTP exists, hasn't expired, and hasn't been used
 */
export async function verifyEmailChangeOTP(
  userId: number,
  otp: string,
  newEmail: string
): Promise<{ valid: boolean; error?: string; otpRecord?: Record<string, unknown> }> {
  const normalizedNewEmail = newEmail.toLowerCase().trim();

  const otpRecord = await db(TABLE.EMAIL_CHANGE_REQUESTS)
    .where({
      user_id: userId,
      otp,
      new_email: normalizedNewEmail,
      is_used: false
    })
    .first();

  if (!otpRecord) {
    return { valid: false, error: "Invalid OTP or email mismatch" };
  }

  if (new Date() > new Date(otpRecord.expires_at)) {
    return { valid: false, error: "OTP has expired" };
  }

  return { valid: true, otpRecord };
}

/**
 * Mark email change OTP as used after successful email change
 */
export async function markEmailChangeOTPAsUsed(userId: number, otp: string): Promise<void> {
  await db(TABLE.EMAIL_CHANGE_REQUESTS)
    .where({ user_id: userId, otp, is_used: false })
    .update({
      is_used: true,
      updated_at: new Date()
    });
}

/**
 * Delete email change OTP from database
 * Used when email sending fails or for cleanup
 */
export async function deleteEmailChangeOTP(userId: number): Promise<void> {
  await db(TABLE.EMAIL_CHANGE_REQUESTS)
    .where({ user_id: userId, is_used: false })
    .delete();
}

/**
 * Cleanup expired email change OTPs from database
 * Can be called periodically via cron job
 */
export async function cleanupExpiredEmailChangeOTPs(): Promise<void> {
  await db(TABLE.EMAIL_CHANGE_REQUESTS)
    .where('expires_at', '<', new Date())
    .delete();
}

/**
 * Get pending email change request for a user
 */
export async function getPendingEmailChangeRequest(userId: number): Promise<Record<string, unknown> | undefined> {
  return await db(TABLE.EMAIL_CHANGE_REQUESTS)
    .where({ user_id: userId, is_used: false })
    .where('expires_at', '>', new Date())
    .orderBy('created_at', 'desc')
    .first();
}

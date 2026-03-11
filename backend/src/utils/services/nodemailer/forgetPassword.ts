import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import db from "../../../config/db";
import { TABLE } from "../../Database/table";
import transporter from ".";
import { User } from "../../types/auth";
import { encryptData } from "../../helperFunctions/encryptionHelper";

// Function to send password reset link
export const sendForgotPasswordEmail = async (
  user: User
): Promise<void> => {
  // Generate secure UUID token
  const resetToken = uuidv4();

  // Token expires in 1 hour
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Delete any existing tokens for this email
  await db(TABLE.PASSWORD_RESETS).where({ email: user.email }).del();

  // Save new token
  await db(TABLE.PASSWORD_RESETS).insert({
    email: user.email,
    token: resetToken,
    created_at: new Date(),
    expires_at: expiresAt,
    used: false,
  });

  // Generate encrypted reset link
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const encryptedData = encryptData({
    email: user.email,
    token: resetToken,
    exp: expiresAt.getTime(),
  });
  const resetLink = `${frontendUrl}/auth/login?data=${encryptedData}`;

  // Email options
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.APP_NAME} Team" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `Reset Your Password - ${process.env.APP_NAME}`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 50px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
            <p style="font-size: 16px; color: #555;">Hi,</p>
            <p style="font-size: 16px; color: #555;">
              You recently requested to reset your password for your ${process.env.APP_NAME} account.
              Click the button below to reset your password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 14px; color: #555; text-align: center;">This link will expire in 1 hour and can only be used once.</p>
            <p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetLink}" style="color: #10b981; word-break: break-all;">${resetLink}</a>
            </p>
            <p style="font-size: 14px; color: #888; text-align: center;">If you did not request this, please ignore this email.</p>
            <p style="font-size: 14px; color: #777; text-align: center; margin-top: 20px;">
              Best regards,<br>
              <strong>${process.env.APP_NAME} Team</strong>
            </p>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log("Password reset email sent successfully!");
};


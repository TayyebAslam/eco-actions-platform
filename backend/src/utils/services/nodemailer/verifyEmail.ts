import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import db from "../../../config/db";
import { TABLE } from "../../Database/table";
import transporter from ".";
import { encryptData } from "../../helperFunctions/encryptionHelper";

interface EmailVerificationParams {
  email: string;
  firstName: string;
}

// Function to send email verification link
export const sendEmailVerificationLink = async (
  params: EmailVerificationParams
): Promise<void> => {
  const { email, firstName } = params;

  // Generate secure UUID token
  const verificationToken = uuidv4();

  // Token expires in 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Delete any existing tokens for this email
  await db(TABLE.EMAIL_VERIFICATION_TOKENS).where({ email }).del();

  // Save new token
  await db(TABLE.EMAIL_VERIFICATION_TOKENS).insert({
    email,
    token: verificationToken,
    expires_at: expiresAt,
    used: false,
  });

  // Generate encrypted verification link
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const encryptedData = encryptData({
    email,
    token: verificationToken,
    exp: expiresAt.getTime(),
  });
  const verificationLink = `${frontendUrl}/auth/verify-email?data=${encryptedData}`;

  // Email options
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.APP_NAME} Team" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Verify Your Email - ${process.env.APP_NAME}`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 50px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Welcome to ${process.env.APP_NAME}!</h2>
            <p style="font-size: 16px; color: #555;">Hi ${firstName},</p>
            <p style="font-size: 16px; color: #555;">
              Thank you for registering with ${process.env.APP_NAME}.
              Please verify your email address by clicking the button below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}"
                 style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="font-size: 14px; color: #555; text-align: center;">This link will expire in 24 hours.</p>
            <p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verificationLink}" style="color: #10b981; word-break: break-all;">${verificationLink}</a>
            </p>
            <p style="font-size: 14px; color: #888; text-align: center;">If you did not create an account, please ignore this email.</p>
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
  console.log("Email verification link sent successfully!");
};

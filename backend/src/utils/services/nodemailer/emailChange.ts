import nodemailer from "nodemailer";
import transporter from ".";
import { User } from "../../types/auth";

export const sendEmailChangeOTPEmail = async (
  user: User,
  newEmail: string,
  otp: string
): Promise<void> => {
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.APP_NAME} Team" <${process.env.SMTP_USER}>`,
    to: [user.email],
    subject: `Verify Email Change Request - ${process.env.APP_NAME}`,
    html: emailChangeOTPTemplate(user, newEmail, otp),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email change OTP sent successfully!");
  } catch (error) {
    console.error("Error sending email change OTP:", error);
    throw error; // Let the controller handle the error
  }
};

const emailChangeOTPTemplate = (user: User, newEmail: string, otp: string) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Email Change Request</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            font-size: 24px;
            font-weight: bold;
            color: #5e9b6d;
            margin-bottom: 20px;
            text-align: center;
        }
        .content {
            font-size: 16px;
            line-height: 1.5;
        }
        .otp {
            font-size: 32px;
            font-weight: bold;
            color: #5e9b6d;
            text-align: center;
            margin: 30px 0;
            letter-spacing: 5px;
        }
        .email-info {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .email-label {
            font-weight: bold;
            color: #666;
        }
        .email-value {
            color: #333;
            margin-left: 10px;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 20px 0;
            color: #856404;
        }
        .footer {
            font-size: 14px;
            color: #777;
            margin-top: 30px;
            text-align: center;
        }
        .expiry-note {
            text-align: center;
            color: #999;
            font-size: 14px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Email Change Request</div>
        <div class="content">
            <p>Hi ${user?.first_name || 'there'},</p>
            <p>We received a request to change your email address for your <strong>${process.env.APP_NAME}</strong> account.</p>

            <div class="email-info">
                <div><span class="email-label">Current Email:</span><span class="email-value">${user.email}</span></div>
                <div><span class="email-label">New Email:</span><span class="email-value">${newEmail}</span></div>
            </div>

            <p>To confirm this change, please enter the OTP below:</p>
            <div class="otp">${otp}</div>
            <p class="expiry-note">This OTP will expire in 10 minutes.</p>

            <div class="warning">
                <strong>⚠ Security Notice:</strong> If you did not request this change, please ignore this email and consider securing your account immediately.
            </div>
        </div>
        <div class="footer">
            <p>Best regards,</p>
            <p><strong>${process.env.APP_NAME} Team</strong></p>
        </div>
    </div>
</body>
</html>`;
};

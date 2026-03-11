import nodemailer from "nodemailer";
import transporter from ".";

interface WelcomeEmailParams {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role: string;
}

export const sendWelcomeEmail = async (
  params: WelcomeEmailParams
): Promise<void> => {
  const { email, password, first_name, last_name, role } = params;

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.APP_NAME} Team" <${process.env.SMTP_USER}>`,
    to: [email],
    cc: [],
    bcc: [],
    subject: `Welcome to ${process.env.APP_NAME} - Your Account Details`,
    html: welcomeEmailTemplate(params),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully to ${email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
};

const welcomeEmailTemplate = (params: WelcomeEmailParams) => {
  const { email, password, first_name, last_name, name, role } = params;
  const displayName = name || `${first_name || ''} ${last_name || ''}`.trim() || 'User';
  const roleDisplay = role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${process.env.APP_NAME}</title>
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
            line-height: 1.6;
        }
        .credentials {
            background-color: #f8f9fa;
            border-left: 4px solid #5e9b6d;
            padding: 15px;
            margin: 20px 0;
        }
        .credentials p {
            margin: 8px 0;
        }
        .credentials strong {
            color: #5e9b6d;
        }
        .credential-value {
            font-family: 'Courier New', monospace;
            background-color: #e9ecef;
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
            margin-left: 10px;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            font-size: 14px;
            color: #777;
            margin-top: 30px;
            text-align: center;
        }
        .button {
            display: inline-block;
            padding: 12px 30px;
            margin: 20px 0;
            background-color: #5e9b6d;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .button:hover {
            background-color: #4a7d58;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Welcome to ${process.env.APP_NAME}!</div>
        <div class="content">
            <p>Hi <strong>${displayName}</strong>,</p>
            <p>Your account has been successfully created as a <strong>${roleDisplay}</strong> in our system. We're excited to have you on board!</p>

            <div class="credentials">
                <p><strong>📧 Email:</strong><span class="credential-value">${email}</span></p>
                <p><strong>🔑 Password:</strong><span class="credential-value">${password}</span></p>
                <p><strong>👤 Role:</strong><span class="credential-value">${roleDisplay}</span></p>
            </div>

            <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Please change your password after your first login</li>
                    <li>Keep your credentials secure and do not share them with anyone</li>
                    <li>If you did not request this account, please contact us immediately</li>
                </ul>
            </div>

            <div style="text-align: center;">
                <a href="${process.env.APP_URL || 'http://localhost:5000'}" class="button">Login to Your Account</a>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
        </div>
        <div class="footer">
            <p>Best regards,</p>
            <p><strong>${process.env.APP_NAME} Team</strong></p>
            <p style="font-size: 12px; color: #999; margin-top: 20px;">
                This is an automated email. Please do not reply to this message.
            </p>
        </div>
    </div>
</body>
</html>`;
};

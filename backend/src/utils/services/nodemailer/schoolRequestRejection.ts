import nodemailer from "nodemailer";
import transporter from ".";

interface SchoolRequestRejectionParams {
  email: string;
  first_name: string;
  last_name: string;
  school_name: string;
  rejection_reason?: string;
}

export const sendSchoolRequestRejectionEmail = async (
  params: SchoolRequestRejectionParams
): Promise<void> => {
  const { email, school_name } = params;

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.APP_NAME} Team" <${process.env.SMTP_USER}>`,
    to: [email],
    cc: [],
    bcc: [],
    subject: `School Registration Request Update - ${school_name}`,
    html: schoolRequestRejectionTemplate(params),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`School request rejection email sent successfully to ${email}`);
  } catch (error) {
    console.error("Error sending school request rejection email:", error);
    throw error;
  }
};

const schoolRequestRejectionTemplate = (params: SchoolRequestRejectionParams) => {
  const { email, first_name, last_name, school_name, rejection_reason } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>School Registration Request Update</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            color: #333;
            padding: 20px;
            line-height: 1.6;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
        .email-header {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            padding: 40px 30px;
            text-align: center;
            color: #ffffff;
        }
        .email-header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .email-header p {
            font-size: 14px;
            opacity: 0.95;
            margin-top: 8px;
        }
        .email-body {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
        }
        .message-text {
            font-size: 15px;
            color: #555;
            margin-bottom: 15px;
            line-height: 1.7;
        }
        .info-card {
            background: linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%);
            border-left: 5px solid #dc3545;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            box-shadow: 0 2px 8px rgba(220, 53, 69, 0.1);
        }
        .info-item {
            display: flex;
            align-items: center;
            margin: 12px 0;
            font-size: 14px;
        }
        .info-item .icon {
            font-size: 18px;
            margin-right: 12px;
            min-width: 24px;
        }
        .info-label {
            font-weight: 600;
            color: #2c3e50;
            margin-right: 8px;
        }
        .info-value {
            color: #555;
            word-break: break-word;
        }
        .status-badge {
            display: inline-block;
            background-color: #dc3545;
            color: #ffffff;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .reason-card {
            background: linear-gradient(135deg, #fffbea 0%, #fff3cd 100%);
            border-left: 5px solid #ffc107;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            box-shadow: 0 2px 8px rgba(255, 193, 7, 0.15);
        }
        .reason-card h4 {
            color: #856404;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }
        .reason-card h4 .icon {
            margin-right: 8px;
            font-size: 18px;
        }
        .reason-text {
            color: #856404;
            font-size: 14px;
            line-height: 1.7;
            background-color: rgba(255, 255, 255, 0.6);
            padding: 12px;
            border-radius: 6px;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 30px 0;
        }
        .cta-section {
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #5e9b6d 0%, #4a7d58 100%);
            color: #ffffff;
            padding: 14px 36px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(94, 155, 109, 0.3);
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(94, 155, 109, 0.4);
        }
        .support-note {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
        }
        .support-note p {
            color: #666;
            font-size: 14px;
            margin: 8px 0;
        }
        .support-note strong {
            color: #5e9b6d;
        }
        .email-footer {
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 30px;
            text-align: center;
        }
        .email-footer p {
            margin: 8px 0;
            font-size: 14px;
        }
        .email-footer .brand {
            font-size: 18px;
            font-weight: 600;
            color: #5e9b6d;
            margin-bottom: 10px;
        }
        .email-footer .disclaimer {
            font-size: 12px;
            color: #95a5a6;
            margin-top: 20px;
            line-height: 1.5;
        }
        @media only screen and (max-width: 600px) {
            .email-body {
                padding: 30px 20px;
            }
            .email-header {
                padding: 30px 20px;
            }
            .email-header h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <h1>🏫 School Registration Update</h1>
            <p>Application Status Notification</p>
        </div>
        
        <div class="email-body">
            <div class="greeting">
                Hello ${first_name} ${last_name},
            </div>
            
            <p class="message-text">
                Thank you for your interest in joining <strong>${process.env.APP_NAME}</strong> and for taking the time to submit your school registration application for <strong>${school_name}</strong>.
            </p>
            
            <p class="message-text">
                After careful review of your application, we regret to inform you that we are unable to approve your school registration request at this time.
            </p>

            <div class="info-card">
                <div class="info-item">
                    <span class="icon">📧</span>
                    <span class="info-label">Email:</span>
                    <span class="info-value">${email}</span>
                </div>
                <div class="info-item">
                    <span class="icon">🏫</span>
                    <span class="info-label">School Name:</span>
                    <span class="info-value">${school_name}</span>
                </div>
                <div class="info-item">
                    <span class="icon">📅</span>
                    <span class="info-label">Status:</span>
                    <span class="status-badge">REJECTED</span>
                </div>
            </div>

            ${rejection_reason ? `
            <div class="reason-card">
                <h4>
                    <span class="icon">📝</span>
                    Reason for Rejection
                </h4>
                <div class="reason-text">
                    ${rejection_reason}
                </div>
            </div>
            ` : ''}

            <div class="divider"></div>

            <div class="support-note">
                <p>
                    <strong>💡 What's Next?</strong>
                </p>
                <p>
                    If you believe this decision was made in error or if you would like more information, please don't hesitate to reach out to our support team. We're here to help!
                </p>
                <p>
                    You may also consider submitting a new application after addressing the concerns mentioned above.
                </p>
            </div>

            <div class="cta-section">
                <a href="${process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}" class="cta-button">
                    Visit Our Website
                </a>
            </div>

            <p class="message-text" style="margin-top: 30px;">
                We appreciate your understanding and your interest in <strong>${process.env.APP_NAME}</strong>. We wish you all the best in your sustainability journey.
            </p>
        </div>
        
        <div class="email-footer">
            <p class="brand">${process.env.APP_NAME}</p>
            <p>Empowering Sustainable Futures Together</p>
            <div class="divider" style="background: linear-gradient(to right, transparent, #34495e, transparent); margin: 20px 40px;"></div>
            <p class="disclaimer">
                This is an automated email notification. Please do not reply directly to this message.<br>
                For support inquiries, please contact our team through the official channels.
            </p>
        </div>
    </div>
</body>
</html>`;
};

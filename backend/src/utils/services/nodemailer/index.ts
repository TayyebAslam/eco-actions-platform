import nodemailer from 'nodemailer';
import { config } from 'dotenv';

config();

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

import { sendBrevoEmail } from "./brevo";

// Wrapper object that mimics the transporter interface
const transporter = {
  sendMail: async (mailOptions: nodemailer.SendMailOptions) => {
    const provider = process.env.EMAIL_PROVIDER?.toLowerCase();

    if (provider === "brevo") {
      console.log("Sending email via Brevo...");
      return await sendBrevoEmail(mailOptions);
    } else {
      console.log("Sending email via SMTP...");
      return await smtpTransporter.sendMail(mailOptions);
    }
  },
};

export default transporter;

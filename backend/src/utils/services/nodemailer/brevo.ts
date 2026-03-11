import axios from "axios";
import { SendMailOptions } from "nodemailer";
import { getErrorMessage } from "../../helperFunctions/errorHelper";

export const sendBrevoEmail = async (mailOptions: SendMailOptions) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME;

    if (!apiKey || !senderEmail) {
        throw new Error(
            "Brevo API Key or Sender Email is missing in environment variables."
        );
    }

    const data = {
        sender: {
            name: senderName || "Eco Actions Team",
            email: senderEmail,
        },
        to: Array.isArray(mailOptions.to)
            ? mailOptions.to.map((email) => ({ email }))
            : [{ email: mailOptions.to }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html,
    };

    try {
        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            data,
            {
                headers: {
                    accept: "application/json",
                    "api-key": apiKey,
                    "content-type": "application/json",
                },
            }
        );
        return response.data;
    } catch (error: unknown) {
        console.error(
            "Error sending email via Brevo:",
            axios.isAxiosError(error) ? error.response?.data : getErrorMessage(error)
        );
        throw error;
    }
};

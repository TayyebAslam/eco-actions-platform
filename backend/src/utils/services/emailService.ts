import { sendWelcomeEmail } from "./nodemailer/welcomeEmail";
import { UserRole } from "../enums/users.enum";

interface EmailQueueItem {
  email: string;
  password: string;
  name: string;
  role: string;
}

export class EmailService {
  private emailQueue: EmailQueueItem[] = [];

  /**
   * Add email to queue for later sending
   */
  queueWelcomeEmail(email: string, password: string, name: string, role: string = UserRole.STUDENT): void {
    this.emailQueue.push({ email, password, name, role });
  }

  /**
   * Send all queued welcome emails
   * Continues even if some fail to avoid blocking the process
   */
  async sendQueuedEmails(): Promise<void> {
    const promises = this.emailQueue.map(async (item) => {
      try {
        await sendWelcomeEmail({
          email: item.email,
          password: item.password,
          name: item.name,
          role: item.role,
        });
        console.log(`Welcome email sent successfully to ${item.email}`);
      } catch (error) {
        console.error(`Failed to send welcome email to ${item.email}:`, error);
        // Continue processing other emails even if one fails
      }
    });

    await Promise.allSettled(promises);
    this.clearQueue();
  }

  /**
   * Clear the email queue
   */
  clearQueue(): void {
    this.emailQueue = [];
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.emailQueue.length;
  }
}

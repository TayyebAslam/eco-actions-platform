import admin from "firebase-admin";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { getFirebaseMessaging } from "../config/firebase";

interface SendPushDTO {
  user_id: number;
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  click_action?: string;
}

export class PushService {
  /**
   * Register or refresh an FCM token for a user.
   * Upserts: if the token already exists for this user, update last_used_at.
   */
  async registerToken(params: {
    user_id: number;
    token: string;
    device_type?: string;
    device_name?: string;
  }) {
    const { user_id, token, device_type = "web", device_name } = params;

    await db(TABLE.FCM_TOKENS)
      .insert({
        user_id,
        token,
        device_type,
        device_name: device_name || null,
        last_used_at: new Date(),
      })
      .onConflict(["user_id", "token"])
      .merge({
        device_type,
        device_name: device_name || null,
        last_used_at: new Date(),
        updated_at: new Date(),
      });
  }

  /**
   * Remove an FCM token (e.g., on logout or permission revocation).
   */
  async unregisterToken(params: { user_id: number; token: string }) {
    await db(TABLE.FCM_TOKENS)
      .where({ user_id: params.user_id, token: params.token })
      .delete();
  }

  /**
   * Remove all tokens for a user (e.g., on account deletion or "logout all").
   */
  async removeAllTokensForUser(userId: number) {
    await db(TABLE.FCM_TOKENS).where({ user_id: userId }).delete();
  }

  /**
   * Get all FCM tokens for a user.
   */
  async getTokensForUser(userId: number): Promise<string[]> {
    const rows = await db(TABLE.FCM_TOKENS)
      .where({ user_id: userId })
      .select("token");
    return rows.map((r) => r.token);
  }

  /**
   * Send push notification to a single user (all their registered devices).
   * Handles invalid/expired tokens by removing them from the database.
   */
  async sendToUser(params: SendPushDTO): Promise<void> {
    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const tokens = await this.getTokensForUser(params.user_id);
    if (tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: params.title,
        body: params.body,
      },
      webpush: {
        notification: {
          icon: params.icon || "/icons/leaf.svg",
          badge: "/icons/leaf.svg",
          tag: params.data?.type || "default",
          requireInteraction: false,
        },
        fcmOptions: {
          link: params.click_action || "/dashboard",
        },
      },
      data: params.data || {},
    };

    try {
      const response = await messaging.sendEachForMulticast(message);

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            resp.error &&
            (resp.error.code === "messaging/invalid-registration-token" ||
              resp.error.code ===
                "messaging/registration-token-not-registered") &&
            tokens[idx]
          ) {
            invalidTokens.push(tokens[idx]!);
          }
        });

        if (invalidTokens.length > 0) {
          await db(TABLE.FCM_TOKENS)
            .where({ user_id: params.user_id })
            .whereIn("token", invalidTokens)
            .delete();
          console.log(
            `Cleaned up ${invalidTokens.length} invalid FCM tokens for user ${params.user_id}`
          );
        }
      }
    } catch (error) {
      console.error(
        `Failed to send push notification to user ${params.user_id}:`,
        error
      );
    }
  }

  /**
   * Send push notification to multiple users with concurrency control.
   */
  async sendToUsers(
    userIds: number[],
    params: { title: string; body: string; data?: Record<string, string> }
  ): Promise<void> {
    const BATCH_SIZE = 10;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((userId) =>
          this.sendToUser({
            user_id: userId,
            title: params.title,
            body: params.body,
            data: params.data,
          })
        )
      );
    }
  }

  /**
   * Remove tokens that haven't been refreshed in `daysOld` days.
   *
   * Token cleanup strategy:
   * - Primary cleanup: sendToUser() auto-removes tokens that FCM reports as
   *   invalid/unregistered on every push attempt.
   * - Secondary cleanup (this method): catches tokens for users who stopped
   *   using the app (browser uninstalled, permissions revoked silently, etc.)
   *   where no push is ever attempted. Call this from a scheduled job (e.g. daily cron).
   */
  async cleanupStaleTokens(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleted = await db(TABLE.FCM_TOKENS)
      .where("last_used_at", "<", cutoffDate)
      .delete();

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} stale FCM tokens older than ${daysOld} days`);
    }
    return deleted;
  }
}

export const pushService = new PushService();

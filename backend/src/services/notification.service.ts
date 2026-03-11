import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UserRole } from "../utils/enums/users.enum";
import { NotificationError } from "../utils/errors";
import { getIO } from "../utils/services/socket";
import { pushService } from "./push.service";

export type NotificationType =
  | "activity_approved"
  | "activity_rejected"
  | "pending_activities"
  | "challenge_joined"
  | "school_request"
  | "new_article"
  | "comment_received"
  | "system_alert";

interface CreateNotificationDTO {
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  resource_type?: string;
  resource_id?: number;
  school_id?: number | null;
}

interface CreateAggregatedDTO extends CreateNotificationDTO {
  aggregate_key: string;
  aggregate_count: number;
}

interface NotificationFilters {
  is_read?: boolean;
  type?: NotificationType;
}

interface PaginationDTO {
  page?: number;
  limit?: number;
}

/**
 * NotificationService - Handles notification creation, aggregation, and retrieval
 */
export class NotificationService {
  /* ===================== CORE METHODS ===================== */

  async create(data: CreateNotificationDTO) {
    const [notification] = await db(TABLE.NOTIFICATIONS)
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        resource_type: data.resource_type ?? null,
        resource_id: data.resource_id ?? null,
        school_id: data.school_id ?? null,
      })
      .returning("*");

    this.emitToUser(data.user_id, "notification:new", notification);
    this.emitUnreadCount(data.user_id).catch((err) =>
      console.error("Failed to emit unread count:", err)
    );

    // Send push notification (fire-and-forget)
    this.sendPush(data.user_id, data.title, data.message, {
      type: data.type,
      resource_type: data.resource_type || "",
      resource_id: data.resource_id?.toString() || "",
      notification_id: notification.id.toString(),
    }).catch((err) => console.error("Failed to send push:", err));

    return notification;
  }

  async createOrUpdateAggregated(data: CreateAggregatedDTO) {
    // Use a transaction to prevent race conditions (two concurrent inserts)
    return db.transaction(async (trx) => {
      // Lock the row if it exists (SELECT ... FOR UPDATE)
      const existing = await trx(TABLE.NOTIFICATIONS)
        .where({
          user_id: data.user_id,
          aggregate_key: data.aggregate_key,
          is_read: false,
        })
        .forUpdate()
        .first();

      if (existing) {
        const [updated] = await trx(TABLE.NOTIFICATIONS)
          .where("id", existing.id)
          .update({
            title: data.title,
            message: data.message,
            aggregate_count: data.aggregate_count,
            updated_at: new Date(),
          })
          .returning("*");

        this.emitToUser(data.user_id, "notification:updated", updated);
        return updated;
      }

      const [notification] = await trx(TABLE.NOTIFICATIONS)
        .insert({
          user_id: data.user_id,
          type: data.type,
          title: data.title,
          message: data.message,
          aggregate_key: data.aggregate_key,
          aggregate_count: data.aggregate_count,
          resource_type: data.resource_type ?? null,
          resource_id: data.resource_id ?? null,
          school_id: data.school_id ?? null,
        })
        .returning("*");

      this.emitToUser(data.user_id, "notification:new", notification);
      this.emitUnreadCount(data.user_id).catch((err) =>
        console.error("Failed to emit unread count:", err)
      );

      // Send push notification for new aggregated notifications only (not updates)
      this.sendPush(data.user_id, data.title, data.message, {
        type: data.type,
        resource_type: data.resource_type || "",
        resource_id: data.resource_id?.toString() || "",
        notification_id: notification.id.toString(),
      }).catch((err) => console.error("Failed to send push:", err));

      return notification;
    });
  }

  async getByUserId(
    userId: number,
    filters: NotificationFilters,
    pagination: PaginationDTO
  ) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    let query = db(TABLE.NOTIFICATIONS).where("user_id", userId);
    let countQuery = db(TABLE.NOTIFICATIONS).where("user_id", userId);

    if (filters.is_read !== undefined) {
      query = query.where("is_read", filters.is_read);
      countQuery = countQuery.where("is_read", filters.is_read);
    }

    if (filters.type) {
      query = query.where("type", filters.type);
      countQuery = countQuery.where("type", filters.type);
    }

    const [totalCountResult, unreadCountResult] = await Promise.all([
      countQuery.count({ count: "*" }).first(),
      db(TABLE.NOTIFICATIONS)
        .where({ user_id: userId, is_read: false })
        .count({ count: "*" })
        .first(),
    ]);

    const totalCount = parseInt(totalCountResult?.count as string) || 0;
    const unreadCount = parseInt(unreadCountResult?.count as string) || 0;

    const notifications = await query
      .orderBy("created_at", "desc")
      .offset(offset)
      .limit(limit);

    return {
      data: notifications,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
    };
  }

  async getUnreadCount(userId: number): Promise<number> {
    const result = await db(TABLE.NOTIFICATIONS)
      .where({ user_id: userId, is_read: false })
      .count({ count: "*" })
      .first();
    return parseInt(result?.count as string) || 0;
  }

  async markAsRead(id: number, userId: number) {
    const notification = await db(TABLE.NOTIFICATIONS)
      .where({ id, user_id: userId })
      .first();

    if (!notification) {
      throw new NotificationError("Notification not found", 404);
    }

    if (notification.is_read) {
      return notification;
    }

    const [updated] = await db(TABLE.NOTIFICATIONS)
      .where({ id, user_id: userId })
      .update({ is_read: true, read_at: new Date() })
      .returning("*");

    this.emitUnreadCount(userId).catch((err) =>
      console.error("Failed to emit unread count:", err)
    );

    return updated;
  }

  async markAllAsRead(userId: number) {
    await db(TABLE.NOTIFICATIONS)
      .where({ user_id: userId, is_read: false })
      .update({ is_read: true, read_at: new Date() });

    this.emitUnreadCount(userId).catch((err) =>
      console.error("Failed to emit unread count:", err)
    );
  }

  /* ===================== TRIGGER METHODS ===================== */

  async notifyActivityApproved(params: {
    studentUserId: number;
    activityTitle: string;
    activityId: number;
    points: number;
  }) {
    await this.create({
      user_id: params.studentUserId,
      type: "activity_approved",
      title: "Activity Approved",
      message: `Your activity "${params.activityTitle}" has been approved! You earned ${params.points} points.`,
      resource_type: "activity",
      resource_id: params.activityId,
    });
  }

  async notifyActivityRejected(params: {
    studentUserId: number;
    activityTitle: string;
    activityId: number;
    rejectionReason: string;
  }) {
    await this.create({
      user_id: params.studentUserId,
      type: "activity_rejected",
      title: "Activity Rejected",
      message: `Your activity "${params.activityTitle}" was rejected. Reason: ${params.rejectionReason}`,
      resource_type: "activity",
      resource_id: params.activityId,
    });
  }

  async notifyAdminsPendingActivities(schoolId: number) {
    // Count pending activities for this school
    const countResult = await db(TABLE.ACTIVITIES)
      .where({ school_id: schoolId, status: "pending" })
      .count({ count: "*" })
      .first();
    const pendingCount = parseInt(countResult?.count as string) || 0;

    if (pendingCount === 0) return;

    // Get school name
    const school = await db(TABLE.SCHOOLS).where("id", schoolId).first();
    const schoolName = school?.name || "Unknown School";

    // Find admins for this school + super admins
    const admins = await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(function () {
        this.where(function () {
          // School-level admins
          this.whereIn(`${TABLE.ROLES}.name`, [
            UserRole.ADMIN,
            UserRole.SUB_ADMIN,
          ]).andWhere(`${TABLE.USERS}.school_id`, schoolId);
        }).orWhere(function () {
          // Super admins (all schools)
          this.whereIn(`${TABLE.ROLES}.name`, [
            UserRole.SUPER_ADMIN,
            UserRole.SUPER_SUB_ADMIN,
          ]);
        });
      })
      .andWhere(`${TABLE.USERS}.is_active`, true)
      .select(`${TABLE.USERS}.id`);

    const title = "Activities Pending Review";
    const message = `${pendingCount} ${pendingCount === 1 ? "activity" : "activities"} pending review at ${schoolName}`;
    const aggregateKey = `pending_activities:school:${schoolId}`;

    for (const admin of admins) {
      await this.createOrUpdateAggregated({
        user_id: admin.id,
        type: "pending_activities",
        title,
        message,
        aggregate_key: aggregateKey,
        aggregate_count: pendingCount,
        resource_type: "school",
        resource_id: schoolId,
        school_id: schoolId,
      });
    }
  }

  async notifyChallengeJoined(challengeId: number, schoolId: number | null) {
    // Get challenge info
    const challenge = await db(TABLE.CHALLENGES)
      .where("id", challengeId)
      .first();
    if (!challenge) return;

    // Count total participants for this challenge
    const variantIds = await db(TABLE.CHALLENGE_VARIANTS)
      .where("challenge_id", challengeId)
      .select("id");

    const countResult = await db(TABLE.CHALLENGE_PROGRESS)
      .whereIn(
        "challenge_variant_id",
        variantIds.map((v) => v.id)
      )
      .countDistinct("user_id as count")
      .first();
    const participantCount = parseInt(countResult?.count as string) || 0;

    // Find: challenge creator + school admins + teachers for this school
    const recipientQuery = db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.USERS}.is_active`, true);

    if (schoolId) {
      recipientQuery.where(function () {
        // Challenge creator (if super admin)
        this.where(`${TABLE.USERS}.id`, challenge.created_by)
          .orWhere(function () {
            // School admins
            this.whereIn(`${TABLE.ROLES}.name`, [
              UserRole.ADMIN,
              UserRole.SUB_ADMIN,
            ]).andWhere(`${TABLE.USERS}.school_id`, schoolId);
          })
          .orWhere(function () {
            // Super admins
            this.whereIn(`${TABLE.ROLES}.name`, [
              UserRole.SUPER_ADMIN,
              UserRole.SUPER_SUB_ADMIN,
            ]);
          })
          .orWhere(function () {
            // Teachers at this school
            this.where(`${TABLE.ROLES}.name`, UserRole.TEACHER).andWhere(
              `${TABLE.USERS}.school_id`,
              schoolId
            );
          });
      });
    } else {
      // Global challenge: notify creator + super admins
      recipientQuery.where(function () {
        this.where(`${TABLE.USERS}.id`, challenge.created_by).orWhere(
          function () {
            this.whereIn(`${TABLE.ROLES}.name`, [
              UserRole.SUPER_ADMIN,
              UserRole.SUPER_SUB_ADMIN,
            ]);
          }
        );
      });
    }

    const recipients = await recipientQuery.select(
      db.raw(`DISTINCT ${TABLE.USERS}.id`)
    );

    const challengeTitle = challenge.title || "a challenge";
    const title = "Students Joined Challenge";
    const message = `${participantCount} ${participantCount === 1 ? "student has" : "students have"} joined "${challengeTitle}"`;
    const aggregateKey = `challenge_joined:challenge:${challengeId}`;

    for (const recipient of recipients) {
      await this.createOrUpdateAggregated({
        user_id: recipient.id,
        type: "challenge_joined",
        title,
        message,
        aggregate_key: aggregateKey,
        aggregate_count: participantCount,
        resource_type: "challenge",
        resource_id: challengeId,
        school_id: schoolId,
      });
    }
  }

  async notifySchoolRequest(params: {
    schoolName: string;
    requestId: number;
  }) {
    // Get super admins
    const superAdmins = await db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .whereIn(`${TABLE.ROLES}.name`, [
        UserRole.SUPER_ADMIN,
        UserRole.SUPER_SUB_ADMIN,
      ])
      .andWhere(`${TABLE.USERS}.is_active`, true)
      .select(`${TABLE.USERS}.id`);

    for (const admin of superAdmins) {
      await this.create({
        user_id: admin.id,
        type: "school_request",
        title: "New School Registration Request",
        message: `${params.schoolName} has submitted a registration request`,
        resource_type: "school_request",
        resource_id: params.requestId,
      });
    }
  }

  async notifyArticlePublished(params: {
    articleId: number;
    articleTitle: string;
    schoolId: number | null;
  }) {
    // Get students (all if no school_id, school-specific if school_id set)
    let studentsQuery = db(TABLE.USERS)
      .join(TABLE.ROLES, `${TABLE.USERS}.role_id`, `${TABLE.ROLES}.id`)
      .where(`${TABLE.ROLES}.name`, UserRole.STUDENT)
      .andWhere(`${TABLE.USERS}.is_active`, true);

    if (params.schoolId) {
      studentsQuery = studentsQuery.where(
        `${TABLE.USERS}.school_id`,
        params.schoolId
      );
    }

    const students = await studentsQuery.select(`${TABLE.USERS}.id`);

    if (students.length === 0) return;

    const title = "New Article Published";
    const message = `A new article "${params.articleTitle}" has been published. Check it out!`;

    // Batch insert all notifications at once instead of one-by-one
    const rows = students.map((student) => ({
      user_id: student.id,
      type: "new_article" as NotificationType,
      title,
      message,
      resource_type: "article",
      resource_id: params.articleId,
      school_id: params.schoolId ?? null,
    }));

    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const inserted = await db(TABLE.NOTIFICATIONS).insert(batch).returning("*");

      // Emit socket events for each inserted notification
      for (const notification of inserted) {
        this.emitToUser(notification.user_id, "notification:new", notification);
        this.emitUnreadCount(notification.user_id).catch((err) =>
          console.error("Failed to emit unread count:", err)
        );
      }

      // Send batch push notifications (fire-and-forget)
      const batchUserIds = inserted.map((n: { user_id: number }) => n.user_id);
      pushService
        .sendToUsers(batchUserIds, {
          title,
          body: message,
          data: {
            type: "new_article",
            resource_type: "article",
            resource_id: params.articleId.toString(),
          },
        })
        .catch((err) => console.error("Failed to send batch push:", err));
    }
  }

  async notifyCommentReceived(params: {
    activityOwnerId: number;
    commenterId: number;
    commenterName: string;
    activityId: number;
    activityTitle: string;
  }) {
    // Don't notify if commenting on own activity
    if (params.activityOwnerId === params.commenterId) return;

    await this.create({
      user_id: params.activityOwnerId,
      type: "comment_received",
      title: "New Comment on Your Activity",
      message: `${params.commenterName} commented on your activity "${params.activityTitle}"`,
      resource_type: "activity",
      resource_id: params.activityId,
    });
  }

  /* ===================== PRIVATE HELPERS ===================== */

  private emitToUser(userId: number, event: string, data: unknown) {
    const io = getIO();
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
  }

  private async emitUnreadCount(userId: number) {
    const count = await this.getUnreadCount(userId);
    this.emitToUser(userId, "notification:unread_count", { count });
  }

  private async sendPush(
    userId: number,
    title: string,
    message: string,
    data?: Record<string, string>
  ) {
    await pushService.sendToUser({
      user_id: userId,
      title,
      body: message,
      data,
    });
  }
}

export { NotificationError } from "../utils/errors";

export const notificationService = new NotificationService();

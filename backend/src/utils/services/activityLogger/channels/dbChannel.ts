import db from "../../../../config/db";
import { TABLE } from "../../../Database/table";
import { ActivityLogEntry, LogChannelInterface } from "../types";

export class DbChannel implements LogChannelInterface {
  private retentionDays: number;

  constructor(retentionDays: number = 90) {
    this.retentionDays = retentionDays;
  }

  async write(entry: ActivityLogEntry): Promise<void> {
    try {
      await db(TABLE.AUDIT_LOGS).insert({
        user_id: entry.user_id,
        user_email: entry.user_email,
        user_role: entry.role,
        school_id: entry.school_id || null,
        action: entry.action,
        module: entry.module,
        resource_id: entry.resource_id ? Number(entry.resource_id) : null,
        resource_name: entry.resource_name,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        status: entry.status,
        error_message: entry.error_message,
      });
    } catch (error) {
      console.error("Failed to write audit log to database:", error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const deleted = await db(TABLE.AUDIT_LOGS)
        .where("created_at", "<", cutoffDate)
        .del();

      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} old audit log entries`);
      }
    } catch (error) {
      console.error("Failed to cleanup audit logs:", error);
    }
  }
}

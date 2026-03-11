import { Request } from "express";
import path from "path";
import {
  ActivityLogEntry,
  ActivityLogConfig,
  LogChannelInterface,
  ActionType,
  ModuleType,
  LogChannel,
} from "./types";
import { SingleChannel } from "./channels/singleChannel";
import { DailyChannel } from "./channels/dailyChannel";
import { DbChannel } from "./channels/dbChannel";

class ActivityLogger {
  private static instance: ActivityLogger;
  private config: ActivityLogConfig;
  private channel: LogChannelInterface | null = null;
  private initialized: boolean = false;

  private constructor() {
    this.config = {
      enabled: process.env.ACTIVITY_LOG_ENABLED !== "false",
      channel: (process.env.ACTIVITY_LOG_CHANNEL as LogChannel) || "db",
      dailyRetentionDays: parseInt(process.env.ACTIVITY_LOG_DAYS || "30", 10),
      logPath: path.join(process.cwd(), "logs", "activity"),
    };
  }

  public static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  private initializeChannel(): void {
    if (this.initialized) return;

    if (this.config.channel === "single") {
      this.channel = new SingleChannel(this.config.logPath);
    } else if (this.config.channel === "db") {
      this.channel = new DbChannel(this.config.dailyRetentionDays);
    } else {
      this.channel = new DailyChannel(this.config.logPath, this.config.dailyRetentionDays);
    }

    this.initialized = true;

    if (this.config.channel === "daily" || this.config.channel === "db") {
      this.scheduleCleanup();
    }
  }

  private scheduleCleanup(): void {
    setInterval(
      async () => {
        if (this.channel && "cleanup" in this.channel) {
          await this.channel.cleanup?.();
        }
      },
      24 * 60 * 60 * 1000
    );
  }

  private getClientIP(req: Request): string | null {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] ?? "" : forwardedFor;
      return ips.split(",")[0]?.trim() ?? null;
    }
    return req.ip || req.socket?.remoteAddress || null;
  }

  private getUserAgent(req: Request): string | null {
    return req.headers["user-agent"] || null;
  }

  public async log(
    req: Request,
    action: ActionType,
    module: ModuleType,
    options: {
      resourceId?: number | string | null;
      resourceName?: string | null;
      details?: Record<string, unknown>;
      status?: "success" | "failure";
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    this.initializeChannel();

    const user = req.user;

    const entry: ActivityLogEntry = {
      timestamp: new Date().toISOString(),
      user_id: user?.id || null,
      user_email: user?.email || null,
      role: user?.role || null,
      school_id: user?.school_id || null,
      action,
      module,
      resource_id: options.resourceId ?? null,
      resource_name: options.resourceName ?? null,
      ip_address: this.getClientIP(req),
      user_agent: this.getUserAgent(req),
      details: options.details,
      status: options.status || "success",
      error_message: options.errorMessage,
    };

    try {
      await this.channel?.write(entry);
      // Mark request as already logged so auditMiddleware skips it
      (req as unknown as Record<string, unknown>)._auditLogged = true;
    } catch (error) {
      console.error("ActivityLogger write failed:", error);
    }
  }

  public async logAuth(
    req: Request,
    action: "LOGIN" | "LOGOUT",
    options: {
      userId?: number;
      email?: string;
      role?: string;
      status?: "success" | "failure";
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    this.initializeChannel();

    const entry: ActivityLogEntry = {
      timestamp: new Date().toISOString(),
      user_id: options.userId || req.user?.id || null,
      user_email: options.email || req.user?.email || null,
      role: options.role || req.user?.role || null,
      action,
      module: "auth",
      ip_address: this.getClientIP(req),
      user_agent: this.getUserAgent(req),
      status: options.status || "success",
      error_message: options.errorMessage,
    };

    try {
      await this.channel?.write(entry);
      // Mark request as already logged so auditMiddleware skips it
      (req as unknown as Record<string, unknown>)._auditLogged = true;
    } catch (error) {
      console.error("ActivityLogger write failed:", error);
    }
  }

  public async runCleanup(): Promise<void> {
    this.initializeChannel();
    if (this.channel && "cleanup" in this.channel) {
      await this.channel.cleanup?.();
    }
  }
}

export const activityLogger = ActivityLogger.getInstance();
export { ActionType, ModuleType } from "./types";

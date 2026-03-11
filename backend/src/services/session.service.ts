import { v4 as uuidv4 } from "uuid";
import db from "../config/db";
import { TABLE } from "../utils/Database/table";
import { UAParser } from "ua-parser-js";

// Session expiry in days
const SESSION_EXPIRY_DAYS = 7;

export interface DeviceInfo {
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
}

export interface SessionData {
  id: number;
  user_id: number;
  session_token: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  is_active: boolean;
  last_activity_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ActiveSessionResponse {
  id: number;
  session_token?: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_activity_at: Date | string;
  created_at: Date | string;
  is_current: boolean;
}

/**
 * SessionService - Handles user session management
 */
export class SessionService {
  /**
   * Parse device info from User-Agent, IP, and Client Hints
   */
  parseDeviceInfo(userAgent: string | undefined, ip: string | undefined, secChUa?: string): DeviceInfo {
    const parser = new UAParser(userAgent || "");
    const result = parser.getResult();

    let browserName = result.browser.name || null;
    const browserVersion = result.browser.version ? result.browser.version.split(".")[0] : null;

    // Detect Chromium-based browsers via Sec-CH-UA client hints header
    // Brave, Edge, Opera etc. send their real name in this header
    if (secChUa && browserName) {
      const knownBrands = ["Brave", "Opera", "Vivaldi", "Samsung Internet"];
      for (const brand of knownBrands) {
        if (secChUa.includes(`"${brand}"`)) {
          browserName = brand;
          break;
        }
      }
    }

    const browser = browserName
      ? `${browserName}${browserVersion ? " " + browserVersion : ""}`
      : null;

    // Only show OS name without version to avoid confusion (e.g., Windows 10/11 have same user agent)
    const os = result.os.name || null;

    // Determine device type
    let deviceType: string | null = null;
    if (result.device.type) {
      deviceType = result.device.type; // mobile, tablet, etc.
    } else {
      deviceType = "desktop"; // Default to desktop if no device type detected
    }

    // Build device name like "Chrome on Windows"
    const deviceName = browser && os ? `${browser} on ${os}` : browser || os || "Unknown Device";

    return {
      device_name: deviceName,
      device_type: deviceType,
      browser,
      os,
      ip_address: ip || null,
    };
  }

  /**
   * Create a new session for user
   */
  async createSession(userId: number, deviceInfo: DeviceInfo): Promise<string> {
    const sessionToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await db(TABLE.USER_SESSIONS).insert({
      user_id: userId,
      session_token: sessionToken,
      device_name: deviceInfo.device_name,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip_address: deviceInfo.ip_address,
      is_active: true,
      last_activity_at: new Date(),
      expires_at: expiresAt,
    });

    return sessionToken;
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(
    userId: number,
    currentSessionToken?: string
  ): Promise<ActiveSessionResponse[]> {
    const sessions = await db(TABLE.USER_SESSIONS)
      .where({
        user_id: userId,
        is_active: true,
      })
      .where("expires_at", ">", new Date())
      .orderBy("last_activity_at", "desc");

    return sessions.map((session: SessionData) => ({
      id: session.id,
      session_token: session.session_token,
      device_name: session.device_name,
      device_type: session.device_type,
      browser: session.browser,
      os: session.os,
      ip_address: session.ip_address,
      last_activity_at: session.last_activity_at,
      created_at: session.created_at,
      is_current: session.session_token === currentSessionToken,
    }));
  }

  /**
   * Validate a session token
   */
  async validateSessionToken(sessionToken: string): Promise<SessionData | null> {
    const session = await db(TABLE.USER_SESSIONS)
      .where({
        session_token: sessionToken,
        is_active: true,
      })
      .where("expires_at", ">", new Date())
      .first();

    return session || null;
  }

  /**
   * Invalidate a single session
   */
  async invalidateSession(sessionId: number, userId: number): Promise<boolean> {
    const result = await db(TABLE.USER_SESSIONS)
      .where({
        id: sessionId,
        user_id: userId,
      })
      .update({ is_active: false });

    return result > 0;
  }

  /**
   * Invalidate session by token
   */
  async invalidateSessionByToken(sessionToken: string): Promise<boolean> {
    const result = await db(TABLE.USER_SESSIONS)
      .where({ session_token: sessionToken })
      .update({ is_active: false });

    return result > 0;
  }

  /**
   * Invalidate all sessions except current one
   */
  async invalidateAllSessionsExcept(
    userId: number,
    exceptSessionToken: string
  ): Promise<number> {
    const result = await db(TABLE.USER_SESSIONS)
      .where({ user_id: userId, is_active: true })
      .whereNot({ session_token: exceptSessionToken })
      .update({ is_active: false });

    return result;
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllSessions(userId: number): Promise<number> {
    const result = await db(TABLE.USER_SESSIONS)
      .where({ user_id: userId, is_active: true })
      .update({ is_active: false });

    return result;
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(sessionToken: string): Promise<void> {
    await db(TABLE.USER_SESSIONS)
      .where({ session_token: sessionToken })
      .update({ last_activity_at: new Date() });
  }

  /**
   * Get session by token
   */
  async getSessionByToken(sessionToken: string): Promise<SessionData | null> {
    const session = await db(TABLE.USER_SESSIONS)
      .where({ session_token: sessionToken })
      .first();

    return session || null;
  }

  /**
   * Get other active session tokens for a user (excluding current)
   */
  async getOtherActiveSessionTokens(
    userId: number,
    exceptSessionToken: string
  ): Promise<string[]> {
    const sessions = await db(TABLE.USER_SESSIONS)
      .where({
        user_id: userId,
        is_active: true,
      })
      .whereNot({ session_token: exceptSessionToken })
      .where("expires_at", ">", new Date())
      .select("session_token");

    return sessions.map((s: { session_token: string }) => s.session_token);
  }

  /**
   * Count active sessions for a user
   */
  async countActiveSessions(userId: number): Promise<number> {
    const result = await db(TABLE.USER_SESSIONS)
      .where({
        user_id: userId,
        is_active: true,
      })
      .where("expires_at", ">", new Date())
      .count("id as count")
      .first();

    return Number(result?.count) || 0;
  }

  /**
   * Clean up expired sessions (can be called by a cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await db(TABLE.USER_SESSIONS)
      .where("expires_at", "<", new Date())
      .orWhere({ is_active: false })
      .delete();

    return result;
  }
}

// Export singleton instance
export const sessionService = new SessionService();

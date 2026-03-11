/**
 * Centralized Redis Keys
 * All Redis keys are defined here for easy management and avoiding key collisions
 */

export const REDIS_KEYS = {
  // ==========================================
  // User & Authentication
  // ==========================================

  /** User data cache - includes role info */
  USER: (userId: number) => `user:${userId}`,

  /** User session token validation */
  USER_SESSION: (token: string) => `session:${token}`,

  /** User lookup by email (for quick email existence check) */
  USER_EMAIL: (email: string) => `user:email:${email.toLowerCase()}`,

  /** User permissions map */
  USER_PERMISSIONS: (userId: number) => `permissions:${userId}`,

  /** Active sessions for a user */
  USER_ACTIVE_SESSIONS: (userId: number) => `user:sessions:${userId}`,

  // ==========================================
  // OTP & Verification
  // ==========================================

  /** Password reset OTP */
  OTP_PASSWORD_RESET: (email: string) => `otp:password:${email.toLowerCase()}`,

  /** Email verification OTP */
  OTP_EMAIL_VERIFY: (email: string) => `otp:verify:${email.toLowerCase()}`,

  /** Email change OTP */
  OTP_EMAIL_CHANGE: (userId: number) => `otp:change:${userId}`,

  /** General OTP (for any purpose) */
  OTP: (identifier: string, purpose: string) => `otp:${purpose}:${identifier.toLowerCase()}`,

  // ==========================================
  // Dashboard & Stats
  // ==========================================

  /** Dashboard statistics - per school or global */
  DASHBOARD_STATS: (schoolId?: number) =>
    schoolId ? `stats:dashboard:school:${schoolId}` : `stats:dashboard:global`,

  /** Activity stats */
  ACTIVITY_STATS: (schoolId?: number) =>
    schoolId ? `stats:activity:school:${schoolId}` : `stats:activity:global`,

  /** Challenge stats */
  CHALLENGE_STATS: (challengeId: number) => `stats:challenge:${challengeId}`,

  // ==========================================
  // Static/Reference Data
  // ==========================================

  /** All categories list */
  CATEGORIES_LIST: "static:categories",

  /** All levels list */
  LEVELS_LIST: "static:levels",

  /** All badges list */
  BADGES_LIST: "static:badges",

  /** All roles list */
  ROLES_LIST: "static:roles",

  /** All modules list (for permissions) */
  MODULES_LIST: "static:modules",

  // ==========================================
  // Rate Limiting (if using Redis for rate limits)
  // ==========================================

  /** Rate limit counter */
  RATE_LIMIT: (identifier: string, endpoint: string) =>
    `ratelimit:${endpoint}:${identifier}`,

  // ==========================================
  // Real-time / Socket
  // ==========================================

  /** Online users set */
  ONLINE_USERS: "realtime:online",

  /** User's socket ID mapping */
  USER_SOCKET: (userId: number) => `socket:user:${userId}`,

  // ==========================================
  // Temporary Data
  // ==========================================

  /** Temporary data with custom prefix */
  TEMP: (key: string) => `temp:${key}`,
};

/**
 * TTL (Time To Live) in seconds
 * Centralized cache expiration times
 */
export const REDIS_TTL = {
  // User data
  USER: 60 * 60 * 24, // 24 hours
  USER_SHORT: 60 * 15, // 15 minutes (for frequently changing data)

  // Sessions
  SESSION: 60 * 60 * 24 * 2, // 2 days

  // Permissions
  PERMISSIONS: 60 * 30, // 30 minutes

  // OTP
  OTP: 60 * 10, // 10 minutes
  OTP_EMAIL_VERIFY: 60 * 60, // 1 hour (email verification)

  // Dashboard stats
  DASHBOARD_STATS: 60 * 5, // 5 minutes

  // Static data (rarely changes)
  STATIC_DATA: 60 * 60 * 24, // 24 hours
  CATEGORIES: 60 * 60 * 6, // 6 hours
  LEVELS: 60 * 60 * 12, // 12 hours
  BADGES: 60 * 60 * 12, // 12 hours

  // Rate limiting
  RATE_LIMIT: 60 * 15, // 15 minutes

  // Temporary
  TEMP_SHORT: 60 * 5, // 5 minutes
  TEMP_MEDIUM: 60 * 30, // 30 minutes
  TEMP_LONG: 60 * 60 * 2, // 2 hours
};

/**
 * Key patterns for bulk operations (like clearing cache)
 */
export const REDIS_PATTERNS = {
  ALL_USERS: "user:*",
  ALL_SESSIONS: "session:*",
  ALL_PERMISSIONS: "permissions:*",
  ALL_OTP: "otp:*",
  ALL_STATS: "stats:*",
  ALL_STATIC: "static:*",
  ALL_TEMP: "temp:*",

  // Specific patterns
  USER_SESSIONS: (userId: number) => `user:sessions:${userId}:*`,
  SCHOOL_STATS: (schoolId: number) => `stats:*:school:${schoolId}`,
};

/**
 * Global Jest Setup - Common mocks loaded via setupFiles
 * These mocks apply to ALL test files automatically
 */

// ─── Silence console noise during tests ─────────────
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();

// ─── Database Mock ───────────────────────────────────
jest.mock("../src/config/db", () => {
  const mockKnex: any = jest.fn(() => mockKnex);
  mockKnex.join = jest.fn().mockReturnThis();
  mockKnex.leftJoin = jest.fn().mockReturnThis();
  mockKnex.rightJoin = jest.fn().mockReturnThis();
  mockKnex.select = jest.fn().mockReturnThis();
  mockKnex.where = jest.fn().mockReturnThis();
  mockKnex.andWhere = jest.fn().mockReturnThis();
  mockKnex.orWhere = jest.fn().mockReturnThis();
  mockKnex.whereIn = jest.fn().mockReturnThis();
  mockKnex.whereNot = jest.fn().mockReturnThis();
  mockKnex.whereRaw = jest.fn().mockReturnThis();
  mockKnex.whereNull = jest.fn().mockReturnThis();
  mockKnex.whereNotNull = jest.fn().mockReturnThis();
  mockKnex.whereBetween = jest.fn().mockReturnThis();
  mockKnex.orWhereNull = jest.fn().mockReturnThis();
  mockKnex.orderBy = jest.fn().mockReturnThis();
  mockKnex.groupBy = jest.fn().mockReturnThis();
  mockKnex.having = jest.fn().mockReturnThis();
  mockKnex.limit = jest.fn().mockReturnThis();
  mockKnex.offset = jest.fn().mockReturnThis();
  mockKnex.clone = jest.fn().mockReturnThis();
  mockKnex.distinct = jest.fn().mockReturnThis();
  mockKnex.first = jest.fn().mockResolvedValue(null);
  mockKnex.count = jest.fn().mockReturnThis();
  mockKnex.countDistinct = jest.fn().mockReturnThis();
  mockKnex.sum = jest.fn().mockReturnThis();
  mockKnex.avg = jest.fn().mockReturnThis();
  mockKnex.min = jest.fn().mockReturnThis();
  mockKnex.max = jest.fn().mockReturnThis();
  mockKnex.insert = jest.fn().mockReturnThis();
  mockKnex.update = jest.fn().mockReturnThis();
  mockKnex.del = jest.fn().mockReturnThis();
  mockKnex.delete = jest.fn().mockReturnThis();
  mockKnex.returning = jest.fn().mockResolvedValue([]);
  mockKnex.raw = jest.fn().mockResolvedValue({ rows: [] });
  mockKnex.transaction = jest.fn((cb: any) => cb(mockKnex));
  mockKnex.destroy = jest.fn();
  mockKnex.pluck = jest.fn().mockResolvedValue([]);
  mockKnex.map = jest.fn().mockResolvedValue([]);
  mockKnex.modify = jest.fn().mockReturnThis();
  mockKnex.on = jest.fn().mockReturnThis();
  // Make mockKnex thenable so query chains resolve to [] when awaited
  mockKnex.then = function (resolve: any) {
    return Promise.resolve([]).then(resolve);
  };
  return { __esModule: true, default: mockKnex };
});

// ─── Redis Mock ──────────────────────────────────────
jest.mock("../src/utils/services/redis/cache", () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    getOrSet: jest.fn().mockResolvedValue(null),
  },
  invalidateCategories: jest.fn(),
  invalidateBadges: jest.fn(),
  invalidatePermissions: jest.fn(),
  invalidateUser: jest.fn(),
}));

jest.mock("../src/utils/services/redis", () => ({
  initRedis: jest.fn().mockResolvedValue(true),
  closeRedis: jest.fn(),
  isRedisConnected: jest.fn().mockReturnValue(false),
}));

jest.mock("../src/utils/services/redis/keys", () => ({
  REDIS_KEYS: {
    USER: (id: number) => `user:${id}`,
    PERMISSIONS: (id: number) => `permissions:${id}`,
    CATEGORIES: "categories",
    BADGES: "badges",
  },
  REDIS_TTL: { USER: 300, PERMISSIONS: 300 },
}));

// ─── Rate Limiters Mock ──────────────────────────────
const passThrough = (_req: any, _res: any, next: any) => next();
jest.mock("../src/middlewares/requestlimit", () => ({
  authLimiter: passThrough,
  otpLimiter: passThrough,
  passwordResetLimiter: passThrough,
  loginAccountLimiter: passThrough,
  failedLoginIpBlocker: passThrough,
  registerFailedLoginAttempt: jest.fn(),
  clearFailedLoginAttempts: jest.fn(),
  generalLimiter: passThrough,
  uploadLimiter: passThrough,
  userLimiter: passThrough,
  userWriteLimiter: passThrough,
  __esModule: true,
  default: passThrough,
}));

// ─── Audit Middleware Mock ───────────────────────────
jest.mock("../src/middlewares/auditMiddleware", () => ({
  auditMiddleware: passThrough,
  __esModule: true,
  default: passThrough,
}));

// ─── CSRF Middleware Mock ────────────────────────────
jest.mock("../src/middlewares/csrfMiddleware", () => ({
  setCsrfToken: passThrough,
  validateCsrfToken: passThrough,
  generateCsrfToken: jest.fn().mockReturnValue("mock-csrf-token"),
  regenerateCsrfToken: jest.fn().mockReturnValue("mock-csrf-token"),
  csrfProtection: [passThrough, passThrough],
}));

// ─── Permission Middleware Mock ──────────────────────
jest.mock("../src/middlewares/permissionMiddleware", () => ({
  checkPermission: () => passThrough,
  getUserPermissionsMap: jest.fn().mockResolvedValue({}),
  insertDefaultPermissions: jest.fn().mockResolvedValue(undefined),
  invalidatePermissions: jest.fn(),
}));

// ─── Auth Middleware Mock (default: admin user) ──────
jest.mock("../src/middlewares/authMiddleware", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = {
      id: 1,
      first_name: "Test",
      last_name: "Admin",
      email: "admin@test.com",
      role: "admin",
      is_verified: true,
      is_active: true,
      school_id: 1,
    };
    next();
  },
  requireRole: () => (req: any, _res: any, next: any) => {
    req.user = {
      id: 1,
      first_name: "Test",
      last_name: "Admin",
      email: "admin@test.com",
      role: "admin",
      is_verified: true,
      is_active: true,
      school_id: 1,
    };
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => {
    req.user = {
      id: 1,
      first_name: "Test",
      last_name: "Admin",
      email: "admin@test.com",
      role: "admin",
      is_verified: true,
      is_active: true,
      school_id: 1,
    };
    next();
  },
  requireTeacher: (req: any, _res: any, next: any) => {
    req.user = {
      id: 5,
      first_name: "Test",
      last_name: "Teacher",
      email: "teacher@test.com",
      role: "teacher",
      is_verified: true,
      is_active: true,
      school_id: 1,
    };
    next();
  },
  invalidateUserCache: jest.fn(),
}));

// ─── Activity Logger Mock ────────────────────────────
jest.mock("../src/utils/services/activityLogger", () => ({
  activityLogger: {
    log: jest.fn().mockResolvedValue(undefined),
    logAuth: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Socket Mock ─────────────────────────────────────
jest.mock("../src/utils/services/socket", () => ({
  initializeSocket: jest.fn(),
  emitLogoutSession: jest.fn(),
  emitLogoutAllSessions: jest.fn(),
  emitPermissionsUpdated: jest.fn(),
}));

// ─── Email Services Mock ─────────────────────────────
jest.mock("../src/utils/services/nodemailer/forgetPassword", () => ({
  sendForgotPasswordEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../src/utils/services/nodemailer/verifyEmail", () => ({
  sendEmailVerificationLink: jest.fn().mockResolvedValue(true),
}));

jest.mock("../src/utils/services/nodemailer/welcomeEmail", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../src/utils/services/nodemailer/schoolRequestRejection", () => ({
  sendSchoolRequestRejectionEmail: jest.fn().mockResolvedValue(true),
}));

// ─── Encryption Helper Mock ─────────────────────────
jest.mock("../src/utils/helperFunctions/encryptionHelper", () => ({
  encryptData: jest.fn((data: string) => `encrypted_${data}`),
  decryptData: jest.fn((data: string) => data.replace("encrypted_", "")),
}));

// ─── Session Service Mock ────────────────────────────
jest.mock("../src/services/session.service", () => ({
  sessionService: {
    parseDeviceInfo: jest.fn().mockReturnValue({ browser: "Chrome", os: "Linux", ip: "127.0.0.1" }),
    invalidateSessionByToken: jest.fn(),
    invalidateSession: jest.fn(),
    invalidateAllSessionsExcept: jest.fn(),
    countActiveSessions: jest.fn().mockResolvedValue(0),
    invalidateAllSessions: jest.fn(),
    getActiveSessions: jest.fn().mockResolvedValue([]),
  },
}));

/**
 * Shared mock fixtures to avoid repetition across test files.
 *
 * Usage in test files:
 *   import { setupMulterMock, setupCacheInvalidationMock, setupServiceBarrelMock } from "../helpers/mockFixtures";
 *   setupMulterMock();
 *   setupCacheInvalidationMock();
 *
 * IMPORTANT: Call these BEFORE importing app or any src modules.
 */

/** Mock multer to pass-through (no file processing) */
export function setupMulterMock() {
  jest.mock("../../src/utils/services/multer", () => ({
    storageData: () => ({
      single: () => (_req: any, _res: any, next: any) => next(),
      array: () => (_req: any, _res: any, next: any) => next(),
      none: () => (_req: any, _res: any, next: any) => next(),
    }),
  }));
}

/** Mock Redis cache invalidation functions */
export function setupCacheInvalidationMock() {
  jest.mock("../../src/utils/services/redis/cacheInvalidation", () => ({
    invalidateCategories: jest.fn(),
    invalidateBadges: jest.fn(),
    invalidatePermissions: jest.fn(),
    invalidateUser: jest.fn(),
    invalidateUserComplete: jest.fn(),
    invalidateLevels: jest.fn(),
    invalidateDashboardStats: jest.fn(),
    invalidateMultipleUsers: jest.fn(),
    invalidateAllCache: jest.fn(),
  }));
}

/** Stub Error class for service mocks */
class StubError extends Error {
  statusCode: number;
  data?: any;
  constructor(message: string, statusCode: number = 400, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

/** Base service barrel mock - all services as empty stubs with Error classes */
export function getServiceBarrelStubs() {
  return {
    activityService: {
      getAllActivities: jest.fn(),
      getActivityById: jest.fn(),
      reviewActivity: jest.fn(),
    },
    ActivityError: class extends StubError { name = "ActivityError"; },
    levelService: {
      createLevel: jest.fn(),
      getAllLevels: jest.fn(),
      getLevelById: jest.fn(),
      updateLevel: jest.fn(),
      applyLevelFormula: jest.fn(),
      deleteLevel: jest.fn(),
    },
    LevelError: class extends StubError { name = "LevelError"; },
    authService: {},
    AuthError: class extends StubError { name = "AuthError"; },
    userService: {
      createUser: jest.fn(),
      updateUser: jest.fn(),
    },
    UserError: class extends StubError { name = "UserError"; },
    studentService: {
      createStudent: jest.fn(),
      updateStudent: jest.fn(),
      bulkUploadStudents: jest.fn(),
    },
    StudentError: class extends StubError { name = "StudentError"; },
    schoolService: {
      createSchool: jest.fn(),
      updateSchool: jest.fn(),
      submitSchoolRequest: jest.fn(),
    },
    SchoolError: class extends StubError { name = "SchoolError"; },
    teacherService: {
      createTeacher: jest.fn(),
      getAllTeachers: jest.fn(),
      getTeacherById: jest.fn(),
      updateTeacher: jest.fn(),
      deleteTeacher: jest.fn(),
      bulkUploadTeachers: jest.fn(),
    },
    TeacherError: class extends StubError { name = "TeacherError"; },
    challengeService: {},
    ChallengeError: class extends StubError { name = "ChallengeError"; },
    auditLogService: {},
    AuditLogError: class extends StubError { name = "AuditLogError"; },
    articleService: {},
    ArticleError: class extends StubError { name = "ArticleError"; },
  };
}

/** Mock the full services barrel with stubs */
export function setupServiceBarrelMock(overrides: Record<string, any> = {}) {
  jest.mock("../../src/services", () => ({
    ...getServiceBarrelStubs(),
    ...overrides,
  }));
}

/** Common XSS payloads for validation testing */
export const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '"><img src=x onerror=alert(1)>',
  "javascript:alert(1)",
  '<svg onload=alert(1)>',
];

/** Common SQL injection payloads for validation testing */
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "1 OR 1=1",
  "' UNION SELECT * FROM users --",
];

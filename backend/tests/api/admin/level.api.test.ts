import request from "supertest";

// Mock multer to be a pass-through (no file processing)
jest.mock("../../../src/utils/services/multer", () => ({
  storageData: () => ({
    single: () => (req: any, _res: any, next: any) => next(),
    array: () => (req: any, _res: any, next: any) => next(),
    none: () => (req: any, _res: any, next: any) => next(),
  }),
}));

// Mock cacheInvalidation (level service imports invalidateLevels)
jest.mock("../../../src/utils/services/redis/cacheInvalidation", () => ({
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

// Override auth middleware to use super_admin role (required for level delete)
const superAdminUser = {
  id: 1,
  first_name: "Test",
  last_name: "SuperAdmin",
  email: "superadmin@test.com",
  role: "super_admin",
  is_verified: true,
  is_active: true,
  school_id: null,
};

jest.mock("../../../src/middlewares/authMiddleware", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = superAdminUser;
    next();
  },
  requireRole: () => (req: any, _res: any, next: any) => {
    req.user = superAdminUser;
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => {
    req.user = superAdminUser;
    next();
  },
  requireTeacher: (req: any, _res: any, next: any) => {
    req.user = superAdminUser;
    next();
  },
  invalidateUserCache: jest.fn(),
}));

jest.mock("../../../src/services", () => ({
  levelService: {
    createLevel: jest.fn(),
    getAllLevels: jest.fn(),
    getLevelById: jest.fn(),
    updateLevel: jest.fn(),
    applyLevelFormula: jest.fn(),
    deleteLevel: jest.fn(),
  },
  LevelError: class LevelError extends Error {
    statusCode: number;
    data?: any;
    constructor(message: string, statusCode: number = 400, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.name = "LevelError";
      this.data = data;
    }
  },
  // Re-export other services as empty stubs so the import doesn't break
  activityService: {
    getAllActivities: jest.fn(),
    getActivityById: jest.fn(),
    reviewActivity: jest.fn(),
  },
  ActivityError: class extends Error {
    statusCode = 400;
    constructor(m: string) { super(m); }
  },
  authService: {},
  AuthError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  userService: {},
  UserError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  studentService: {},
  StudentError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  schoolService: {},
  SchoolError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  teacherService: {},
  TeacherError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  challengeService: {},
  ChallengeError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  auditLogService: {},
  AuditLogError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
  articleService: {},
  ArticleError: class extends Error { statusCode = 400; constructor(m: string) { super(m); } },
}));

import app from "../../../src/app";
import { levelService } from "../../../src/services";

describe("Level Admin API", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/v1/admin/levels", () => {
    test("200 - returns levels list", async () => {
      (levelService.getAllLevels as jest.Mock).mockResolvedValue([
        { id: 1, title: "Level 1", min_xp: 0 },
        { id: 2, title: "Level 2", min_xp: 100 },
      ]);

      const res = await request(app).get("/api/v1/admin/levels");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(levelService.getAllLevels).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/v1/admin/levels", () => {
    test("201 - creates level with valid data", async () => {
      const mockLevel = { id: 1, title: "Level 1", min_xp: 0 };
      (levelService.createLevel as jest.Mock).mockResolvedValue(mockLevel);

      const res = await request(app)
        .post("/api/v1/admin/levels")
        .send({ id: 1, title: "Level 1", min_xp: 0 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(levelService.createLevel).toHaveBeenCalledWith({
        id: 1,
        title: "Level 1",
        min_xp: 0,
      });
    });

    test("400 - validation error when missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/admin/levels")
        .send({ title: "Level 1" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/admin/levels/:id", () => {
    test("200 - returns level by id", async () => {
      const mockLevel = { id: 1, title: "Level 1", min_xp: 0 };
      (levelService.getLevelById as jest.Mock).mockResolvedValue(mockLevel);

      const res = await request(app).get("/api/v1/admin/levels/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(levelService.getLevelById).toHaveBeenCalledWith(1);
    });
  });

  describe("DELETE /api/v1/admin/levels/:id", () => {
    test("200 - deletes level", async () => {
      (levelService.deleteLevel as jest.Mock).mockResolvedValue({
        id: 1,
        title: "Level 1",
      });

      const res = await request(app).delete("/api/v1/admin/levels/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(levelService.deleteLevel).toHaveBeenCalledWith(1);
    });
  });
});

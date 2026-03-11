import request from "supertest";

// Mock multer to be a pass-through (routes like articles, badges, categories use multer)
jest.mock("../../../src/utils/services/multer", () => ({
  storageData: () => ({
    single: () => (req: any, _res: any, next: any) => next(),
    array: () => (req: any, _res: any, next: any) => next(),
    none: () => (req: any, _res: any, next: any) => next(),
  }),
}));

// Mock cacheInvalidation (other controllers loaded by app import this)
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

jest.mock("../../../src/services", () => ({
  activityService: {
    getAllActivities: jest.fn(),
    getActivityById: jest.fn(),
    reviewActivity: jest.fn(),
  },
  ActivityError: class ActivityError extends Error {
    statusCode: number;
    data?: any;
    constructor(message: string, statusCode: number = 400, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.name = "ActivityError";
      this.data = data;
    }
  },
  levelService: {
    createLevel: jest.fn(),
    getAllLevels: jest.fn(),
    getLevelById: jest.fn(),
    updateLevel: jest.fn(),
    applyLevelFormula: jest.fn(),
    deleteLevel: jest.fn(),
  },
  LevelError: class extends Error {
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
import { activityService } from "../../../src/services";

describe("Activity Admin API", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/v1/admin/activities", () => {
    test("200 - returns activities list", async () => {
      (activityService.getAllActivities as jest.Mock).mockResolvedValue({
        data: [
          { id: 1, title: "Plant a tree", photos: [] },
          { id: 2, title: "Recycle waste", photos: [] },
        ],
        pagination: {
          currentPage: 1,
          limit: 10,
          totalCount: 2,
          totalPages: 1,
        },
      });

      const res = await request(app).get("/api/v1/admin/activities");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toHaveLength(2);
      expect(activityService.getAllActivities).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/v1/admin/activities/:id", () => {
    test("200 - returns activity by id", async () => {
      (activityService.getActivityById as jest.Mock).mockResolvedValue({
        id: 1,
        title: "Plant a tree",
        description: "Plant a tree in your garden",
        photos: [],
      });

      const res = await request(app).get("/api/v1/admin/activities/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(activityService.getActivityById).toHaveBeenCalledWith(1);
    });

    test("404 - activity not found", async () => {
      const { ActivityError: AE } = jest.requireMock("../../../src/services");
      (activityService.getActivityById as jest.Mock).mockRejectedValue(
        new AE("Activity not found", 404)
      );

      const res = await request(app).get("/api/v1/admin/activities/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

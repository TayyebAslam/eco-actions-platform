import request from "supertest";

// Mock multer to be a pass-through (no file processing)
jest.mock("../../../src/utils/services/multer", () => ({
  storageData: () => ({
    single: () => (req: any, _res: any, next: any) => next(),
    array: () => (req: any, _res: any, next: any) => next(),
    none: () => (req: any, _res: any, next: any) => next(),
  }),
}));

// Mock cacheInvalidation
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

import app from "../../../src/app";
import db from "../../../src/config/db";

// Add missing chainable methods to the db mock
beforeAll(() => {
  const mockDb = db as any;
  mockDb.clone = jest.fn().mockReturnValue(mockDb);
  mockDb.whereRaw = jest.fn().mockReturnValue(mockDb);
  mockDb.orWhereNull = jest.fn().mockReturnValue(mockDb);
  mockDb.orWhere = jest.fn().mockReturnValue(mockDb);
  mockDb.countDistinct = jest.fn().mockReturnValue(mockDb);
  mockDb.map = jest.fn().mockReturnValue([]);
});

describe("Challenge Admin API", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/v1/admin/challenges", () => {
    test("200 - returns challenges list", async () => {
      const mockDb = db as any;
      mockDb.clone.mockReturnValue(mockDb);
      mockDb.orWhereNull.mockReturnValue(mockDb);
      // first() for count query
      (db.first as jest.Mock).mockResolvedValue({ count: "0" });

      const res = await request(app).get("/api/v1/admin/challenges");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/v1/admin/challenges/:id", () => {
    test("200 - returns challenge by id", async () => {
      const mockChallenge = {
        id: 1,
        title: "Eco Challenge",
        description: "Save energy for a week",
        school_id: null,
      };

      // first() is called for the main challenge query, then for participant count
      (db.first as jest.Mock)
        .mockResolvedValueOnce(mockChallenge) // challenge query
        .mockResolvedValueOnce({ count: 0 }); // participant count

      const res = await request(app).get("/api/v1/admin/challenges/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/v1/admin/challenges", () => {
    test("400 - validation error when missing title", async () => {
      const res = await request(app)
        .post("/api/v1/admin/challenges")
        .send({
          description: "A challenge without a title",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/admin/challenges/:id", () => {
    test("200 - deletes challenge", async () => {
      const mockChallenge = {
        id: 1,
        title: "Eco Challenge",
      };

      (db.first as jest.Mock).mockResolvedValue(mockChallenge);
      (db.del as jest.Mock).mockResolvedValue(1);

      const res = await request(app).delete("/api/v1/admin/challenges/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

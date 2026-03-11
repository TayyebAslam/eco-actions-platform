import request from "supertest";

// Mock multer to be a pass-through
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

describe("Badge Admin API", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/v1/admin/badges", () => {
    test("200 - returns badges list", async () => {
      const res = await request(app).get("/api/v1/admin/badges");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toEqual([]);
    });
  });

  describe("POST /api/v1/admin/badges", () => {
    test("201 - creates badge with valid data", async () => {
      const mockBadge = {
        id: 1,
        name: "Eco Warrior",
        icon_url: null,
        criteria: null,
      };

      // first() for checking existing badge - return null (no duplicate)
      (db.first as jest.Mock).mockResolvedValueOnce(null);
      // returning() for insert
      (db.returning as jest.Mock).mockResolvedValueOnce([mockBadge]);

      const res = await request(app)
        .post("/api/v1/admin/badges")
        .send({ name: "Eco Warrior" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Eco Warrior");
    });

    test("400 - validation error when name is too short", async () => {
      const res = await request(app)
        .post("/api/v1/admin/badges")
        .send({ name: "A" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/admin/badges/:id", () => {
    test("200 - returns badge by id", async () => {
      const mockBadge = {
        id: 1,
        name: "Eco Warrior",
        icon_url: null,
        criteria: "Complete 10 activities",
      };

      (db.first as jest.Mock).mockResolvedValueOnce(mockBadge);

      const res = await request(app).get("/api/v1/admin/badges/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Eco Warrior");
    });

    test("404 - badge not found", async () => {
      (db.first as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app).get("/api/v1/admin/badges/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/admin/badges/:id", () => {
    test("200 - deletes badge", async () => {
      const mockBadge = {
        id: 1,
        name: "Eco Warrior",
        icon_url: null,
      };

      (db.first as jest.Mock).mockResolvedValueOnce(mockBadge);

      const res = await request(app).delete("/api/v1/admin/badges/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("404 - badge not found on delete", async () => {
      (db.first as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app).delete("/api/v1/admin/badges/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

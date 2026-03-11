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

describe("Category Admin API", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/v1/admin/categories", () => {
    test("200 - returns categories list", async () => {
      const res = await request(app).get("/api/v1/admin/categories");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toEqual([]);
    });
  });

  describe("POST /api/v1/admin/categories", () => {
    test("201 - creates category with valid data", async () => {
      const mockCategory = {
        id: 1,
        name: "Energy",
        icon_url: null,
        color: null,
        units: null,
      };

      // first() for checking existing category - return null (no duplicate)
      (db.first as jest.Mock).mockResolvedValueOnce(null);
      // returning() for insert
      (db.returning as jest.Mock).mockResolvedValueOnce([mockCategory]);

      const res = await request(app)
        .post("/api/v1/admin/categories")
        .send({ name: "Energy" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Energy");
    });

    test("400 - validation error when name is too short", async () => {
      const res = await request(app)
        .post("/api/v1/admin/categories")
        .send({ name: "A" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/admin/categories/:id", () => {
    test("200 - returns category by id", async () => {
      const mockCategory = {
        id: 1,
        name: "Energy",
        icon_url: null,
        color: "#00FF00",
        units: null,
      };

      (db.first as jest.Mock).mockResolvedValueOnce(mockCategory);

      const res = await request(app).get("/api/v1/admin/categories/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Energy");
    });

    test("404 - category not found", async () => {
      (db.first as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app).get("/api/v1/admin/categories/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/admin/categories/:id", () => {
    test("200 - deletes category", async () => {
      const mockCategory = {
        id: 1,
        name: "Energy",
        icon_url: null,
      };

      // first() returns the category
      (db.first as jest.Mock).mockResolvedValueOnce(mockCategory);

      const res = await request(app).delete("/api/v1/admin/categories/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("404 - category not found on delete", async () => {
      (db.first as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app).delete("/api/v1/admin/categories/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

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

describe("Article Admin API", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/v1/admin/articles", () => {
    test("200 - returns articles list", async () => {
      const res = await request(app).get("/api/v1/admin/articles");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toEqual([]);
    });
  });

  describe("POST /api/v1/admin/articles", () => {
    test("201 - creates article with valid data", async () => {
      const mockArticle = {
        id: 1,
        title: "Test Article",
        content: "This is a test article with enough content",
        category_id: 1,
        author_id: 1,
        school_id: 1,
        cover_image: null,
        thumbnail_image: null,
      };

      (db.returning as jest.Mock).mockResolvedValueOnce([mockArticle]);

      const res = await request(app)
        .post("/api/v1/admin/articles")
        .send({
          title: "Test Article",
          content: "This is a test article with enough content",
          category_id: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Test Article");
    });

    test("400 - validation error when missing title", async () => {
      const res = await request(app)
        .post("/api/v1/admin/articles")
        .send({
          content: "This is a test article with enough content",
          category_id: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/admin/articles/:id", () => {
    test("200 - returns article by id", async () => {
      const mockArticle = {
        id: 1,
        title: "Test Article",
        content: "Test content here with enough length",
        cover_image: null,
        thumbnail_image: null,
        school_id: 1,
      };

      (db.first as jest.Mock).mockResolvedValueOnce(mockArticle);

      const res = await request(app).get("/api/v1/admin/articles/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Test Article");
    });

    test("404 - article not found", async () => {
      (db.first as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app).get("/api/v1/admin/articles/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v1/admin/articles/:id", () => {
    test("200 - deletes article", async () => {
      const mockArticle = {
        id: 1,
        title: "Test Article",
        cover_image: null,
        author_id: 1,
        school_id: 1,
      };

      (db.first as jest.Mock).mockResolvedValueOnce(mockArticle);

      const res = await request(app).delete("/api/v1/admin/articles/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("404 - article not found on delete", async () => {
      (db.first as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app).delete("/api/v1/admin/articles/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

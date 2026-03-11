import request from "supertest";

// Override auth middleware to inject student user
jest.mock("../../../src/middlewares/authMiddleware", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 10, first_name: "Test", last_name: "Student", email: "student@test.com", role: "student", is_active: true, is_verified: true, school_id: 1 };
    next();
  },
  requireRole: () => (req: any, _res: any, next: any) => { req.user = { id: 10, role: "student", is_active: true, school_id: 1 }; next(); },
  requireAdmin: (req: any, _res: any, next: any) => { req.user = { id: 1, role: "admin", is_active: true }; next(); },
  requireTeacher: (req: any, _res: any, next: any) => { req.user = { id: 5, role: "teacher", is_active: true, school_id: 1 }; next(); },
  invalidateUserCache: jest.fn(),
}));

jest.mock("../../../src/services/article.service", () => ({
  articleService: {
    toggleBookmark: jest.fn(),
    addViewAndGetArticle: jest.fn(),
    getArticleForStudent: jest.fn(),
    markReadAndAwardPoints: jest.fn(),
    getBookmarkedArticles: jest.fn(),
    getAllArticlesForStudent: jest.fn(),
    getReadHistoryForStudent: jest.fn(),
    getRecommendedArticlesForStudent: jest.fn(),
    getArticleDashboardForStudent: jest.fn(),
  },
  ArticleError: class ArticleError extends Error {
    statusCode: number;
    data?: any;
    name = "ArticleError";
    constructor(message: string, statusCode: number, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.data = data;
    }
  },
}));

import app from "../../../src/app";
import { articleService } from "../../../src/services/article.service";

const BASE = "/api/v1/student/articles";

describe("Student Article API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET ALL ARTICLES ───────────────────────────────
  describe("GET /articles", () => {
    test("200 - fetches all articles", async () => {
      (articleService.getAllArticlesForStudent as jest.Mock).mockResolvedValue({
        data: [{ id: 1, title: "Green Energy 101" }],
        pagination: { currentPage: 1, limit: 4, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(BASE);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET ARTICLE BY ID ──────────────────────────────
  describe("GET /articles/:id", () => {
    test("200 - fetches article by id", async () => {
      (articleService.getArticleForStudent as jest.Mock).mockResolvedValue({
        id: 1,
        title: "Green Energy 101",
        content: "Article content",
      });

      const res = await request(app).get(`${BASE}/1`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET BOOKMARKED ARTICLES ────────────────────────
  describe("GET /articles/bookmarks", () => {
    test("200 - fetches bookmarked articles", async () => {
      (articleService.getBookmarkedArticles as jest.Mock).mockResolvedValue({
        data: [{ id: 1, title: "Bookmarked Article" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(`${BASE}/bookmarks`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET ARTICLE DASHBOARD ──────────────────────────
  describe("GET /articles/dashboard", () => {
    test("200 - fetches article dashboard", async () => {
      (articleService.getArticleDashboardForStudent as jest.Mock).mockResolvedValue({
        totalRead: 5,
        totalPoints: 50,
      });

      const res = await request(app).get(`${BASE}/dashboard`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── ADD ARTICLE VIEW ──────────────────────────────
  describe("POST /articles/:id/view", () => {
    test("200 - records article view", async () => {
      (articleService.addViewAndGetArticle as jest.Mock).mockResolvedValue({
        id: 1,
        title: "Viewed Article",
        view_count: 5,
      });

      const res = await request(app).post(`${BASE}/1/view`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── TOGGLE ARTICLE BOOKMARK ───────────────────────
  describe("POST /articles/:id/bookmark", () => {
    test("200 - toggles article bookmark", async () => {
      (articleService.toggleBookmark as jest.Mock).mockResolvedValue({
        bookmarked: true,
      });

      const res = await request(app).post(`${BASE}/1/bookmark`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

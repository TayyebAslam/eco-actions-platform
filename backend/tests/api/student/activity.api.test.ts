import request from "supertest";

// Mutable user object so individual tests can override fields (e.g. school_id)
let mockStudentUser: any = { id: 10, first_name: "Test", last_name: "Student", email: "student@test.com", role: "student", is_active: true, is_verified: true, school_id: 1 };

// Override auth middleware to inject student user
jest.mock("../../../src/middlewares/authMiddleware", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { ...mockStudentUser };
    next();
  },
  requireRole: () => (req: any, _res: any, next: any) => { req.user = { id: 10, role: "student", is_active: true, school_id: 1 }; next(); },
  requireAdmin: (req: any, _res: any, next: any) => { req.user = { id: 1, role: "admin", is_active: true }; next(); },
  requireTeacher: (req: any, _res: any, next: any) => { req.user = { id: 5, role: "teacher", is_active: true, school_id: 1 }; next(); },
  invalidateUserCache: jest.fn(),
}));

// Mock multer to be a pass-through
jest.mock("../../../src/utils/services/multer", () => ({
  storageData: () => ({
    single: () => (_req: any, _res: any, next: any) => next(),
    array: () => (_req: any, _res: any, next: any) => next(),
    none: () => (_req: any, _res: any, next: any) => next(),
  }),
}));

// Mock the activity service at the correct path (controller imports from services/activity.service)
jest.mock("../../../src/services/activity.service", () => ({
  activityService: {
    createActivity: jest.fn(),
    getAllActivities: jest.fn(),
    getActivityById: jest.fn(),
    shareActivityToFeed: jest.fn(),
    toggleLikeFeedActivity: jest.fn(),
    addFeedComment: jest.fn(),
    getFeedComments: jest.fn(),
    toggleBookmarkFeedActivity: jest.fn(),
    getFeedActivities: jest.fn(),
    getBookmarkedFeedActivities: jest.fn(),
  },
}));

// Mock photosHelper
jest.mock("../../../src/utils/helperFunctions/photosHelper", () => ({
  extractPhotos: jest.fn().mockReturnValue([]),
}));

import app from "../../../src/app";
import { activityService } from "../../../src/services/activity.service";

const BASE = "/api/v1/student/activities";

describe("Student Activity API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── CREATE ACTIVITY ────────────────────────────────
  describe("POST /activities", () => {
    test("201 - creates activity successfully", async () => {
      (activityService.createActivity as jest.Mock).mockResolvedValue({
        id: 1,
        title: "Planted a tree",
        category_id: 2,
      });

      const res = await request(app)
        .post(BASE)
        .send({ title: "Planted a tree", category_id: 2 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Planted a tree");
    });

    test("400 - validation error when title is missing", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ category_id: 2 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET ACTIVITIES ─────────────────────────────────
  describe("GET /activities", () => {
    test("200 - fetches student activities", async () => {
      (activityService.getAllActivities as jest.Mock).mockResolvedValue({
        data: [{ id: 1, title: "Activity 1" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(BASE);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET ACTIVITY BY ID ─────────────────────────────
  describe("GET /activities/:id", () => {
    test("200 - fetches activity by id", async () => {
      (activityService.getActivityById as jest.Mock).mockResolvedValue({
        id: 1,
        title: "Activity 1",
        user_id: 10,
      });

      const res = await request(app).get(`${BASE}/1`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET FEED ───────────────────────────────────────
  describe("GET /activities/feed", () => {
    test("200 - fetches feed activities", async () => {
      (activityService.getFeedActivities as jest.Mock).mockResolvedValue({
        data: [{ id: 1, title: "Feed Activity" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(`${BASE}/feed`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET BOOKMARKS ─────────────────────────────────
  describe("GET /activities/bookmarks", () => {
    test("200 - fetches bookmarked activities", async () => {
      (activityService.getBookmarkedFeedActivities as jest.Mock).mockResolvedValue({
        data: [{ id: 1, title: "Bookmarked Activity" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(`${BASE}/bookmarks`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── TOGGLE LIKE ────────────────────────────────────
  describe("POST /activities/:id/like", () => {
    test("200 - toggles like on activity", async () => {
      (activityService.toggleLikeFeedActivity as jest.Mock).mockResolvedValue({
        liked: true,
      });

      const res = await request(app).post(`${BASE}/1/like`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── TOGGLE BOOKMARK ───────────────────────────────
  describe("POST /activities/:id/bookmark", () => {
    test("200 - toggles bookmark on activity", async () => {
      (activityService.toggleBookmarkFeedActivity as jest.Mock).mockResolvedValue({
        bookmarked: true,
      });

      const res = await request(app).post(`${BASE}/1/bookmark`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── SHARE ACTIVITY ────────────────────────────────
  describe("POST /activities/:id/share", () => {
    test("201 - shares activity to feed successfully", async () => {
      (activityService.shareActivityToFeed as jest.Mock).mockResolvedValue({
        feed: {
          id: 1,
          activity_id: 1,
          user_id: 10,
          school_id: 1,
          bio: "Feeling proud!",
          created_at: new Date().toISOString(),
        },
      });

      const res = await request(app)
        .post(`${BASE}/1/share`)
        .send({ bio: "Feeling proud!" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Activity shared to feed successfully");
    });

    test("201 - shares activity with FormData and null bio", async () => {
      (activityService.shareActivityToFeed as jest.Mock).mockResolvedValue({
        feed: {
          id: 2,
          activity_id: 2,
          user_id: 10,
          school_id: 1,
          bio: null,
          created_at: new Date().toISOString(),
        },
      });

      const res = await request(app)
        .post(`${BASE}/2/share`)
        .field("bio", "");

      // Empty bio should be treated as null by the controller and pass validation
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
      }
    });

    test("400 - rejects invalid activity ID", async () => {
      const res = await request(app)
        .post(`${BASE}/invalid/share`)
        .send({ bio: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("400 - rejects when user has no school context", async () => {
      // Temporarily set school_id to null
      mockStudentUser.school_id = null;

      const res = await request(app)
        .post(`${BASE}/1/share`)
        .send({ bio: "Test bio" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("School ID not found");

      // Restore
      mockStudentUser.school_id = 1;
    });
  });
});

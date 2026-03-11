import request from "supertest";

// Override auth middleware to inject teacher user
jest.mock("../../../src/middlewares/authMiddleware", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 5, role: "teacher", is_active: true, school_id: 1 };
    next();
  },
  requireRole: () => (req: any, _res: any, next: any) => {
    req.user = { id: 5, role: "teacher", is_active: true, school_id: 1 };
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: "admin", is_active: true };
    next();
  },
  requireTeacher: (req: any, _res: any, next: any) => {
    req.user = { id: 5, first_name: "Test", last_name: "Teacher", email: "teacher@test.com", role: "teacher", is_active: true, school_id: 1 };
    next();
  },
  invalidateUserCache: jest.fn(),
}));

jest.mock("../../../src/services", () => ({
  userService: {
    getSchoolUsers: jest.fn(),
  },
  UserError: class UserError extends Error {
    statusCode: number;
    name = "UserError";
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  activityService: {
    getAllActivities: jest.fn(),
    reviewActivity: jest.fn(),
  },
  ActivityError: class ActivityError extends Error {
    statusCode: number;
    name = "ActivityError";
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import app from "../../../src/app";
import { userService, activityService } from "../../../src/services";

const BASE = "/api/v1/teacher";

describe("Teacher API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET SCHOOL USERS ───────────────────────────────
  describe("GET /users", () => {
    test("200 - fetches school users", async () => {
      (userService.getSchoolUsers as jest.Mock).mockResolvedValue({
        data: [{ id: 10, first_name: "Student", role: "student" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(`${BASE}/users`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET ACTIVITIES ─────────────────────────────────
  describe("GET /activities", () => {
    test("200 - fetches activities for teacher's school", async () => {
      (activityService.getAllActivities as jest.Mock).mockResolvedValue({
        data: [{ id: 1, title: "Student Activity", status: "pending" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(`${BASE}/activities`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── REVIEW ACTIVITY ───────────────────────────────
  describe("POST /activities/:activityId/review", () => {
    test("200 - approves activity with points", async () => {
      (activityService.reviewActivity as jest.Mock).mockResolvedValue({
        points: 10,
      });

      const res = await request(app)
        .post(`${BASE}/activities/1/review`)
        .send({ status: "approved", points: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("400 - validation error when status is invalid", async () => {
      const res = await request(app)
        .post(`${BASE}/activities/1/review`)
        .send({ status: "invalid_status" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

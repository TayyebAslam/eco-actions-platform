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

jest.mock("../../../src/services/student.service", () => ({
  studentService: {
    getStudentLeaderboard: jest.fn(),
    getSchoolsLeaderboard: jest.fn(),
  },
  StudentError: class StudentError extends Error {
    statusCode: number;
    data?: any;
    name = "StudentError";
    constructor(message: string, statusCode: number, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.data = data;
    }
  },
}));

import app from "../../../src/app";
import { studentService } from "../../../src/services/student.service";

const BASE = "/api/v1/student/leaderboard";

describe("Student Leaderboard API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET STUDENT LEADERBOARD ────────────────────────
  describe("GET /leaderboard", () => {
    test("200 - fetches student leaderboard", async () => {
      (studentService.getStudentLeaderboard as jest.Mock).mockResolvedValue({
        data: [
          { rank: 1, user_id: 10, first_name: "Test", total_points: 100 },
        ],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(BASE);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET SCHOOLS LEADERBOARD ────────────────────────
  describe("GET /leaderboard/schools", () => {
    test("200 - fetches schools leaderboard", async () => {
      (studentService.getSchoolsLeaderboard as jest.Mock).mockResolvedValue({
        data: [
          { rank: 1, school_id: 1, school_name: "Green School", total_points: 500 },
        ],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      });

      const res = await request(app).get(`${BASE}/schools`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

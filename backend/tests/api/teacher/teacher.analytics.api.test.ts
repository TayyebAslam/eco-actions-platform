import request from "supertest";

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
    req.user = {
      id: 5,
      first_name: "Test",
      last_name: "Teacher",
      email: "teacher@test.com",
      role: "teacher",
      is_active: true,
      school_id: 1,
    };
    next();
  },
  invalidateUserCache: jest.fn(),
}));

jest.mock("../../../src/services", () => ({
  teacherAnalyticsService: {
    getDashboard: jest.fn(),
  },
}));

import app from "../../../src/app";
import { teacherAnalyticsService } from "../../../src/services";

const BASE = "/api/v1/teacher";

describe("Teacher Analytics API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 - fetches dashboard analytics", async () => {
    (teacherAnalyticsService.getDashboard as jest.Mock).mockResolvedValue({
      range: "this_week",
      cards: {
        active_users: { value: 247, change_percent: 12 },
        activities: { value: 892, change_percent: 8 },
        points_awarded: { value: 15400, change_percent: 15 },
        completions: { value: 45, change_percent: 22 },
      },
      weekly_trends: [],
      category_breakdown: { total_activities: 892, data: [] },
      featured_challenge: null,
      engagement_insights: {
        peak_activity_time: "3:00 PM - 5:00 PM",
        most_popular_activity: "Recycling Plastic",
        avg_streak_length: 8.6,
        most_active_class: "Grade 7 - Class A",
        top_article: "Climate Change Basics",
      },
    });

    const res = await request(app).get(`${BASE}/analytics/dashboard?range=this_week`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cards.activities.value).toBe(892);
    expect(teacherAnalyticsService.getDashboard).toHaveBeenCalledWith(1, "this_week");
  });

  test("400 - invalid range query", async () => {
    const res = await request(app).get(`${BASE}/analytics/dashboard?range=yearly`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(teacherAnalyticsService.getDashboard).not.toHaveBeenCalled();
  });
});

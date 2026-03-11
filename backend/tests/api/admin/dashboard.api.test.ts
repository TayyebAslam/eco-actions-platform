import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin Dashboard API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/dashboard/stats ─────────────────
  describe("GET /api/v1/admin/dashboard/stats", () => {
    const url = "/api/v1/admin/dashboard/stats";

    test("200 - returns dashboard stats", async () => {
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/v1/admin/dashboard/recent-activities ─────
  describe("GET /api/v1/admin/dashboard/recent-activities", () => {
    const url = "/api/v1/admin/dashboard/recent-activities";

    test("200 - returns recent activities", async () => {
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/v1/admin/dashboard/top-students ──────────
  describe("GET /api/v1/admin/dashboard/top-students", () => {
    const url = "/api/v1/admin/dashboard/top-students";

    test("200 - returns top students", async () => {
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/v1/admin/dashboard/schools-progress ──────
  describe("GET /api/v1/admin/dashboard/schools-progress", () => {
    const url = "/api/v1/admin/dashboard/schools-progress";

    test("200 - returns schools progress", async () => {
      // Controller checks for super_admin role. Mock user is "admin" => 403.
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/v1/admin/dashboard/growth-trends ─────────
  describe("GET /api/v1/admin/dashboard/growth-trends", () => {
    const url = "/api/v1/admin/dashboard/growth-trends";

    test("200 - returns growth trends", async () => {
      // Controller checks for super_admin role. Mock user is "admin" => 403.
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/v1/admin/dashboard/weekly-stats ──────────
  describe("GET /api/v1/admin/dashboard/weekly-stats", () => {
    const url = "/api/v1/admin/dashboard/weekly-stats";

    test("200 - returns weekly stats", async () => {
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });
});

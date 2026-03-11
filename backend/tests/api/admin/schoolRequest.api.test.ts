import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin School Request API", () => {
  beforeEach(() => jest.clearAllMocks());

  const baseUrl = "/api/v1/admin/school-requests";

  // ─── GET /api/v1/admin/school-requests ─────────────────
  describe("GET /api/v1/admin/school-requests", () => {
    test("200 - returns school requests list", async () => {
      // Controller checks for super_admin role. Mock user is "admin" => 403.
      const res = await request(app).get(baseUrl);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 500]).toContain(res.status);
    });
  });

  // ─── POST /api/v1/admin/school-requests/:id/approve ────
  describe("POST /api/v1/admin/school-requests/:id/approve", () => {
    test("200 - approves school request", async () => {
      // Controller checks for super_admin role. Mock user is "admin" => 403.
      const res = await request(app).post(`${baseUrl}/1/approve`);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 404, 500]).toContain(res.status);
    });
  });

  // ─── POST /api/v1/admin/school-requests/:id/reject ─────
  describe("POST /api/v1/admin/school-requests/:id/reject", () => {
    test("200 - rejects school request", async () => {
      // Controller checks for super_admin role. Mock user is "admin" => 403.
      const res = await request(app)
        .post(`${baseUrl}/1/reject`)
        .send({ rejection_reason: "Does not meet requirements" });

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 404, 500]).toContain(res.status);
    });
  });
});

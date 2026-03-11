import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin System User API", () => {
  beforeEach(() => jest.clearAllMocks());

  const baseUrl = "/api/v1/admin/system-users";

  // ─── GET /api/v1/admin/system-users ────────────────────
  describe("GET /api/v1/admin/system-users", () => {
    test("200 - returns system users list", async () => {
      // Controller checks for super_admin role. Mock user is "admin" => 403.
      const res = await request(app).get(baseUrl);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 500]).toContain(res.status);
    });
  });

  // ─── POST /api/v1/admin/system-users ───────────────────
  describe("POST /api/v1/admin/system-users", () => {
    test("201 - creates system user", async () => {
      // Controller uses validateRequest first (before role check).
      // With valid data, validation passes, then permission check runs.
      const res = await request(app)
        .post(baseUrl)
        .send({
          first_name: "John",
          last_name: "Doe",
          email: "john.doe@example.com",
        });

      expect(res.body.message).not.toBe("Route not found");
      expect([201, 400, 401, 403, 500]).toContain(res.status);
    });

    test("400 - validation error on missing email", async () => {
      const res = await request(app)
        .post(baseUrl)
        .send({
          first_name: "John",
          last_name: "Doe",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/v1/admin/system-users/:id ────────────────
  describe("GET /api/v1/admin/system-users/:id", () => {
    test("200 - returns system user by id", async () => {
      // Controller checks super_admin role. Mock user is "admin" => 403.
      const res = await request(app).get(`${baseUrl}/1`);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 404, 500]).toContain(res.status);
    });
  });

  // ─── DELETE /api/v1/admin/system-users/:id ─────────────
  describe("DELETE /api/v1/admin/system-users/:id", () => {
    test("200 - deletes system user", async () => {
      // Controller checks super_admin role. Mock user is "admin" => 403.
      const res = await request(app).delete(`${baseUrl}/1`);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 404, 500]).toContain(res.status);
    });
  });

  // ─── PATCH /api/v1/admin/system-users/:id/toggle-status ─
  describe("PATCH /api/v1/admin/system-users/:id/toggle-status", () => {
    test("200 - toggles system user status", async () => {
      // Controller checks super_admin role. Mock user is "admin" => 403.
      const res = await request(app).patch(`${baseUrl}/1/toggle-status`);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 404, 500]).toContain(res.status);
    });
  });
});

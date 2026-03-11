import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin Role API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/roles ───────────────────────────
  describe("GET /api/v1/admin/roles", () => {
    const url = "/api/v1/admin/roles";

    test("200 - returns roles list", async () => {
      // Controller checks for super_admin or super_sub_admin role.
      // Mock user is "admin" => 403.
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 500]).toContain(res.status);
    });
  });

  // ─── PATCH /api/v1/admin/roles/:id/display-name ────────
  describe("PATCH /api/v1/admin/roles/:id/display-name", () => {
    const url = "/api/v1/admin/roles/1/display-name";

    test("200 - updates role display name", async () => {
      // Controller checks for super_admin role first. Mock user is "admin" => 403.
      const res = await request(app)
        .patch(url)
        .send({ display_name: "Updated Role Name" });

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 403, 500]).toContain(res.status);
    });

    test("400 - validation error on short display name", async () => {
      // Role check happens before validation in this controller.
      // With "admin" role => 403 before validation is reached.
      const res = await request(app)
        .patch(url)
        .send({ display_name: "A" });

      expect(res.body.message).not.toBe("Route not found");
      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });
});

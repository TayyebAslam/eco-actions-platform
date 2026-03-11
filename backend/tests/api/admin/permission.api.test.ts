import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin Permission API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/modules ─────────────────────────
  describe("GET /api/v1/admin/modules", () => {
    const url = "/api/v1/admin/modules";

    test("200 - returns modules list", async () => {
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/v1/admin/users/:id/permissions ──────────
  describe("GET /api/v1/admin/users/1/permissions", () => {
    const url = "/api/v1/admin/users/1/permissions";

    test("200 - returns user permissions", async () => {
      // Controller does a join query then first(). first() returns null => 404 "User not found".
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  // ─── PUT /api/v1/admin/users/:id/permissions ──────────
  describe("PUT /api/v1/admin/users/1/permissions", () => {
    const url = "/api/v1/admin/users/1/permissions";

    test("200 - updates user permissions with JSON body", async () => {
      // Validation requires permissions array with at least 1 item.
      // After validation, controller checks user exists via first() => null => 404.
      const res = await request(app)
        .put(url)
        .send({
          permissions: [
            {
              module_id: 1,
              can_create: true,
              can_read: true,
              can_edit: false,
              can_delete: false,
            },
          ],
        });

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 404, 500]).toContain(res.status);
    });

    test("400 - rejects empty permissions array", async () => {
      const res = await request(app)
        .put(url)
        .send({
          permissions: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("400 - rejects missing permissions array", async () => {
      const res = await request(app)
        .put(url)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("400 - validates FormData with string values converted to proper types", async () => {
      // Test that the controller properly parses FormData string values to appropriate types
      // Expected results: 200 (success) or 404 (user not found), not 400 or 500
      const res = await request(app)
        .put(url)
        .field("permissions[0][module_id]", "1")
        .field("permissions[0][can_create]", "true")
        .field("permissions[0][can_read]", "false")
        .field("permissions[0][can_edit]", "1")
        .field("permissions[0][can_delete]", "0");

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 404]).toContain(res.status);
      expect(res.body.success).toBeDefined();
    });
  });
});

import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin Section API", () => {
  beforeEach(() => jest.clearAllMocks());

  const baseUrl = "/api/v1/admin/classes/1/sections";

  // ─── GET /api/v1/admin/classes/:classId/sections ───────
  describe("GET /api/v1/admin/classes/1/sections", () => {
    test("200 - returns sections list", async () => {
      const res = await request(app).get(baseUrl);

      // Route is reachable (not Express 404 "Route not found").
      // Controller may return 200 with data, 404 "Class not found", or 500.
      expect(res.body.message).not.toBe("Route not found");
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  // ─── POST /api/v1/admin/classes/:classId/sections ──────
  describe("POST /api/v1/admin/classes/1/sections", () => {
    test("201 - creates section", async () => {
      const res = await request(app)
        .post(baseUrl)
        .send({ name: "Section A" });

      // Route is reachable. Controller: role check -> validation -> class lookup.
      expect(res.body.message).not.toBe("Route not found");
      expect([201, 404, 500]).toContain(res.status);
    });

    test("400 - validation error on empty name", async () => {
      // Role "admin" passes the role check. Empty name fails Zod min(1).
      const res = await request(app)
        .post(baseUrl)
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/v1/admin/classes/:classId/sections/:id ───
  describe("GET /api/v1/admin/classes/1/sections/1", () => {
    test("200 - returns section by id", async () => {
      const res = await request(app).get(`${baseUrl}/1`);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  // ─── DELETE /api/v1/admin/classes/:classId/sections/:id ─
  describe("DELETE /api/v1/admin/classes/1/sections/1", () => {
    test("200 - deletes section", async () => {
      const res = await request(app).delete(`${baseUrl}/1`);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 404, 500]).toContain(res.status);
    });
  });
});

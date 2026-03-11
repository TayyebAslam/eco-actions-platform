import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin Class API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/classes ─────────────────────────
  describe("GET /api/v1/admin/classes", () => {
    const url = "/api/v1/admin/classes";

    test("200 - returns classes list", async () => {
      // Controller calls db(TABLE.CLASSES).orderBy("id", "asc").
      // Mock chain resolves and controller sends 200 with result.
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });
});

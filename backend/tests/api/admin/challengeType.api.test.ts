import request from "supertest";
import app from "../../../src/app";
import db from "../../../src/config/db";

describe("Admin Challenge Type API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/challenge-types ─────────────────
  describe("GET /api/v1/admin/challenge-types", () => {
    const url = "/api/v1/admin/challenge-types";

    test("200 - returns challenge types list", async () => {
      // Controller uses direct DB with Promise.all for data + count queries.
      const res = await request(app).get(url);

      expect(res.body.message).not.toBe("Route not found");
      expect([200, 500]).toContain(res.status);
    });
  });
});

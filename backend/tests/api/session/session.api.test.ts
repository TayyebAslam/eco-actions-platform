import request from "supertest";

import app from "../../../src/app";
import { sessionService } from "../../../src/services/session.service";

const BASE = "/api/v1/sessions";

describe("Session API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET ACTIVE SESSIONS ───────────────────────────
  describe("GET /sessions", () => {
    test("200 - fetches active sessions", async () => {
      (sessionService.getActiveSessions as jest.Mock).mockResolvedValue([
        { id: 1, browser: "Chrome", os: "Linux", is_current: true },
      ]);

      const res = await request(app).get(BASE);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessions).toBeDefined();
    });
  });

  // ─── REVOKE SESSION ─────────────────────────────────
  describe("DELETE /sessions/:id", () => {
    test("200 - revokes a specific session", async () => {
      (sessionService.getActiveSessions as jest.Mock).mockResolvedValue([
        { id: 5, browser: "Firefox", os: "Windows", is_current: false, session_token: "tok-5" },
      ]);
      (sessionService.invalidateSession as jest.Mock).mockResolvedValue(true);

      const res = await request(app).delete(`${BASE}/5`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

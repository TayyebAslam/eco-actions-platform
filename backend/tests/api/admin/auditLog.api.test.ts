import request from "supertest";
import { AuditLogError } from "../../../src/utils/errors";

jest.mock("../../../src/services", () => ({
  auditLogService: {
    getAll: jest.fn(),
    getById: jest.fn(),
  },
  AuditLogError,
}));

import app from "../../../src/app";
import { auditLogService } from "../../../src/services";

describe("Admin Audit Log API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/audit-logs ──────────────────────
  describe("GET /api/v1/admin/audit-logs", () => {
    const url = "/api/v1/admin/audit-logs";

    test("200 - returns audit logs list", async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            user_email: "user@test.com",
            action: "CREATE",
            module: "schools",
            status: "success",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      (auditLogService.getAll as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).get(url);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Audit logs fetched successfully");
      expect(auditLogService.getAll).toHaveBeenCalledTimes(1);
    });
  });

  // ─── GET /api/v1/admin/audit-logs/:id ──────────────────
  describe("GET /api/v1/admin/audit-logs/:id", () => {
    test("200 - returns audit log by id", async () => {
      const mockLog = {
        id: 1,
        user_email: "user@test.com",
        action: "CREATE",
        module: "schools",
        school_id: 1,
        status: "success",
        created_at: "2026-01-01T00:00:00.000Z",
      };
      (auditLogService.getById as jest.Mock).mockResolvedValue(mockLog);

      const res = await request(app).get("/api/v1/admin/audit-logs/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Audit log fetched successfully");
      expect(auditLogService.getById).toHaveBeenCalledWith(1);
    });

    test("404 - audit log not found", async () => {
      (auditLogService.getById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get("/api/v1/admin/audit-logs/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Audit log not found");
    });
  });
});

import request from "supertest";
import { SchoolError } from "../../../src/utils/errors";

jest.mock("../../../src/services", () => ({
  schoolService: {
    createSchool: jest.fn(),
    getAllSchools: jest.fn(),
    getSchoolById: jest.fn(),
    updateSchool: jest.fn(),
    deleteSchool: jest.fn(),
    toggleStatus: jest.fn(),
    submitSchoolRequest: jest.fn(),
    getAllSchoolswithName: jest.fn(),
  },
  SchoolError,
}));

import app from "../../../src/app";
import { schoolService } from "../../../src/services";

describe("Admin School API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/schools ───────────────────────
  describe("GET /api/v1/admin/schools", () => {
    const url = "/api/v1/admin/schools";

    test("200 - returns schools list", async () => {
      const mockResult = {
        data: [
          { id: 1, name: "School A", subscription_status: "active" },
          { id: 2, name: "School B", subscription_status: "inactive" },
        ],
        pagination: {
          currentPage: 1,
          limit: 10,
          totalCount: 2,
          totalPages: 1,
        },
      };
      (schoolService.getAllSchools as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).get(url).query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Schools fetched successfully");
      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.totalCount).toBe(2);
      expect(schoolService.getAllSchools).toHaveBeenCalledTimes(1);
    });

    test("500 - service error", async () => {
      (schoolService.getAllSchools as jest.Mock).mockRejectedValue(new Error("DB connection failed"));

      const res = await request(app).get(url);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/v1/admin/schools ──────────────────────
  describe("POST /api/v1/admin/schools", () => {
    const url = "/api/v1/admin/schools";

    test("201 - creates school successfully", async () => {
      const mockCreated = { id: 1, name: "New School", subscription_status: "active" };
      (schoolService.createSchool as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app)
        .post(url)
        .field("name", "New School")
        .field("address", "123 Main St");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("School created successfully");
      expect(schoolService.createSchool).toHaveBeenCalledTimes(1);
    });

    test("400 - validation error (missing name)", async () => {
      const res = await request(app)
        .post(url)
        .field("address", "123 Main St");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(schoolService.createSchool).not.toHaveBeenCalled();
    });

    test("400 - validation error (name too short)", async () => {
      const res = await request(app)
        .post(url)
        .field("name", "A");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(schoolService.createSchool).not.toHaveBeenCalled();
    });

    test("409 - duplicate school name", async () => {
      (schoolService.createSchool as jest.Mock).mockRejectedValue(
        new SchoolError("School with this name already exists", 409)
      );

      const res = await request(app)
        .post(url)
        .field("name", "Existing School");

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("School with this name already exists");
    });

    test("500 - service throws unexpected error", async () => {
      (schoolService.createSchool as jest.Mock).mockRejectedValue(new Error("Unexpected"));

      const res = await request(app)
        .post(url)
        .field("name", "New School");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/v1/admin/schools/:id ───────────────────
  describe("GET /api/v1/admin/schools/:id", () => {
    test("200 - returns school by id", async () => {
      const mockSchool = { id: 1, name: "School A", subscription_status: "active" };
      (schoolService.getSchoolById as jest.Mock).mockResolvedValue(mockSchool);

      const res = await request(app).get("/api/v1/admin/schools/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("School fetched successfully");
      expect(res.body.data.id).toBe(1);
      expect(schoolService.getSchoolById).toHaveBeenCalledWith(1);
    });

    test("404 - school not found", async () => {
      (schoolService.getSchoolById as jest.Mock).mockRejectedValue(
        new SchoolError("School not found", 404)
      );

      const res = await request(app).get("/api/v1/admin/schools/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("School not found");
    });

    test("500 - service error", async () => {
      (schoolService.getSchoolById as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/api/v1/admin/schools/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── PATCH /api/v1/admin/schools/:id ─────────────────
  describe("PATCH /api/v1/admin/schools/:id", () => {
    test("200 - updates school successfully", async () => {
      const mockUpdated = { id: 1, name: "Updated School", subscription_status: "active" };
      (schoolService.updateSchool as jest.Mock).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .patch("/api/v1/admin/schools/1")
        .field("name", "Updated School");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("School updated successfully");
      expect(schoolService.updateSchool).toHaveBeenCalledTimes(1);
    });

    test("404 - school not found on update", async () => {
      (schoolService.updateSchool as jest.Mock).mockRejectedValue(
        new SchoolError("School not found", 404)
      );

      const res = await request(app)
        .patch("/api/v1/admin/schools/999")
        .field("name", "Updated School");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("School not found");
    });

    test("500 - service error on update", async () => {
      (schoolService.updateSchool as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .patch("/api/v1/admin/schools/1")
        .field("name", "Updated School");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── DELETE /api/v1/admin/schools/:id ────────────────
  describe("DELETE /api/v1/admin/schools/:id", () => {
    test("200 - deletes school successfully", async () => {
      (schoolService.deleteSchool as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete("/api/v1/admin/schools/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("School deleted successfully");
      expect(schoolService.deleteSchool).toHaveBeenCalledWith(1, "admin");
    });

    test("404 - school not found on delete", async () => {
      (schoolService.deleteSchool as jest.Mock).mockRejectedValue(
        new SchoolError("School not found", 404)
      );

      const res = await request(app).delete("/api/v1/admin/schools/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("School not found");
    });

    test("500 - service error on delete", async () => {
      (schoolService.deleteSchool as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/api/v1/admin/schools/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});

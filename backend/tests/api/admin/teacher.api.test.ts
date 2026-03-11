import request from "supertest";
import { TeacherError } from "../../../src/utils/errors";

jest.mock("../../../src/services", () => ({
  teacherService: {
    createTeacher: jest.fn(),
    getAllTeachers: jest.fn(),
    getTeacherById: jest.fn(),
    updateTeacher: jest.fn(),
    deleteTeacher: jest.fn(),
    bulkUploadTeachers: jest.fn(),
  },
  TeacherError,
}));

import app from "../../../src/app";
import { teacherService } from "../../../src/services";

describe("Admin Teacher API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/teachers ──────────────────────
  describe("GET /api/v1/admin/teachers", () => {
    const url = "/api/v1/admin/teachers";

    test("200 - returns teacher list", async () => {
      const mockResult = {
        data: [
          { id: 1, email: "teacher1@test.com", first_name: "Alice", last_name: "Smith" },
          { id: 2, email: "teacher2@test.com", first_name: "Bob", last_name: "Jones" },
        ],
        pagination: {
          currentPage: 1,
          limit: 10,
          totalCount: 2,
          totalPages: 1,
        },
      };
      (teacherService.getAllTeachers as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).get(url).query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Teachers fetched successfully");
      expect(teacherService.getAllTeachers).toHaveBeenCalledTimes(1);
    });

    test("500 - service error", async () => {
      (teacherService.getAllTeachers as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).get(url);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/v1/admin/teachers ─────────────────────
  describe("POST /api/v1/admin/teachers", () => {
    const url = "/api/v1/admin/teachers";

    const validTeacher = {
      email: "newteacher@test.com",
      first_name: "Alice",
      last_name: "Smith",
      school_id: 1,
    };

    test("201 - creates teacher successfully", async () => {
      const mockCreated = { id: 1, email: "newteacher@test.com", first_name: "Alice", last_name: "Smith" };
      (teacherService.createTeacher as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app).post(url).send(validTeacher);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Teacher created successfully");
      expect(teacherService.createTeacher).toHaveBeenCalledTimes(1);
    });

    test("400 - validation error (missing email)", async () => {
      const res = await request(app)
        .post(url)
        .send({ first_name: "Alice", last_name: "Smith", school_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(teacherService.createTeacher).not.toHaveBeenCalled();
    });

    test("409 - duplicate email", async () => {
      (teacherService.createTeacher as jest.Mock).mockRejectedValue(
        new TeacherError("Email already exists", 409)
      );

      const res = await request(app).post(url).send(validTeacher);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Email already exists");
    });

    test("500 - service throws unexpected error", async () => {
      (teacherService.createTeacher as jest.Mock).mockRejectedValue(new Error("Unexpected"));

      const res = await request(app).post(url).send(validTeacher);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/v1/admin/teachers/:id ──────────────────
  describe("GET /api/v1/admin/teachers/:id", () => {
    test("200 - returns teacher by id", async () => {
      const mockTeacher = { id: 1, email: "teacher@test.com", first_name: "Alice", last_name: "Smith" };
      (teacherService.getTeacherById as jest.Mock).mockResolvedValue(mockTeacher);

      const res = await request(app).get("/api/v1/admin/teachers/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Teacher fetched successfully");
      expect(res.body.data.id).toBe(1);
    });

    test("404 - teacher not found", async () => {
      (teacherService.getTeacherById as jest.Mock).mockRejectedValue(
        new TeacherError("Teacher not found", 404)
      );

      const res = await request(app).get("/api/v1/admin/teachers/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Teacher not found");
    });

    test("500 - service error", async () => {
      (teacherService.getTeacherById as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/api/v1/admin/teachers/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── PUT /api/v1/admin/teachers/:id ──────────────────
  describe("PUT /api/v1/admin/teachers/:id", () => {
    test("200 - updates teacher successfully", async () => {
      const mockUpdated = { id: 1, email: "teacher@test.com", first_name: "Updated", last_name: "Name" };
      (teacherService.updateTeacher as jest.Mock).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .put("/api/v1/admin/teachers/1")
        .send({ first_name: "Updated", last_name: "Name" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Teacher updated successfully");
      expect(teacherService.updateTeacher).toHaveBeenCalledTimes(1);
    });

    test("404 - teacher not found on update", async () => {
      (teacherService.updateTeacher as jest.Mock).mockRejectedValue(
        new TeacherError("Teacher not found", 404)
      );

      const res = await request(app)
        .put("/api/v1/admin/teachers/999")
        .send({ first_name: "Updated" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Teacher not found");
    });

    test("500 - service error on update", async () => {
      (teacherService.updateTeacher as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .put("/api/v1/admin/teachers/1")
        .send({ first_name: "Updated" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── DELETE /api/v1/admin/teachers/:id ───────────────
  describe("DELETE /api/v1/admin/teachers/:id", () => {
    test("200 - deletes teacher successfully", async () => {
      (teacherService.deleteTeacher as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete("/api/v1/admin/teachers/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Teacher deleted successfully");
    });

    test("404 - teacher not found on delete", async () => {
      (teacherService.deleteTeacher as jest.Mock).mockRejectedValue(
        new TeacherError("Teacher not found", 404)
      );

      const res = await request(app).delete("/api/v1/admin/teachers/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Teacher not found");
    });

    test("500 - service error on delete", async () => {
      (teacherService.deleteTeacher as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/api/v1/admin/teachers/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});

import request from "supertest";
import { StudentError } from "../../../src/utils/errors";

jest.mock("../../../src/services", () => ({
  studentService: {
    createStudent: jest.fn(),
    getAllStudents: jest.fn(),
    getStudentWithDetails: jest.fn(),
    updateStudent: jest.fn(),
    deleteStudent: jest.fn(),
    bulkUploadStudents: jest.fn(),
  },
  StudentError,
}));

import app from "../../../src/app";
import { studentService } from "../../../src/services";

describe("Admin Student API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/students ──────────────────────
  describe("GET /api/v1/admin/students", () => {
    const url = "/api/v1/admin/students";

    test("200 - returns student list", async () => {
      const mockResult = {
        data: [
          { id: 1, email: "student1@test.com", name: "Alice Johnson" },
          { id: 2, email: "student2@test.com", name: "Bob Williams" },
        ],
        pagination: {
          currentPage: 1,
          limit: 10,
          totalCount: 2,
          totalPages: 1,
        },
      };
      (studentService.getAllStudents as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).get(url).query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(studentService.getAllStudents).toHaveBeenCalledTimes(1);
    });

    test("200 - returns filtered students by school_id", async () => {
      const mockResult = {
        data: [{ id: 1, email: "student1@test.com", name: "Alice" }],
        pagination: { currentPage: 1, limit: 10, totalCount: 1, totalPages: 1 },
      };
      (studentService.getAllStudents as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).get(url).query({ school_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(studentService.getAllStudents).toHaveBeenCalledTimes(1);
    });

    test("500 - service error", async () => {
      (studentService.getAllStudents as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).get(url);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/v1/admin/students ─────────────────────
  describe("POST /api/v1/admin/students", () => {
    const url = "/api/v1/admin/students";

    const validStudent = {
      email: "newstudent@test.com",
      name: "Alice Johnson",
      school_id: 1,
      class_id: 1,
    };

    test("201 - creates student successfully", async () => {
      const mockCreated = { id: 1, email: "newstudent@test.com", name: "Alice Johnson" };
      (studentService.createStudent as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app).post(url).send(validStudent);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(studentService.createStudent).toHaveBeenCalledTimes(1);
    });

    test("400 - validation error (missing email)", async () => {
      const res = await request(app)
        .post(url)
        .send({ name: "Alice Johnson", school_id: 1, class_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(studentService.createStudent).not.toHaveBeenCalled();
    });

    test("400 - validation error (missing name)", async () => {
      const res = await request(app)
        .post(url)
        .send({ email: "student@test.com", school_id: 1, class_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(studentService.createStudent).not.toHaveBeenCalled();
    });

    test("409 - duplicate email", async () => {
      (studentService.createStudent as jest.Mock).mockRejectedValue(
        new StudentError("Email already exists", 409)
      );

      const res = await request(app).post(url).send(validStudent);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Email already exists");
    });

    test("500 - service throws unexpected error", async () => {
      (studentService.createStudent as jest.Mock).mockRejectedValue(new Error("Unexpected"));

      const res = await request(app).post(url).send(validStudent);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test("201 - creates student with FormData (string numeric fields)", async () => {
      const mockCreated = { id: 1, email: "newstudent@test.com", name: "Alice Johnson" };
      (studentService.createStudent as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app)
        .post(url)
        .field("email", "newstudent@test.com")
        .field("name", "Alice Johnson")
        .field("school_id", "1")
        .field("class_id", "1")
        .field("section_id", "1");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(studentService.createStudent).toHaveBeenCalledTimes(1);
      // Verify the service was called with parsed numeric values
      const calledWith = (studentService.createStudent as jest.Mock).mock.calls[0][0];
      expect(typeof calledWith.school_id).toBe("number");
      expect(typeof calledWith.class_id).toBe("number");
      expect(calledWith.school_id).toBe(1);
      expect(calledWith.class_id).toBe(1);
    });
  });

  // ─── GET /api/v1/admin/students/:id ──────────────────
  describe("GET /api/v1/admin/students/:id", () => {
    test("200 - returns student by id", async () => {
      const mockStudent = { id: 1, email: "student@test.com", name: "Alice", school_id: 1 };
      (studentService.getStudentWithDetails as jest.Mock).mockResolvedValue(mockStudent);

      const res = await request(app).get("/api/v1/admin/students/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
    });

    test("404 - student not found", async () => {
      (studentService.getStudentWithDetails as jest.Mock).mockRejectedValue(
        new StudentError("Student not found", 404)
      );

      const res = await request(app).get("/api/v1/admin/students/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Student not found");
    });

    test("500 - service error", async () => {
      (studentService.getStudentWithDetails as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/api/v1/admin/students/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── PUT /api/v1/admin/students/:id ──────────────────
  describe("PUT /api/v1/admin/students/:id", () => {
    test("200 - updates student successfully", async () => {
      const mockUpdated = { id: 1, email: "student@test.com", name: "Updated Name" };
      (studentService.updateStudent as jest.Mock).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .put("/api/v1/admin/students/1")
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(studentService.updateStudent).toHaveBeenCalledTimes(1);
    });

    test("404 - student not found on update", async () => {
      (studentService.updateStudent as jest.Mock).mockRejectedValue(
        new StudentError("Student not found", 404)
      );

      const res = await request(app)
        .put("/api/v1/admin/students/999")
        .send({ name: "Updated Name" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Student not found");
    });

    test("500 - service error on update", async () => {
      (studentService.updateStudent as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .put("/api/v1/admin/students/1")
        .send({ name: "Updated Name" });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test("200 - updates student with FormData (string numeric fields)", async () => {
      const mockUpdated = { id: 1, email: "student@test.com", name: "Updated Name", is_active: true };
      (studentService.updateStudent as jest.Mock).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .put("/api/v1/admin/students/1")
        .field("name", "Updated Name")
        .field("class_id", "2")
        .field("is_active", "true");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(studentService.updateStudent).toHaveBeenCalledTimes(1);
      // Verify the service was called with parsed values
      const calledWith = (studentService.updateStudent as jest.Mock).mock.calls[0][1];
      expect(typeof calledWith.class_id).toBe("number");
      expect(typeof calledWith.is_active).toBe("boolean");
      expect(calledWith.class_id).toBe(2);
      expect(calledWith.is_active).toBe(true);
    });
  });

  // ─── DELETE /api/v1/admin/students/:id ───────────────
  describe("DELETE /api/v1/admin/students/:id", () => {
    test("200 - deletes student successfully", async () => {
      (studentService.deleteStudent as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete("/api/v1/admin/students/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("404 - student not found on delete", async () => {
      (studentService.deleteStudent as jest.Mock).mockRejectedValue(
        new StudentError("Student not found", 404)
      );

      const res = await request(app).delete("/api/v1/admin/students/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Student not found");
    });

    test("500 - service error on delete", async () => {
      (studentService.deleteStudent as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/api/v1/admin/students/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});

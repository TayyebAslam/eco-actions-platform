import request from "supertest";
import { UserError } from "../../../src/utils/errors";

jest.mock("../../../src/services", () => ({
  userService: {
    createUser: jest.fn(),
    updateUser: jest.fn(),
    getAllUsers: jest.fn(),
    getUserById: jest.fn(),
    deleteUser: jest.fn(),
    toggleUserStatus: jest.fn(),
  },
  UserError,
}));

import app from "../../../src/app";
import { userService } from "../../../src/services";

describe("Admin User API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/v1/admin/users ─────────────────────────
  describe("GET /api/v1/admin/users", () => {
    const url = "/api/v1/admin/users";

    test("200 - returns paginated users", async () => {
      const mockResult = {
        data: [
          { id: 1, email: "user1@test.com", first_name: "John", last_name: "Doe" },
          { id: 2, email: "user2@test.com", first_name: "Jane", last_name: "Smith" },
        ],
        pagination: {
          currentPage: 1,
          limit: 10,
          totalCount: 2,
          totalPages: 1,
        },
      };
      (userService.getAllUsers as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).get(url).query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Users fetched successfully");
      expect(res.body.data.users).toHaveLength(2);
      expect(res.body.data.totalCount).toBe(2);
      expect(userService.getAllUsers).toHaveBeenCalledTimes(1);
    });

    test("500 - service error", async () => {
      (userService.getAllUsers as jest.Mock).mockRejectedValue(new Error("DB connection failed"));

      const res = await request(app).get(url);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test("400 - validation error (negative page)", async () => {
      const res = await request(app).get(url).query({ page: -1, limit: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getAllUsers).not.toHaveBeenCalled();
    });

    test("400 - validation error (non-numeric limit)", async () => {
      const res = await request(app).get(url).query({ page: 1, limit: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getAllUsers).not.toHaveBeenCalled();
    });

    test("400 - validation error (limit exceeds maximum)", async () => {
      const res = await request(app).get(url).query({ page: 1, limit: 200 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getAllUsers).not.toHaveBeenCalled();
    });

    test("400 - validation error (invalid is_active value)", async () => {
      const res = await request(app).get(url).query({ is_active: "maybe" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getAllUsers).not.toHaveBeenCalled();
    });
  });

  // ─── POST /api/v1/admin/users ────────────────────────
  describe("POST /api/v1/admin/users", () => {
    const url = "/api/v1/admin/users";

    const validUser = {
      first_name: "John",
      last_name: "Doe",
      email: "john@test.com",
      password: "StrongPass1!",
      confirmPassword: "StrongPass1!",
      role: "teacher",
    };

    test("201 - creates user successfully", async () => {
      const mockCreated = { id: 1, email: "john@test.com", first_name: "John", last_name: "Doe" };
      (userService.createUser as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app)
        .post(url)
        .field("first_name", validUser.first_name)
        .field("last_name", validUser.last_name)
        .field("email", validUser.email)
        .field("password", validUser.password)
        .field("confirmPassword", validUser.confirmPassword)
        .field("role", validUser.role);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("User created successfully");
      expect(userService.createUser).toHaveBeenCalledTimes(1);
    });

    test("400 - validation error (missing email)", async () => {
      const res = await request(app)
        .post(url)
        .field("first_name", "John")
        .field("last_name", "Doe")
        .field("password", "StrongPass1!")
        .field("confirmPassword", "StrongPass1!")
        .field("role", "teacher");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    test("400 - validation error (passwords do not match)", async () => {
      const res = await request(app)
        .post(url)
        .field("first_name", "John")
        .field("last_name", "Doe")
        .field("email", "john@test.com")
        .field("password", "StrongPass1!")
        .field("confirmPassword", "DifferentPass1!")
        .field("role", "teacher");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.createUser).not.toHaveBeenCalled();
    });

    test("500 - service throws unexpected error", async () => {
      (userService.createUser as jest.Mock).mockRejectedValue(new Error("Unexpected"));

      const res = await request(app)
        .post(url)
        .field("first_name", validUser.first_name)
        .field("last_name", validUser.last_name)
        .field("email", validUser.email)
        .field("password", validUser.password)
        .field("confirmPassword", validUser.confirmPassword)
        .field("role", validUser.role);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/v1/admin/users/:id ─────────────────────
  describe("GET /api/v1/admin/users/:id", () => {
    test("200 - returns user by id", async () => {
      const mockUser = { id: 1, email: "user@test.com", first_name: "John", last_name: "Doe" };
      (userService.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app).get("/api/v1/admin/users/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User fetched successfully");
      expect(res.body.data.id).toBe(1);
      expect(userService.getUserById).toHaveBeenCalledWith(1);
    });

    test("404 - user not found", async () => {
      (userService.getUserById as jest.Mock).mockRejectedValue(
        new UserError("User not found", 404)
      );

      const res = await request(app).get("/api/v1/admin/users/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    test("500 - service error", async () => {
      (userService.getUserById as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/api/v1/admin/users/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test("400 - validation error (non-numeric id)", async () => {
      const res = await request(app).get("/api/v1/admin/users/abc");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getUserById).not.toHaveBeenCalled();
    });

    test("400 - validation error (negative id)", async () => {
      const res = await request(app).get("/api/v1/admin/users/-1");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getUserById).not.toHaveBeenCalled();
    });

    test("400 - validation error (zero id)", async () => {
      const res = await request(app).get("/api/v1/admin/users/0");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.getUserById).not.toHaveBeenCalled();
    });
  });

  // ─── PATCH /api/v1/admin/users/:id ───────────────────
  describe("PATCH /api/v1/admin/users/:id", () => {
    test("200 - updates user successfully", async () => {
      const mockUpdated = { id: 1, email: "updated@test.com", first_name: "Updated", last_name: "User" };
      (userService.updateUser as jest.Mock).mockResolvedValue(mockUpdated);

      const res = await request(app)
        .patch("/api/v1/admin/users/1")
        .field("first_name", "Updated")
        .field("last_name", "User")
        .field("email", "updated@test.com")
        .field("role", "teacher");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User updated successfully");
      expect(userService.updateUser).toHaveBeenCalledTimes(1);
    });

    test("404 - user not found on update", async () => {
      (userService.updateUser as jest.Mock).mockRejectedValue(
        new UserError("User not found", 404)
      );

      const res = await request(app)
        .patch("/api/v1/admin/users/999")
        .field("first_name", "Updated")
        .field("last_name", "User")
        .field("email", "updated@test.com")
        .field("role", "teacher");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("400 - validation error (non-numeric id)", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/users/abc")
        .field("first_name", "Updated")
        .field("last_name", "User")
        .field("email", "updated@test.com")
        .field("role", "teacher");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.updateUser).not.toHaveBeenCalled();
    });
  });

  // ─── DELETE /api/v1/admin/users/:id ──────────────────
  describe("DELETE /api/v1/admin/users/:id", () => {
    test("200 - deletes user successfully", async () => {
      (userService.deleteUser as jest.Mock).mockResolvedValue({ id: 1 });

      const res = await request(app).delete("/api/v1/admin/users/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User deleted successfully");
      expect(userService.deleteUser).toHaveBeenCalledWith(1);
    });

    test("404 - user not found on delete", async () => {
      (userService.deleteUser as jest.Mock).mockRejectedValue(
        new UserError("User not found", 404)
      );

      const res = await request(app).delete("/api/v1/admin/users/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    test("500 - service error on delete", async () => {
      (userService.deleteUser as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/api/v1/admin/users/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test("400 - validation error (non-numeric id)", async () => {
      const res = await request(app).delete("/api/v1/admin/users/abc");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(userService.deleteUser).not.toHaveBeenCalled();
    });
  });
});

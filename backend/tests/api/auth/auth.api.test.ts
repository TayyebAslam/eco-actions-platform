import request from "supertest";
import { AuthError } from "../../../src/utils/errors";

// Auth tests need REAL auth routes (not mocked middleware), so override auth middleware
// to NOT auto-inject user for public routes
jest.mock("../../../src/middlewares/authMiddleware", () => {
  const original = jest.requireActual("../../../src/middlewares/authMiddleware");
  return {
    ...original,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.user = { id: 1, first_name: "Test", last_name: "User", email: "admin@test.com", role: "admin", is_active: true, school_id: 1 };
      next();
    },
    requireRole: () => (req: any, _res: any, next: any) => { req.user = { id: 1, role: "admin", is_active: true }; next(); },
    requireAdmin: (req: any, _res: any, next: any) => { req.user = { id: 1, role: "admin", is_active: true }; next(); },
    requireTeacher: (req: any, _res: any, next: any) => { req.user = { id: 5, role: "teacher", is_active: true }; next(); },
    invalidateUserCache: jest.fn(),
  };
});

jest.mock("../../../src/services", () => ({
  authService: {
    login: jest.fn(),
    adminLogin: jest.fn(),
    adminSignup: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyResetToken: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    changePassword: jest.fn(),
    deleteAccount: jest.fn(),
    getSessionData: jest.fn(),
    socialLogin: jest.fn(),
  },
  AuthError,
}));

import app from "../../../src/app";
import { authService } from "../../../src/services";

describe("Auth API", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── LOGIN ─────────────────────────────────────────
  describe("POST /api/v1/auth/login-user", () => {
    const url = "/api/v1/auth/login-user";

    test("200 - successful login", async () => {
      const mockResult = { accessToken: "jwt-token", sessionToken: "session-token", user: { id: 1, email: "student@test.com", role: "student" } };
      (authService.login as jest.Mock).mockResolvedValue(mockResult);

      const res = await request(app).post(url).send({ email: "student@test.com", password: "Pass123!" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe("jwt-token");
    });

    test("400 - missing email", async () => {
      const res = await request(app).post(url).send({ password: "Pass123!" });
      expect(res.status).toBe(400);
    });

    test("400 - empty password", async () => {
      const res = await request(app).post(url).send({ email: "t@t.com", password: "" });
      expect(res.status).toBe(400);
    });

    test("401 - wrong credentials", async () => {
      (authService.login as jest.Mock).mockRejectedValue(new AuthError("Invalid email or password", 401));
      const res = await request(app).post(url).send({ email: "wrong@test.com", password: "WrongPass1!" });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
    });

    test("400 - invalid email format", async () => {
      const res = await request(app).post(url).send({ email: "not-email", password: "Pass123!" });
      expect(res.status).toBe(400);
    });
  });

  // ─── ADMIN LOGIN ───────────────────────────────────
  describe("POST /api/v1/auth/login-admin", () => {
    const url = "/api/v1/auth/login-admin";

    test("200 - successful admin login", async () => {
      (authService.adminLogin as jest.Mock).mockResolvedValue({ accessToken: "t", sessionToken: "s", user: { id: 1, role: "admin" } });
      const res = await request(app).post(url).send({ email: "admin@test.com", password: "Admin123!" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("403 - non-admin rejected", async () => {
      (authService.adminLogin as jest.Mock).mockRejectedValue(new AuthError("Access denied", 403));
      const res = await request(app).post(url).send({ email: "s@t.com", password: "Pass123!" });
      expect(res.status).toBe(403);
    });
  });

  // ─── ADMIN SIGNUP ──────────────────────────────────
  describe("POST /api/v1/auth/admin-signup", () => {
    const url = "/api/v1/auth/admin-signup";

    test("201 - successful signup", async () => {
      (authService.adminSignup as jest.Mock).mockResolvedValue({ id: 1 });
      const res = await request(app).post(url).send({ first_name: "John", last_name: "Doe", email: "new@test.com", password: "Admin123!" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test("400 - short first_name", async () => {
      const res = await request(app).post(url).send({ first_name: "J", last_name: "Doe", email: "t@t.com", password: "Admin123!" });
      expect(res.status).toBe(400);
    });

    test("400 - weak password", async () => {
      const res = await request(app).post(url).send({ first_name: "John", last_name: "Doe", email: "t@t.com", password: "weak" });
      expect(res.status).toBe(400);
    });

    test("409 - duplicate email", async () => {
      (authService.adminSignup as jest.Mock).mockRejectedValue(new AuthError("Email already registered", 409));
      const res = await request(app).post(url).send({ first_name: "John", last_name: "Doe", email: "dup@t.com", password: "Admin123!" });
      expect(res.status).toBe(409);
    });
  });

  // ─── FORGOT PASSWORD ──────────────────────────────
  describe("POST /api/v1/auth/forget-password", () => {
    const url = "/api/v1/auth/forget-password";

    test("200 - email sent", async () => {
      (authService.forgotPassword as jest.Mock).mockResolvedValue({ id: 1, email: "u@t.com" });
      const res = await request(app).post(url).send({ email: "u@t.com" });
      expect(res.status).toBe(200);
    });

    test("401 - missing email", async () => {
      const res = await request(app).post(url).send({});
      expect(res.status).toBe(401);
    });

    test("404 - email not found", async () => {
      (authService.forgotPassword as jest.Mock).mockRejectedValue(new AuthError("Not found", 404));
      const res = await request(app).post(url).send({ email: "no@t.com" });
      expect(res.status).toBe(404);
    });
  });

  // ─── RESET PASSWORD ───────────────────────────────
  describe("PUT /api/v1/auth/reset-password", () => {
    const url = "/api/v1/auth/reset-password";

    test("200 - successful reset", async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue(true);
      const res = await request(app).put(url).send({ data: "token", password: "NewPass123!" });
      expect(res.status).toBe(200);
    });

    test("400 - missing data", async () => {
      const res = await request(app).put(url).send({ password: "X" });
      expect(res.status).toBe(400);
    });

    test("400 - expired token", async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(new AuthError("Expired", 400));
      const res = await request(app).put(url).send({ data: "exp", password: "NewPass123!" });
      expect(res.status).toBe(400);
    });
  });

  // ─── VERIFY EMAIL ─────────────────────────────────
  describe("GET /api/v1/auth/verify-email", () => {
    test("200 - valid token", async () => {
      (authService.verifyEmail as jest.Mock).mockResolvedValue({ verified: true });
      const res = await request(app).get("/api/v1/auth/verify-email?data=valid-token");
      expect(res.status).toBe(200);
    });

    test("400 - missing data param", async () => {
      const res = await request(app).get("/api/v1/auth/verify-email");
      expect(res.status).toBe(400);
    });
  });

  // ─── 404 ──────────────────────────────────────────
  test("404 - unknown route", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
  });
});

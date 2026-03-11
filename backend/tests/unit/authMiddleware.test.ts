/**
 * Unit tests for authMiddleware - tests the REAL middleware logic
 * (not the mocked version used in API tests)
 */

// Override the global auth middleware mock for this file
jest.mock("../../src/middlewares/authMiddleware", () =>
  jest.requireActual("../../src/middlewares/authMiddleware")
);

import { authMiddleware } from "../../src/middlewares/authMiddleware";
import { getSignedJwt } from "../../src/utils/services/jwt";
import { cache } from "../../src/utils/services/redis/cache";

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (token?: string) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  cookies: {},
  header: jest.fn((name: string) => {
    if (name === "Authorization" && token) return `Bearer ${token}`;
    return undefined;
  }),
}) as any;

describe("authMiddleware (unit)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("401 - no token provided", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("401 - invalid token", async () => {
    const req = mockReq("invalid-token");
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("404 - user not found", async () => {
    const token = getSignedJwt(999);
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    (cache.getOrSet as jest.Mock).mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test("403 - deactivated user", async () => {
    const token = getSignedJwt(1);
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    (cache.getOrSet as jest.Mock).mockResolvedValue({
      id: 1, is_active: false, role: "admin",
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() with valid token and active user", async () => {
    const user = { id: 1, first_name: "T", last_name: "U", email: "t@t.com", role: "admin", is_active: true };
    const token = getSignedJwt(1);
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    (cache.getOrSet as jest.Mock).mockResolvedValue(user);

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalled();
  });
});

import { getSignedJwt, verifyToken, createResetToken, decodeToken } from "../../src/utils/services/jwt";

describe("JWT Service", () => {
  describe("getSignedJwt", () => {
    test("generates valid JWT token", () => {
      const token = getSignedJwt(1);
      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3);
    });

    test("different users get different tokens", () => {
      expect(getSignedJwt(1)).not.toBe(getSignedJwt(2));
    });
  });

  describe("verifyToken", () => {
    test("decodes valid token correctly", () => {
      const token = getSignedJwt(42);
      const decoded = verifyToken(token);
      expect(decoded).toHaveProperty("id", "42");
    });

    test("throws on invalid token", () => {
      expect(() => verifyToken("invalid.token.here")).toThrow("Invalid token");
    });

    test("throws on tampered token", () => {
      const token = getSignedJwt(1);
      expect(() => verifyToken(token.slice(0, -5) + "xxxxx")).toThrow();
    });
  });

  describe("createResetToken", () => {
    test("creates token with email payload", () => {
      const token = createResetToken({ email: "test@example.com" });
      const decoded = verifyToken(token);
      expect(decoded).toHaveProperty("email", "test@example.com");
    });
  });

  describe("decodeToken", () => {
    test("decodes without verification", () => {
      const token = getSignedJwt(10);
      expect(decodeToken(token)).toHaveProperty("id", "10");
    });

    test("returns null for garbage", () => {
      expect(decodeToken("not-a-token")).toBeNull();
    });
  });
});

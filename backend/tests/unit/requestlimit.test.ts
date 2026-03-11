type MockReq = {
  body?: { email?: string };
  ip?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
};

type MockRes = {
  statusCode?: number;
  headers: Record<string, string | number>;
  body?: unknown;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
  setHeader: (key: string, value: string | number) => void;
  getHeader: (key: string) => string | number | undefined;
};

const buildLimiters = () => {
  jest.resetModules();
  jest.unmock("../../src/middlewares/requestlimit");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    loginAccountLimiter,
    authLimiter,
    failedLoginIpBlocker,
    registerFailedLoginAttempt,
    clearFailedLoginAttempts,
  } = require("../../src/middlewares/requestlimit");
  return {
    loginAccountLimiter,
    authLimiter,
    failedLoginIpBlocker,
    registerFailedLoginAttempt,
    clearFailedLoginAttempts,
  };
};

const createRes = (): MockRes => {
  const headers: Record<string, string | number> = {};
  return {
    headers,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string | number) {
      headers[key] = value;
    },
    getHeader(key: string) {
      return headers[key];
    },
  };
};

const runLimiter = async (
  limiter: (req: MockReq, res: MockRes, next: () => void) => void,
  options: { email?: string; ip?: string; path?: string } = {}
) => {
  const req: MockReq = {
    body: options.email ? { email: options.email } : {},
    ip: options.ip ?? "127.0.0.1",
    method: "POST",
    path: options.path ?? "/login-admin",
    headers: {},
  };
  const res = createRes();

  let nextCalled = false;
  await new Promise<void>((resolve) => {
    limiter(req, res, () => {
      nextCalled = true;
      resolve();
    });

    setImmediate(() => resolve());
  });

  return { nextCalled, res };
};

const getRetryAfterFromBody = (body: unknown): number => {
  const payload = body as { retryAfter?: number | string; data?: { retryAfter?: number | string } };
  const retryAfter = payload?.retryAfter ?? payload?.data?.retryAfter;
  return typeof retryAfter === "number" ? retryAfter : parseInt(String(retryAfter), 10);
};

describe("loginAccountLimiter", () => {
  test("blocks after 5 attempts for the same email within 60 seconds", async () => {
    const { loginAccountLimiter: limiter } = buildLimiters();

    for (let i = 0; i < 5; i += 1) {
      const allowed = await runLimiter(limiter, { email: "admin@example.com" });
      expect(allowed.nextCalled).toBe(true);
      expect(allowed.res.statusCode).toBeUndefined();
    }

    const blocked = await runLimiter(limiter, { email: "admin@example.com" });
    expect(blocked.nextCalled).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect((blocked.res.body as { message?: string })?.message).toContain("60 seconds");
    const retryAfterNum = getRetryAfterFromBody(blocked.res.body);
    expect(Number.isFinite(retryAfterNum)).toBe(true);
    expect(retryAfterNum).toBeGreaterThanOrEqual(59);
    expect(retryAfterNum).toBeLessThanOrEqual(60);
  });

  test("tracks attempts independently per email", async () => {
    const { loginAccountLimiter: limiter } = buildLimiters();

    for (let i = 0; i < 5; i += 1) {
      const allowed = await runLimiter(limiter, { email: "first@example.com" });
      expect(allowed.nextCalled).toBe(true);
    }

    const otherEmail = await runLimiter(limiter, { email: "second@example.com" });
    expect(otherEmail.nextCalled).toBe(true);
    expect(otherEmail.res.statusCode).toBeUndefined();
  });
});

describe("authLimiter", () => {
  test("returns full 60-second cooldown on first block", async () => {
    const { authLimiter: limiter } = buildLimiters();

    for (let i = 0; i < 5; i += 1) {
      const allowed = await runLimiter(limiter, { ip: "10.10.10.10", path: "/login-admin" });
      expect(allowed.nextCalled).toBe(true);
      expect(allowed.res.statusCode).toBeUndefined();
    }

    const blocked = await runLimiter(limiter, { ip: "10.10.10.10", path: "/login-admin" });
    expect(blocked.nextCalled).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    const retryAfterNum = getRetryAfterFromBody(blocked.res.body);
    expect(Number.isFinite(retryAfterNum)).toBe(true);
    expect(retryAfterNum).toBeGreaterThanOrEqual(59);
    expect(retryAfterNum).toBeLessThanOrEqual(60);
  });
});

describe("failedLoginIpBlocker", () => {
  test("does not block before 3 failed credential attempts", async () => {
    const {
      failedLoginIpBlocker: blocker,
      registerFailedLoginAttempt,
    } = buildLimiters();

    const req: MockReq = {
      body: { email: "admin@example.com" },
      ip: "11.11.11.11",
      method: "POST",
      path: "/login-admin",
      headers: {},
    };
    for (let i = 0; i < 2; i += 1) {
      registerFailedLoginAttempt(req);
    }

    const allowed = await runLimiter(blocker, {
      email: "admin@example.com",
      ip: "11.11.11.11",
      path: "/login-admin",
    });
    expect(allowed.nextCalled).toBe(true);
    expect(allowed.res.statusCode).toBeUndefined();
  });

  test("blocks IP for 60 seconds on the 3rd failed credential attempt", async () => {
    const {
      failedLoginIpBlocker: blocker,
      registerFailedLoginAttempt,
    } = buildLimiters();

    const req: MockReq = {
      body: { email: "admin@example.com" },
      ip: "22.22.22.22",
      method: "POST",
      path: "/login-admin",
      headers: {},
    };

    for (let i = 0; i < 3; i += 1) {
      registerFailedLoginAttempt(req);
    }

    const blocked = await runLimiter(blocker, {
      email: "admin@example.com",
      ip: "22.22.22.22",
      path: "/login-admin",
    });
    expect(blocked.nextCalled).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    const retryAfterNum = getRetryAfterFromBody(blocked.res.body);
    expect(Number.isFinite(retryAfterNum)).toBe(true);
    expect(retryAfterNum).toBeGreaterThanOrEqual(59);
    expect(retryAfterNum).toBeLessThanOrEqual(60);
  });

  test("returns 60 seconds on cycles 1-3 and 900 seconds on cycle 4", () => {
    const { registerFailedLoginAttempt } = buildLimiters();
    const req: MockReq = {
      body: { email: "admin@example.com" },
      ip: "44.44.44.44",
      method: "POST",
      path: "/login-admin",
      headers: {},
    };

    const expectedRetryAfter: Array<number | null> = [
      null,
      null,
      60,
      null,
      null,
      60,
      null,
      null,
      60,
      null,
      null,
      900,
    ];

    expectedRetryAfter.forEach((expected, idx) => {
      const result = registerFailedLoginAttempt(req);
      expect(result.retryAfter).toBe(expected);
      if (idx === 11) {
        expect(result.isLongBlock).toBe(true);
      } else {
        expect(result.isLongBlock).toBe(false);
      }
    });
  });

  test("applies 15 minutes on 12th wrong attempt and restarts cycle after expiry", async () => {
    const {
      failedLoginIpBlocker: blocker,
      registerFailedLoginAttempt,
    } = buildLimiters();

    const req: MockReq = {
      body: { email: "admin@example.com" },
      ip: "55.55.55.55",
      method: "POST",
      path: "/login-admin",
      headers: {},
    };

    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(1_000_000);
    for (let i = 1; i <= 11; i += 1) {
      const result = registerFailedLoginAttempt(req);
      if (i % 3 === 0) {
        expect(result.retryAfter).toBe(60);
        nowSpy.mockReturnValue(1_000_000 + i * 61_000);
        const allowed = await runLimiter(blocker, {
          email: "admin@example.com",
          ip: "55.55.55.55",
          path: "/login-admin",
        });
        expect(allowed.nextCalled).toBe(true);
      } else {
        expect(result.retryAfter).toBeNull();
      }
    }

    const twelfth = registerFailedLoginAttempt(req);
    expect(twelfth.isLongBlock).toBe(true);
    expect(twelfth.retryAfter).toBe(900);

    nowSpy.mockReturnValue(2_702_000);
    const allowedAfterLongCooldown = await runLimiter(blocker, {
      email: "admin@example.com",
      ip: "55.55.55.55",
      path: "/login-admin",
    });
    expect(allowedAfterLongCooldown.nextCalled).toBe(true);

    const nextCycleFirst = registerFailedLoginAttempt(req);
    expect(nextCycleFirst.isLongBlock).toBe(false);
    expect(nextCycleFirst.retryAfter).toBeNull();

    nowSpy.mockRestore();
  });

  test("restarts cycle after 15-minute block expires", async () => {
    const { failedLoginIpBlocker: blocker, registerFailedLoginAttempt } = buildLimiters();
    const req: MockReq = {
      body: { email: "admin@example.com" },
      ip: "66.66.66.66",
      method: "POST",
      path: "/login-admin",
      headers: {},
    };

    const nowSpy = jest.spyOn(Date, "now");

    // First run: 12th wrong => 900
    nowSpy.mockReturnValue(2_000_000);
    for (let i = 1; i <= 12; i += 1) {
      const result = registerFailedLoginAttempt(req);
      if (i % 3 !== 0) {
        expect(result.retryAfter).toBeNull();
      } else if (i < 12) {
        expect(result.retryAfter).toBe(60);
        nowSpy.mockReturnValue(2_000_000 + i * 61_000);
        const allowed = await runLimiter(blocker, {
          email: "admin@example.com",
          ip: "66.66.66.66",
          path: "/login-admin",
        });
        expect(allowed.nextCalled).toBe(true);
      } else {
        expect(result.retryAfter).toBe(900);
      }
    }

    // Wait for long block expiry and hit blocker once so it clears long-cycle state.
    nowSpy.mockReturnValue(3_633_000);
    const allowedAfterLongExpiry = await runLimiter(blocker, {
      email: "admin@example.com",
      ip: "66.66.66.66",
      path: "/login-admin",
    });
    expect(allowedAfterLongExpiry.nextCalled).toBe(true);

    // New cycle starts from 60 again.
    const newCycleFirst = registerFailedLoginAttempt(req);
    expect(newCycleFirst.retryAfter).toBeNull();
    expect(newCycleFirst.isLongBlock).toBe(false);

    nowSpy.mockRestore();
  });

  test("allows request once failed attempts are cleared", async () => {
    const {
      failedLoginIpBlocker: blocker,
      registerFailedLoginAttempt,
      clearFailedLoginAttempts,
    } = buildLimiters();

    const req: MockReq = {
      body: { email: "admin@example.com" },
      ip: "33.33.33.33",
      method: "POST",
      path: "/login-admin",
      headers: {},
    };

    registerFailedLoginAttempt(req);
    clearFailedLoginAttempts(req);

    const allowed = await runLimiter(blocker, {
      email: "admin@example.com",
      ip: "33.33.33.33",
      path: "/login-admin",
    });
    expect(allowed.nextCalled).toBe(true);
    expect(allowed.res.statusCode).toBeUndefined();
  });
});

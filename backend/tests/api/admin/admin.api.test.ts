import request from "supertest";
import db from "../../../src/config/db";
import app from "../../../src/app";

/**
 * The admin controller uses DIRECT DB queries (not a service layer).
 * The db mock is already set up globally via tests/setup.ts.
 * We configure the mock chain return values per test.
 *
 * The global mock creates a chainable mockKnex where db("table") returns mockKnex,
 * and all chainable methods (.join, .where, .select, etc.) return mockKnex (this).
 * We override terminal methods (.first, .returning, .count) per test.
 */

const mockDb = db as unknown as jest.Mock;

describe("Admin Admins API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the chainable mock to default behavior
    resetDbMock();
  });

  function resetDbMock() {
    // Re-establish the chain: every chainable method returns the mock itself
    const chain = mockDb;
    chain.mockReturnValue(chain);
    (chain as any).join = jest.fn().mockReturnValue(chain);
    (chain as any).leftJoin = jest.fn().mockReturnValue(chain);
    (chain as any).select = jest.fn().mockReturnValue(chain);
    (chain as any).where = jest.fn().mockReturnValue(chain);
    (chain as any).andWhere = jest.fn().mockReturnValue(chain);
    (chain as any).whereIn = jest.fn().mockReturnValue(chain);
    (chain as any).whereNot = jest.fn().mockReturnValue(chain);
    (chain as any).orderBy = jest.fn().mockReturnValue(chain);
    (chain as any).offset = jest.fn().mockReturnValue(chain);
    (chain as any).limit = jest.fn().mockReturnValue(chain);
    (chain as any).first = jest.fn().mockResolvedValue(null);
    (chain as any).count = jest.fn().mockResolvedValue([{ count: "0" }]);
    (chain as any).insert = jest.fn().mockReturnValue(chain);
    (chain as any).update = jest.fn().mockReturnValue(chain);
    (chain as any).del = jest.fn().mockResolvedValue(1);
    (chain as any).returning = jest.fn().mockResolvedValue([]);
    (chain as any).raw = jest.fn().mockReturnValue("raw_sql");
    (chain as any).transaction = jest.fn(async (cb: any) => cb(chain));
  }

  // ─── GET /api/v1/admin/admins ────────────────────────
  describe("GET /api/v1/admin/admins", () => {
    const url = "/api/v1/admin/admins";

    test("200 - returns admin list", async () => {
      const mockAdmins = [
        { id: 2, email: "admin2@test.com", first_name: "Sub", last_name: "Admin", role: "sub_admin" },
      ];

      // The controller calls the query chain then resolves from orderBy
      // Since all chain methods return the mock, the final awaited value
      // comes from the last chain call. We make the chain resolve to mockAdmins
      // by overriding offset -> limit -> orderBy to eventually resolve.
      // The actual resolution happens when the chain is awaited.
      // We need to make the chain thenable at the end.
      (mockDb as any).orderBy = jest.fn().mockResolvedValue(mockAdmins);
      (mockDb as any).count = jest.fn().mockResolvedValue([{ count: "1" }]);

      const res = await request(app).get(url);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Admins fetched successfully");
      expect(res.body.data).toBeDefined();
    });

    test("500 - database error", async () => {
      (mockDb as any).orderBy = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app).get(url);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/v1/admin/admins ───────────────────────
  describe("POST /api/v1/admin/admins", () => {
    const url = "/api/v1/admin/admins";

    const validAdmin = {
      first_name: "John",
      last_name: "Doe",
      email: "newadmin@test.com",
      password: "StrongPass1!",
      role: "sub_admin",
    };

    test("201 - creates admin successfully", async () => {
      // The controller checks for existing user (first() returns null = no duplicate)
      (mockDb as any).first = jest.fn().mockResolvedValue(null);

      // Mock role lookup: db(TABLE.ROLES).where({name}).first()
      // This is called after the email check, so we need first() to return
      // null first (no existing user), then { id: 2, name: 'sub_admin' } for role lookup
      let firstCallCount = 0;
      (mockDb as any).first = jest.fn().mockImplementation(() => {
        firstCallCount++;
        if (firstCallCount === 1) return Promise.resolve(null); // no existing user
        if (firstCallCount === 2) return Promise.resolve({ id: 2, name: "sub_admin" }); // role record
        if (firstCallCount === 3) return Promise.resolve({ id: 10 }); // default school in transaction
        return Promise.resolve(null);
      });

      // Mock transaction: the controller uses db.transaction(async (trx) => { ... })
      // Inside the transaction, trx is used like db - trx(TABLE).insert().returning()
      const mockTrx: any = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 5,
            email: "newadmin@test.com",
            first_name: "John",
            last_name: "Doe",
            is_active: true,
            created_at: "2026-02-18",
          }]),
        }),
        first: jest.fn().mockResolvedValue({ id: 1 }),
      });
      (mockDb as any).transaction = jest.fn(async (cb: any) => cb(mockTrx));

      const res = await request(app)
        .post(url)
        .field("first_name", validAdmin.first_name)
        .field("last_name", validAdmin.last_name)
        .field("email", validAdmin.email)
        .field("password", validAdmin.password)
        .field("role", validAdmin.role);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Admin created successfully");
    });

    test("400 - validation error (missing email)", async () => {
      const res = await request(app)
        .post(url)
        .field("first_name", "John")
        .field("last_name", "Doe")
        .field("password", "StrongPass1!")
        .field("role", "sub_admin");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("400 - validation error (invalid role)", async () => {
      const res = await request(app)
        .post(url)
        .field("first_name", "John")
        .field("last_name", "Doe")
        .field("email", "admin@test.com")
        .field("password", "StrongPass1!")
        .field("role", "invalid_role");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("400 - validation error (weak password)", async () => {
      const res = await request(app)
        .post(url)
        .field("first_name", "John")
        .field("last_name", "Doe")
        .field("email", "admin@test.com")
        .field("password", "weak")
        .field("role", "sub_admin");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("400 - email already exists", async () => {
      // first() returns an existing user
      (mockDb as any).first = jest.fn().mockResolvedValue({
        id: 1,
        email: "existing@test.com",
      });

      const res = await request(app)
        .post(url)
        .field("first_name", "John")
        .field("last_name", "Doe")
        .field("email", "existing@test.com")
        .field("password", "StrongPass1!")
        .field("role", "sub_admin");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Email already exists");
    });
  });

  // ─── GET /api/v1/admin/admins/:id ────────────────────
  describe("GET /api/v1/admin/admins/:id", () => {
    test("200 - returns admin by id", async () => {
      const mockAdmin = {
        id: 2,
        email: "admin2@test.com",
        first_name: "Sub",
        last_name: "Admin",
        role: "sub_admin",
        is_active: true,
      };
      (mockDb as any).first = jest.fn().mockResolvedValue(mockAdmin);

      const res = await request(app).get("/api/v1/admin/admins/2");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Admin fetched successfully");
      expect(res.body.data.id).toBe(2);
    });

    test("404 - admin not found", async () => {
      (mockDb as any).first = jest.fn().mockResolvedValue(null);

      const res = await request(app).get("/api/v1/admin/admins/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Admin not found");
    });

    test("500 - database error", async () => {
      (mockDb as any).first = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app).get("/api/v1/admin/admins/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── DELETE /api/v1/admin/admins/:id ─────────────────
  describe("DELETE /api/v1/admin/admins/:id", () => {
    test("200 - deletes admin successfully", async () => {
      // first() returns an existing admin for the existence check
      (mockDb as any).first = jest.fn().mockResolvedValue({
        id: 3,
        email: "sub@test.com",
        role: "sub_admin",
        is_active: true,
      });
      (mockDb as any).del = jest.fn().mockResolvedValue(1);

      const res = await request(app).delete("/api/v1/admin/admins/3");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Admin deleted successfully");
    });

    test("404 - admin not found on delete", async () => {
      (mockDb as any).first = jest.fn().mockResolvedValue(null);

      const res = await request(app).delete("/api/v1/admin/admins/999");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Admin not found");
    });

    test("500 - database error on delete", async () => {
      (mockDb as any).first = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app).delete("/api/v1/admin/admins/1");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── PATCH /api/v1/admin/admins/:id/toggle-status ────
  describe("PATCH /api/v1/admin/admins/:id/toggle-status", () => {
    test("200 - toggles admin status successfully", async () => {
      // first() returns existing admin with is_active = true
      (mockDb as any).first = jest.fn().mockResolvedValue({
        id: 3,
        email: "sub@test.com",
        role: "sub_admin",
        is_active: true,
      });
      (mockDb as any).update = jest.fn().mockResolvedValue(1);

      const res = await request(app).patch("/api/v1/admin/admins/3/toggle-status");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_active).toBe(false);
    });

    test("404 - admin not found on toggle", async () => {
      (mockDb as any).first = jest.fn().mockResolvedValue(null);

      const res = await request(app).patch("/api/v1/admin/admins/999/toggle-status");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Admin not found");
    });

    test("500 - database error on toggle", async () => {
      (mockDb as any).first = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app).patch("/api/v1/admin/admins/1/toggle-status");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});

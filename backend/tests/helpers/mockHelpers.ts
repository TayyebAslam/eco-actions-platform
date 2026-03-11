import { User } from "../../src/utils/types/auth";
import { UserRole } from "../../src/utils/enums/users.enum";

/** Creates a mock user */
export const mockUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  role: UserRole.ADMIN,
  is_verified: true,
  is_active: true,
  ...overrides,
});

export const mockAdminUser = (overrides: Partial<User> = {}): User =>
  mockUser({ id: 1, role: UserRole.ADMIN, email: "admin@test.com", school_id: 1, ...overrides });

export const mockSuperAdminUser = (overrides: Partial<User> = {}): User =>
  mockUser({ id: 1, role: UserRole.SUPER_ADMIN, email: "superadmin@test.com", ...overrides });

export const mockStudentUser = (overrides: Partial<User> = {}): User =>
  mockUser({ id: 10, role: UserRole.STUDENT, email: "student@test.com", school_id: 1, ...overrides });

export const mockTeacherUser = (overrides: Partial<User> = {}): User =>
  mockUser({ id: 5, role: UserRole.TEACHER, email: "teacher@test.com", school_id: 1, ...overrides });

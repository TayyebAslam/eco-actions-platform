import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";
import { UserRole } from "../../utils/enums/users.enum";
import bcrypt from "bcryptjs";

exports.seed = async function (knex: Knex) {
  // 1. Seed Roles
  const roles = [
    { name: UserRole.SUPER_ADMIN, display_name: "Super Admin" },
    { name: UserRole.SUPER_SUB_ADMIN, display_name: "Super Sub Admin" },
    { name: UserRole.ADMIN, display_name: "Admin" },
    { name: UserRole.SUB_ADMIN, display_name: "Sub Admin" },
    { name: UserRole.TEACHER, display_name: "Teacher" },
    { name: UserRole.STUDENT, display_name: "Student" },
  ];

  for (const role of roles) {
    const existingRole = await knex(TABLE.ROLES).where({ name: role.name }).first();
    if (!existingRole) {
      await knex(TABLE.ROLES).insert(role);
    }
  }

  // 2. Get Super Admin Role ID
  const superAdminRole = await knex(TABLE.ROLES).where({ name: UserRole.SUPER_ADMIN }).first();

  // 3. Seed Super Admin User
  const hashedPassword = await bcrypt.hash("Admin@123", 10);

  const existingUser = await knex(TABLE.USERS)
    .where({ email: "superadmin@example.com" })
    .first();

  if (!existingUser) {
    await knex(TABLE.USERS).insert([
      {
        email: "superadmin@example.com",
        password_hash: hashedPassword,
        role_id: superAdminRole.id,
        is_active: true,
      },
    ]);
  }
};
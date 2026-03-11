import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  // Add "admins" module to the modules table
  const existing = await knex(TABLE.MODULES).where({ key: "admins" }).first();
  if (!existing) {
    await knex(TABLE.MODULES).insert({
      name: "School Admins",
      key: "admins",
      scope: "school",
    });
  }

  // Get the newly inserted module
  const adminsModule = await knex(TABLE.MODULES).where({ key: "admins" }).first();
  if (!adminsModule) return;

  // Get all existing ADMIN role users and insert default permissions for them
  const adminRole = await knex(TABLE.ROLES).where({ name: "admin" }).first();
  const subAdminRole = await knex(TABLE.ROLES).where({ name: "sub_admin" }).first();

  if (adminRole) {
    const adminUsers = await knex(TABLE.USERS).where({ role_id: adminRole.id });
    const adminPermissions = adminUsers.map((user: { id: number }) => ({
      user_id: user.id,
      module_id: adminsModule.id,
      can_create: true,
      can_read: true,
      can_edit: true,
      can_delete: true,
    }));
    if (adminPermissions.length > 0) {
      await knex(TABLE.PERMISSIONS).insert(adminPermissions);
    }
  }

  // Auto-verify email for all existing admins created by Super Admin
  // These admins were created manually, not via signup, so email verification is unnecessary
  if (adminRole) {
    await knex(TABLE.USERS)
      .where({ role_id: adminRole.id, email_verified: false })
      .update({ email_verified: true });
  }

  // Sub-admins get the module but with all permissions disabled
  if (subAdminRole) {
    const subAdminUsers = await knex(TABLE.USERS).where({ role_id: subAdminRole.id });
    const subAdminPermissions = subAdminUsers.map((user: { id: number }) => ({
      user_id: user.id,
      module_id: adminsModule.id,
      can_create: false,
      can_read: false,
      can_edit: false,
      can_delete: false,
    }));
    if (subAdminPermissions.length > 0) {
      await knex(TABLE.PERMISSIONS).insert(subAdminPermissions);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const adminsModule = await knex(TABLE.MODULES).where({ key: "admins" }).first();
  if (adminsModule) {
    await knex(TABLE.PERMISSIONS).where({ module_id: adminsModule.id }).del();
    await knex(TABLE.MODULES).where({ id: adminsModule.id }).del();
  }
}

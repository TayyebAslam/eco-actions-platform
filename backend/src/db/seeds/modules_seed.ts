import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

const modules = [
  // Platform-level modules (permission-based)
  { name: "System Users", key: "super_sub_admins", scope: "platform" },

  // School-level modules
  // Note: Schools module is Super Admin only - not permission based
  { name: "School Admins", key: "admins", scope: "school" },
  { name: "Students", key: "students", scope: "school" },
  { name: "Teachers", key: "teachers", scope: "school" },
  { name: "Categories", key: "categories", scope: "school" },
  { name: "Activities", key: "activities", scope: "school" },
  { name: "Challenges", key: "challenges", scope: "school" },
  { name: "Articles", key: "articles", scope: "school" },
  { name: "Badges", key: "badges", scope: "school" },
  { name: "Levels", key: "levels", scope: "school" },
];

exports.seed = async function (knex: Knex) {
  for (const module of modules) {
    const existing = await knex(TABLE.MODULES).where({ key: module.key }).first();
    if (!existing) {
      await knex(TABLE.MODULES).insert(module);
    }
  }
  console.log("✅ Modules seeded successfully");
};

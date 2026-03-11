import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

exports.seed = async function (knex: Knex) {
  // 1. Seed School
  let school = await knex(TABLE.SCHOOLS).first();

  if (!school) {
    const [inserted] = await knex(TABLE.SCHOOLS)
      .insert({
        name: "Greenwood High",
        slug: "greenwood",
        subscription_status: "active",
      })
      .returning("*");
    school = inserted;
    console.log("School seeded successfully!");
  } else {
    console.log("School already exists, skipping.");
  }

  // Note: sections (A, B, C, D) are global defaults seeded by sections_seed.ts —
  // they are not tied to a specific school or class, so nothing to seed here.
};

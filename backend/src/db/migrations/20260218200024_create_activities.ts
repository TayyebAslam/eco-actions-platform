import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.ACTIVITIES, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("school_id").unsigned().notNullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.integer("category_id").unsigned().notNullable().references("id").inTable(TABLE.CATEGORIES).onDelete("CASCADE");
    table.string("title").nullable();
    table.text("description").nullable();
    table.json("photos").nullable();
    table.string("status").defaultTo("pending").comment("pending, approved, rejected");
    table.integer("points").defaultTo(0);
    table.text("rejection_reason").nullable();
    table.integer("reviewed_by").unsigned().nullable().references("id").inTable(TABLE.USERS).onDelete("SET NULL");
    table.timestamp("reviewed_at").nullable();
    table.boolean("challenge_activity").notNullable().defaultTo(false);
    table.integer("challenge_variant_id").unsigned().nullable().references("id").inTable(TABLE.CHALLENGE_VARIANTS).onDelete("SET NULL");
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.ACTIVITIES);
}

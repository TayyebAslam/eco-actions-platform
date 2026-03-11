import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.USERS, (table) => {
    table.increments("id").primary();
    table.string("email").unique().notNullable();
    table.string("password_hash").nullable();
    table.string("google_id").nullable();
    table.string("apple_id").nullable();
    table.integer("role_id").unsigned().notNullable().references("id").inTable(TABLE.ROLES).onDelete("RESTRICT");
    table.boolean("is_active").defaultTo(true);
    table.string("avatar_url").nullable();
    table.string("first_name").nullable();
    table.string("last_name").nullable();
    table.boolean("email_verified").defaultTo(false);
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("SET NULL");
    table.timestamp("deleted_at").nullable();
    table.boolean("is_deleted").defaultTo(false).notNullable();
    table.string("social_id").nullable().index();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.USERS);
}

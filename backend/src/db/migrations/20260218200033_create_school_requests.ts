import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.SCHOOL_REQUESTS, (table) => {
    table.increments("id").primary();
    table.string("admin_email").notNullable().index();
    table.string("admin_first_name").notNullable();
    table.string("admin_last_name").notNullable();
    table.string("admin_password_hash").notNullable();
    table.string("school_name").nullable();
    table.string("school_slug").nullable();
    table.text("school_address").nullable();
    table.string("school_logo_url").nullable();
    table.enum("status", ["pending", "approved", "rejected"]).defaultTo("pending").notNullable();
    table.timestamp("reviewed_at").nullable();
    table.integer("reviewed_by").unsigned().nullable().references("id").inTable(TABLE.USERS).onDelete("SET NULL");
    table.text("rejection_reason").nullable();
    table.boolean("email_verified").defaultTo(false);
    table.integer("user_id").unsigned().nullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.timestamps(true, true);
    table.index(["status", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.SCHOOL_REQUESTS);
}

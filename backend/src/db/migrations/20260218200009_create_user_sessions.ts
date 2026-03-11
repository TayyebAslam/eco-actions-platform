import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.USER_SESSIONS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.string("session_token", 255).notNullable().unique();
    table.string("device_name", 255).nullable();
    table.string("device_type", 50).nullable();
    table.string("browser", 100).nullable();
    table.string("os", 100).nullable();
    table.string("ip_address", 45).nullable();
    table.boolean("is_active").defaultTo(true);
    table.timestamp("last_activity_at").defaultTo(knex.fn.now());
    table.timestamp("expires_at").notNullable();
    table.timestamps(true, true);
    table.index(["user_id", "is_active"]);
    table.index(["expires_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.USER_SESSIONS);
}

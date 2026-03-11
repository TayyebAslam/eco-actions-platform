import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.FCM_TOKENS, (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable(TABLE.USERS)
      .onDelete("CASCADE");
    table.text("token").notNullable();
    table.string("device_type", 20).defaultTo("web");
    table.string("device_name", 255).nullable();
    table.timestamp("last_used_at").defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.unique(["user_id", "token"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.FCM_TOKENS);
}

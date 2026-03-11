import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.PASSWORD_RESETS, (table) => {
    table.increments("id").primary();
    table.string("email").notNullable().index();
    table.string("token").notNullable();
    table.timestamp("expires_at").nullable();
    table.string("purpose", 50).defaultTo("password_reset");
    table.boolean("used").defaultTo(false);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.PASSWORD_RESETS);
}

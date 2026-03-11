import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.EMAIL_VERIFICATION_TOKENS, (table) => {
    table.increments("id").primary();
    table.string("email").notNullable().index();
    table.string("token").notNullable();
    table.timestamp("expires_at").notNullable();
    table.boolean("used").defaultTo(false);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.EMAIL_VERIFICATION_TOKENS);
}

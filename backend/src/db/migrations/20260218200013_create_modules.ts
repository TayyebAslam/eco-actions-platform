import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.MODULES, (table) => {
    table.increments("id").primary();
    table.string("name").nullable();
    table.string("key").unique().nullable();
    table.string("scope").notNullable().comment("global, school, platform");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.MODULES);
}

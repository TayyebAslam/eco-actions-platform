import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.ROLES, (table) => {
    table.increments("id").primary();
    table.string("name").unique().notNullable();
    table.string("display_name").nullable();
    table.text("description").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.ROLES);
}

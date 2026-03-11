import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.CLASSES, (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.CLASSES);
}

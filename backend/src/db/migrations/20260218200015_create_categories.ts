import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.CATEGORIES, (table) => {
    table.increments("id").primary();
    table.string("name").nullable();
    table.string("icon_url").nullable();
    table.string("color").nullable();
    table.json("units").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.CATEGORIES);
}

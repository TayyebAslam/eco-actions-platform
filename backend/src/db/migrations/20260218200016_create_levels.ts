import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.LEVELS, (table) => {
    table.integer("id").primary();
    table.string("title").nullable();
    table.integer("min_xp").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.LEVELS);
}

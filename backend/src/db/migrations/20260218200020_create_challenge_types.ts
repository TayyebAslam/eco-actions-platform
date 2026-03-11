import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.CHALLENGE_TYPES, (table) => {
    table.increments("id").primary();
    table.string("name").notNullable().unique();
    table.string("label").notNullable();
    table.text("description").nullable();
    table.json("units").nullable();
    table.boolean("is_active").defaultTo(true);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.CHALLENGE_TYPES);
}

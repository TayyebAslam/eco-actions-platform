import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.SECTIONS, (table) => {
    table.increments("id").primary();
    table.integer("class_id").unsigned().notNullable().references("id").inTable(TABLE.CLASSES).onDelete("CASCADE");
    table.string("name").notNullable();
    table.integer("school_id").unsigned().notNullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.SECTIONS);
}

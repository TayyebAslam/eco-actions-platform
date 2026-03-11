import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.TEACHER_SECTIONS, (table) => {
    table.increments("id").primary();
    table.integer("teacher_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("section_id").unsigned().notNullable().references("id").inTable(TABLE.SECTIONS).onDelete("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.TEACHER_SECTIONS);
}

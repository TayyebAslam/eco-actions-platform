import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.CHALLENGE_VARIANTS, (table) => {
    table.increments("id").primary();
    table.integer("challenge_id").unsigned().notNullable().references("id").inTable(TABLE.CHALLENGES).onDelete("CASCADE");
    table.string("name").nullable();
    table.string("description").nullable();
    table.integer("target_count").nullable();
    table.string("target_unit").nullable();
    table.integer("points").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.CHALLENGE_VARIANTS);
}

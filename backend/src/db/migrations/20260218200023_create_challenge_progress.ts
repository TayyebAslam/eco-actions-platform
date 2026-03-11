import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.CHALLENGE_PROGRESS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("challenge_variant_id").unsigned().notNullable().references("id").inTable(TABLE.CHALLENGE_VARIANTS).onDelete("CASCADE");
    table.string("status").nullable();
    table.integer("current_count").nullable();
    table.timestamp("completed_at").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.CHALLENGE_PROGRESS);
}

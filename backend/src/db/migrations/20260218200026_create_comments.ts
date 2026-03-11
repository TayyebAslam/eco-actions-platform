import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.COMMENTS, (table) => {
    table.increments("id").primary();
    table.integer("activity_id").unsigned().notNullable().references("id").inTable(TABLE.ACTIVITIES).onDelete("CASCADE");
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.text("content").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.COMMENTS);
}

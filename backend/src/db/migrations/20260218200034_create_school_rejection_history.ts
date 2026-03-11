import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.SCHOOL_REJECTION_HISTORY, (table) => {
    table.increments("id").primary();
    table.integer("school_request_id").unsigned().notNullable().references("id").inTable(TABLE.SCHOOL_REQUESTS).onDelete("CASCADE");
    table.text("rejection_reason").notNullable();
    table.integer("rejected_by").unsigned().references("id").inTable(TABLE.USERS).onDelete("SET NULL");
    table.timestamp("rejected_at").defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.SCHOOL_REJECTION_HISTORY);
}

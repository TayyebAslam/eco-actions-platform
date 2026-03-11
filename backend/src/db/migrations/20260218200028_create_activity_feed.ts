import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.ACTIVITY_FEED, (table) => {
    table.increments("id").primary();
    table.integer("activity_id").unsigned().notNullable().references("id").inTable(TABLE.ACTIVITIES).onDelete("CASCADE");
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("school_id").unsigned().notNullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.text("bio").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.unique(["activity_id", "user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.ACTIVITY_FEED);
}

import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.EMAIL_CHANGE_REQUESTS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.string("current_email").notNullable().index();
    table.string("new_email").notNullable();
    table.string("otp", 6).notNullable();
    table.boolean("is_used").defaultTo(false);
    table.timestamp("expires_at").notNullable();
    table.timestamps(true, true);
    table.index(["current_email", "otp", "is_used"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.EMAIL_CHANGE_REQUESTS);
}

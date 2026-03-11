import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.PERMISSIONS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("module_id").unsigned().notNullable().references("id").inTable(TABLE.MODULES).onDelete("CASCADE");
    table.boolean("can_create").defaultTo(false);
    table.boolean("can_read").defaultTo(true);
    table.boolean("can_edit").defaultTo(false);
    table.boolean("can_delete").defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.PERMISSIONS);
}

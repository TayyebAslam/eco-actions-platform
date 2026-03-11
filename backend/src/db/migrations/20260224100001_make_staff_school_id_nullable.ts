import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  // Make school_id nullable in staff table to support global system users
  await knex.schema.alterTable(TABLE.STAFF, (table) => {
    table.integer("school_id").nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  // Revert: make school_id NOT NULL again
  // Note: This will fail if there are staff records with NULL school_id
  await knex.schema.alterTable(TABLE.STAFF, (table) => {
    table.integer("school_id").notNullable().alter();
  });
}

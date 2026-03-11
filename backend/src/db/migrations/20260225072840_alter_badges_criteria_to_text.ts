import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE.BADGES, (table) => {
    // Change criteria from varchar(255) to text to support up to 500 chars
    table.text("criteria").nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  // WARNING: Rollback will truncate criteria values longer than 255 characters
  await knex.schema.alterTable(TABLE.BADGES, (table) => {
    table.string("criteria").nullable().alter();
  });
}
